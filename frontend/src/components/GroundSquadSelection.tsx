
import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import world from '../../../content/scenes/meridian.json';
import r2Assets from '../assets/r2-assets-manifest.json';
import { GroundPlanetBackdrop, GroundWildSectorScenery } from './GroundOutpostScenery';
import { GroundColonyWalls, GroundColonyStations } from './GroundColonyArchitecture';
import { GroundColonyFloor, GroundColonyFixtures } from './GroundColonyDressing';
import { GroundLandingCourt3D } from './GroundLandingCourt3D';
import { groundSurfaceFrame } from '../groundSurfaceFrame';
import { GroundArchiveVolume3D } from './GroundArchiveVolume3D';
import { GroundCrewPortrait } from './GroundCrewPortrait';
import { officerRouteStepAt } from '../isoOfficerAnimation';
import { WALK_ATLAS } from '../tacticalAnimation';
import { startAwayTeam } from '../../../src/awayTeam.mjs';
import { OFFICERS } from '../../../src/crew.mjs';
import { orderGroundOfficersByDepth } from '../../../src/groundIsoDepth.mjs';
import { groundFogOfWar, groundVisionCells } from '../../../src/groundFogOfWar.mjs';
import type { GroundSnapshot } from '../groundSquadSession';
import { isSelectionDrag, selectOfficer, selectOfficerRectangle } from '../../../src/tacticalSelection.mjs';
import './groundSquadSelection.css';

type Officer = { id: string; name: string };
type Point = { x: number; y: number };
type GroundMoveResult = boolean | { moved: boolean; officerId: string; path: Point[] };
type WalkSession = {officerId:string; path:Point[]; started:number};
type WalkPose = {officerId:string; x:number; y:number; gridX:number; gridY:number; frame:number};
type Gesture = { pointerId: number; start: Point; target: string | null; tile: string | null; additive: boolean; dragged: boolean };
const scene = world.scenes.surface;
const tile = (col: number, row: number): Point => ({ x: 440 + (col - row) * 40, y: 52 + (col + row) * 20 });
const tileShape = (col: number, row: number) => {
  const { x, y } = tile(col, row);
  return [x + ',' + (y - 20), (x + 40) + ',' + y, x + ',' + (y + 20), (x - 40) + ',' + y].join(' ');
};
// Reuse the authored single-pose WebPs already loaded by the tactical renderer.
// Keep identity/selection on the SVG group and never let CDN status own a move.
const femaleIdle = r2Assets.assets['starAdventures.tactical.officerFemaleMvsV1'].url;
const maleIdle = r2Assets.assets['starAdventures.tactical.officerMaleMvsV1'].url;
const officerIdleArt: Record<string, string> = {
  venn: femaleIdle, mira: femaleIdle,
  varela: maleIdle, solan: maleIdle, dorn: maleIdle, rhee: maleIdle,
};
const femaleWalk = r2Assets.assets['starAdventures.tactical.officerFemaleWalkV1'].url;
const maleWalk = r2Assets.assets['starAdventures.tactical.officerMaleWalkV1'].url;
const officerWalkArt: Record<string,string> = {
  venn: femaleWalk, mira: femaleWalk,
  varela: maleWalk, solan: maleWalk, dorn: maleWalk, rhee: maleWalk,
};
const blocked = new Set(scene.walls.map(cell => cell.x + ',' + cell.y));
// Canonical cell polygons remain the *only* pointer targets. Original
// per-cell terrain palettes made the colony resemble a checkerboard even
// after the undiscoved-fog treatment; material shading is now world-space.
const floorMaterial=(cell:{x:number;y:number;key:string})=>
  blocked.has(cell.key) ? 'url(#ground-continuous-wallstone)'
    : cell.x>=9||cell.y>=8 ? 'url(#ground-continuous-outside)'
    : 'url(#ground-continuous-colony)';
const cellPath=(cell:{x:number;y:number})=>
  'M'+tileShape(cell.x,cell.y).replaceAll(' ','L')+'Z';
const sceneTiles = Array.from({ length: scene.height }, (_, y) =>
  Array.from({ length: scene.width }, (_, x) => ({ x, y, key: x + ',' + y }))).flat();

export function GroundSquadSelection({
  squad, position, officers, snapshot, onMove, onInspectProbe, onAssistCivilians, onPerimeterContact, allowWholeMove, realtime=false, realtimeFog=null, realtimeMovingIds=[], onRealtimeToggle, disabled = false,
}: {
  squad: Officer[];
  position: { x: number; y: number };
  officers: Array<{id: string; x: number; y: number; heading: string}>;
  snapshot: GroundSnapshot;
  onMove: (target: Point, selection: string[]) => GroundMoveResult;
  onInspectProbe: (officerId: string) => string;
  onAssistCivilians: (officerId: string) => string;
  onPerimeterContact: (officerId: string) => string;
  allowWholeMove: boolean;
  realtime?: boolean;
  realtimeFog?: {visible:ReadonlySet<string>;explored:ReadonlySet<string>}|null;
  realtimeMovingIds?: string[];
  onRealtimeToggle?:()=>void;
  disabled?: boolean;
}) {
  // Every sprite has a validated, replayed cell; the classic FPS position is separate.
  const units = squad.map(officer => {
    const location = officers.find(unit => unit.id === officer.id);
    const gridX = location?.x ?? position.x;
    const gridY = location?.y ?? position.y;
    return {...officer, gridX, gridY, heading: location?.heading ?? 'N', ...tile(gridX, gridY)};
  });
  const [selected, setSelected] = useState<string[]>(() => squad[0] ? [squad[0].id] : []);
  // Draw vector proxies until each CDN image is actually decoded. An R2
  // outage must not make an officer invisible or change picking/positions.
  const [readyArt, setReadyArt] = useState<Set<string>>(() => new Set());
  const [readyWalk, setReadyWalk] = useState<Set<string>>(() => new Set());
  const rosterKey = squad.map(officer=>officer.id).join('|');
  // Terrain memory comes from the accepted command replay, not a second
  // browser storage key that could diverge from the saved squad history.
  const fog = useMemo(() => groundFogOfWar(world,
    {...startAwayTeam(),squad:squad.map(officer=>officer.id)},snapshot),
    [snapshot,rosterKey]);
  useEffect(()=>{
    // Browser-side preload avoids adding invisible SVG geometry that would
    // enlarge clickable officer bounds or make Playwright select the wrong tile.
    let active=true;
    const images=squad.map(officer=>{
      const url=officerWalkArt[officer.id];
      if(!url)return null;
      const img=new Image();
      img.onload=()=>{if(active)setReadyWalk(prev=>new Set(prev).add(officer.id));};
      img.onerror=()=>{if(active)setReadyWalk(prev=>{
        if(!prev.has(officer.id))return prev;
        const next=new Set(prev);next.delete(officer.id);return next;
      });};
      img.src=url;
      return img;
    });
    return ()=>{active=false;images.forEach(img=>{
      if(img){img.onload=null;img.onerror=null;}
    });};
  // Only a change of deployed officer IDs requires fresh atlas preloads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rosterKey]);
  const [walking, setWalking] = useState<WalkSession | null>(null);
  const [walkPose, setWalkPose] = useState<WalkPose | null>(null);
  const [fogBeforeWalk, setFogBeforeWalk] = useState<{
    explored:ReadonlySet<string>;visible:ReadonlySet<string>;
  } | null>(null);
  useEffect(()=>{if(realtime){setWalking(null);setWalkPose(null);setFogBeforeWalk(null);}},[realtime]);
  useEffect(() => {
    if(!walking || realtime) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      setWalkPose(null);setWalking(null);return;
    }
    const path=walking.path.map(cell=>cell.x+':'+cell.y);
    let raf=0;
    const tick=(now:number)=>{
      const step=officerRouteStepAt(path,now-walking.started);
      if(step.done){
        setWalkPose(null);
        setWalking(current=>current===walking?null:current);
        return;
      }
      const [a,b]=[step.from,step.to].map(value=>value.split(':').map(Number));
      const from=tile(a[0],a[1]),to=tile(b[0],b[1]);
      setWalkPose({officerId:walking.officerId,
        x:from.x+(to.x-from.x)*step.progress,
        y:from.y+(to.y-from.y)*step.progress,
        gridX:a[0],gridY:a[1],frame:step.frame});
      raf=window.requestAnimationFrame(tick);
    };
    raf=window.requestAnimationFrame(tick);
    return ()=>window.cancelAnimationFrame(raf);
  },[walking]);
  // Rule state persists the destination immediately. During animation, do
  // not reveal the destination ahead of the actually displayed officer.
  const renderedVision = walking && walkPose && fogBeforeWalk
    ? groundVisionCells(scene,units.map(unit =>
        walkPose.officerId===unit.id
          ? {x:walkPose.gridX,y:walkPose.gridY}
          : {x:unit.gridX,y:unit.gridY}))
    : fog.visible;
  const displayedFog = realtime && realtimeFog ? realtimeFog : walking && walkPose && fogBeforeWalk
    ? {visible:renderedVision,
       explored:new Set([...fogBeforeWalk.explored,...renderedVision])}
    : fog;
  const [additiveRoster, setAdditiveRoster] = useState(false);
  const selectedUnit = selected.length === 1 ? units.find(unit => unit.id === selected[0]) : null;
  const leaderUnit = units.find(unit => unit.id === selected[0]);
  // Follow the leading selected officer even when a dispersed group has moved
  // away from the separate first-person campaign anchor.
  const cameraCenter = leaderUnit
    ? !realtime && walkPose?.officerId===leaderUnit.id ? {x:walkPose.x,y:walkPose.y}
      : {x:leaderUnit.x,y:leaderUnit.y}
    : tile(position.x,position.y);
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches);
  const [followSquad, setFollowSquad] = useState(true);
  // Optional, camera-only inspection of a wide colony on portrait screens.
  // "Mapa completo" stays genuinely complete; sector views are explicit.
  const [overviewSector,setOverviewSector]=useState<'all'|'west'|'center'|'east'>('all');
  // The tactical SVG must match the actual, flex-sized viewport aspect.
  // Otherwise xMidYMid letterboxes the entire scene on wide desktop displays,
  // making both the buildings and the actual officer atlases look tiny.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({width:740,height:350});
  useEffect(() => {
    const element=viewportRef.current;
    if(!element)return;
    const update=()=>{
      const {width,height}=element.getBoundingClientRect();
      if(width<1||height<1)return;
      setViewportSize(previous=>
        Math.abs(previous.width-width)<1&&Math.abs(previous.height-height)<1
          ? previous : {width,height});
    };
    update();
    const observer=new ResizeObserver(update);
    observer.observe(element);
    return ()=>observer.disconnect();
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 520px)');
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  // Actual 18×12 canonical terrain is larger than the original 13×10
  // perimeter. Move the *camera frame*, not the ground projection / picking.
  const fullFrame=groundSurfaceFrame(scene.width,scene.height);
  const fullWidth=fullFrame.width, fullHeight=fullFrame.height;
  // Only offer a regional close-up where the squad has legitimately mapped
  // some ground. A wholly unknown sector would otherwise render as an empty
  // black viewport, misleading players into thinking the camera is broken.
  const sectorDiscovered=(lo:number,hi:number)=>
    [...displayedFog.explored].some(position=>{
      const x=Number(position.split(',')[0]);
      return Number.isFinite(x)&&x>=lo&&x<=hi;
    });
  const sectorMode=compact&&!followSquad&&overviewSector!=='all';
  const focused=compact&&followSquad;
  // Sector coordinates are *camera targets*, never newly revealed stations
  // or authored map geometry. Each uses only the existing canonical tile
  // projection and may be selected even while wholly unexplored.
  const sectorCenter=overviewSector==='west' ? tile(3,5)
    : overviewSector==='center' ? tile(8,5)
    : overviewSector==='east' ? tile(14,6) : cameraCenter;
  const viewCenter=sectorMode ? sectorCenter : cameraCenter;
  // Fill the *actual* map viewport, not a letterboxed preview.
  // "Mapa completo" remains an explicit, entirely un-cropped overview.
  const aspect = viewportSize.width / viewportSize.height;
  // Frame the *playable* surroundings, not almost the whole unknown board.
  // Keep the exact isometric projection/picking and separate complete overview.
  // Portrait retains enough lateral context to issue touch orders.
  const cameraHeight = focused||sectorMode
    ? 520
    : Math.max(330, Math.min(410, Math.round(viewportSize.height / 2.25)));
  const cameraWidth = Math.round(cameraHeight * aspect);
  const cameraX = cameraWidth >= fullWidth
    ? fullFrame.left+Math.round((fullWidth-cameraWidth)/2)
    : Math.max(fullFrame.left, Math.min(fullFrame.left+fullWidth-cameraWidth,
        Math.round(viewCenter.x-cameraWidth/2)));
  const cameraY = Math.max(fullFrame.top, Math.min(fullFrame.top+fullHeight-cameraHeight,
    Math.round(viewCenter.y-cameraHeight*.56)));
  const cameraView = !followSquad&&!sectorMode
    ? fullFrame.left+' '+fullFrame.top+' '+fullWidth+' '+fullHeight
    : cameraX+' '+cameraY+' '+cameraWidth+' '+cameraHeight;
  const [moveMode, setMoveMode] = useState(false);
  const [moveNotice, setMoveNotice] = useState('Selecciona un oficial o todo el equipo para dar una orden.');
  const [scienceNotice, setScienceNotice] = useState('Acerca un oficial a la sonda científica para investigarla.');
  const [medicalNotice, setMedicalNotice] = useState('Acerca un oficial al puesto de socorro para atender a los civiles.');
  const [perimeterNotice, setPerimeterNotice] = useState('Acerca un oficial a la baliza para establecer contacto.');
  const [lastNotice, setLastNotice] = useState<'move' | 'science' | 'medical' | 'perimeter'>('move');
  const probe = scene.objects.find(object => object.id === 'probe' && object.type === 'station');
  const probeAtHand = !!probe && !!selectedUnit &&
    Math.abs(selectedUnit.gridX - probe.x) + Math.abs(selectedUnit.gridY - probe.y) === 1;
  const reliefPoint = scene.objects.find(object =>
    object.id === 'relief-point' && object.type === 'station');
  const reliefAtHand = !!reliefPoint && !!selectedUnit &&
    Math.abs(selectedUnit.gridX - reliefPoint.x) + Math.abs(selectedUnit.gridY - reliefPoint.y) === 1;
  const uplink = scene.objects.find(object =>
    object.id === 'perimeter-uplink' && object.type === 'station');
  const perimeterAtHand = !!uplink && !!selectedUnit &&
    Math.abs(selectedUnit.gridX - uplink.x) + Math.abs(selectedUnit.gridY - uplink.y) === 1;
  const [keyboardCell, setKeyboardCell] = useState<Point>(() => ({x:position.x,y:position.y}));
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const screenRoster = () => {
    const root = svg.current;
    const matrix = root?.getScreenCTM();
    if (!root || !matrix) return null;
    return units.map(unit => {
      const point = root.createSVGPoint();
      point.x = walkPose?.officerId===unit.id ? walkPose.x : unit.x;
      point.y = walkPose?.officerId===unit.id ? walkPose.y : unit.y;
      const center = point.matrixTransform(matrix);
      return { id: unit.id, x: center.x, y: center.y, visible: true };
    });
  };

  // Pick the canonical ground grid through overlapping officer art, not from
  // the clicked decorative SVG element's identity.
  const pickGroundCell = (clientX: number, clientY: number): string | null => {
    const root = svg.current;
    const matrix = root?.getScreenCTM();
    if (!root || !matrix) return null;
    const pointer = root.createSVGPoint();
    pointer.x = clientX;
    pointer.y = clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    const u = (local.x - 440) / 40;
    const v = (local.y - 52) / 20;
    const x = Math.round((u + v) / 2);
    const y = Math.round((v - u) / 2);
    if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return null;
    const center = tile(x, y);
    if (Math.abs(local.x - center.x) / 40 + Math.abs(local.y - center.y) / 20 > 1) return null;
    return x + ',' + y;
  };
  const pickFreePoint=(clientX:number,clientY:number):Point|null=>{
    const root=svg.current,matrix=root?.getScreenCTM();
    if(!root||!matrix)return null;
    const p=root.createSVGPoint();p.x=clientX;p.y=clientY;
    const local=p.matrixTransform(matrix.inverse());
    const u=(local.x-440)/40,v=(local.y-52)/20;
    const x=(u+v)/2,y=(v-u)/2;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||
      x>scene.width-1||y>scene.height-1)return null;
    // At 390px, a full 18x12 overview grants only ~24 CSS px per tile.
    // A pointer aimed at its center may land 0.03-0.06 tiles off-center.
    // Quantize only near BOTH center axes; deliberate sub-cell clicks remain
    // fractional, and every destination still passes canonical pathfinding.
    const nearX=Math.round(x),nearY=Math.round(y);
    return Math.abs(x-nearX)<.09&&Math.abs(y-nearY)<.09
      ? {x:nearX,y:nearY} : {x,y};
  };
  const requestMove = (tileId: string | null, exact?:Point|null) => {
    if (!tileId || disabled) return;
    setLastNotice('move');
    setMoveMode(false);
    if (!selected.length) {
      setMoveNotice('Selecciona uno o varios oficiales antes de marchar.');
      return;
    }
    const [x,y] = tileId.split(',').map(Number);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || blocked.has(tileId) ||
        scene.objects.some(object => object.x === x && object.y === y)) {
      setMoveNotice('Casilla bloqueada u ocupada; el equipo no se mueve.');
      return;
    }
    if(realtime && selected.length!==1){
      setMoveNotice('Movimiento libre beta: selecciona un único oficial.');return;
    }
    const destination=realtime&&exact?exact:{x,y};
    if((!realtime && selected.length===squad.length && allowWholeMove &&
        x===position.x && y===position.y) ||
        (selected.length===1&&selectedUnit&&
         Math.hypot(selectedUnit.gridX-destination.x,selectedUnit.gridY-destination.y)<.025)){
      setMoveNotice('La selección ya está en ese punto.');return;
    }
    const outcome=onMove(destination,[...selected]);
    const success = typeof outcome==='boolean' ? outcome : outcome.moved;
    if(!realtime && success && typeof outcome!=='boolean' && outcome.path.length>1){
      setFogBeforeWalk(displayedFog);
      const path=outcome.path, first=path[0], last=walking?.path.at(-1);
      // Consecutive accepted commands for one officer append to the same
      // animation timeline. Never jump through a wall to the next command.
      if(walking?.officerId===outcome.officerId && last?.x===first.x && last.y===first.y){
        setWalking({...walking,path:[...walking.path,...path.slice(1)]});
      }else{
        setWalkPose({officerId:outcome.officerId,...tile(first.x,first.y),
          gridX:first.x,gridY:first.y,frame:0});
        setWalking({officerId:outcome.officerId,path,started:performance.now()});
      }
    }else if(success && !realtime){
      setWalking(null);setWalkPose(null);
    }
    const name = selected.length === 1 ? squad.find(officer => officer.id === selected[0])?.name :
      'Formación de ' + selected.length + ' oficiales';
    setMoveNotice(success ? name + (realtime?' en marcha hacia ':' en torno a ') +
      (realtime?destination.x.toFixed(1)+':'+destination.y.toFixed(1):x+':'+y) :
      'No existe una formación segura: casilla ocupada o destino bloqueado.');
  };
  const onBoardKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (disabled || !moveMode || event.altKey || event.ctrlKey || event.metaKey) return;
    const offsets: Record<string, [number,number]> = {
      ArrowUp:[0,-1], ArrowRight:[1,0], ArrowDown:[0,1], ArrowLeft:[-1,0],
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      requestMove(keyboardCell.x + ',' + keyboardCell.y);
    } else if (offsets[event.key]) {
      event.preventDefault();
      setKeyboardCell(cell => ({
        x: Math.max(0,Math.min(scene.width-1,cell.x+offsets[event.key][0])),
        y: Math.max(0,Math.min(scene.height-1,cell.y+offsets[event.key][1])),
      }));
    }
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    const target = (event.target as Element).closest('[data-officer-id]')?.getAttribute('data-officer-id') ?? null;
    const tileTarget = pickGroundCell(event.clientX, event.clientY);
    gesture.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      target,
      tile: tileTarget,
      additive: event.shiftKey,
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    const end = { x: event.clientX, y: event.clientY };
    gesture.current.dragged ||= isSelectionDrag(gesture.current.start, end);
    setMarquee(gesture.current.dragged
      ? { start: gesture.current.start, end } : null);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    setMarquee(null);
    const roster = screenRoster();
    if (!roster || disabled) return;
    const end = { x: event.clientX, y: event.clientY };
    if (!start.dragged && !isSelectionDrag(start.start, end) && moveMode && start.tile) {
      requestMove(start.tile,realtime?pickFreePoint(event.clientX,event.clientY):null);
      return;
    }
    if (start.dragged || isSelectionDrag(start.start, end))
      setSelected(previous => selectOfficerRectangle(roster, previous, start.start, end, start.additive));
    else
      setSelected(previous => selectOfficer(roster, previous, start.target, start.additive));
  };
  const cancelGesture = () => { gesture.current = null; setMarquee(null); };
  const rootBounds = svg.current?.getBoundingClientRect();
  const marqueeStyle = marquee && rootBounds ? {
    left: Math.min(marquee.start.x, marquee.end.x) - rootBounds.left,
    top: Math.min(marquee.start.y, marquee.end.y) - rootBounds.top,
    width: Math.abs(marquee.start.x - marquee.end.x),
    height: Math.abs(marquee.start.y - marquee.end.y),
  } : undefined;

  return <div className="ground-squad" data-testid="ground-squad-selection">
    {<div className="ground-squad-viewbar">
      <span>VISTA PLANETARIA · {followSquad ? 'SEGUIMIENTO'
        : sectorMode ? 'SECTOR '+overviewSector.toUpperCase() : 'MAPA COMPLETO'}{realtime?' · LIBRE BETA':''}</span>
      <button type="button" data-testid="ground-camera-toggle" aria-pressed={followSquad}
        onClick={() => { setFollowSquad(value => !value);setOverviewSector('all'); }}>
        {followSquad ? 'Mapa completo' : 'Seguir equipo'}
      </button>
      {compact&&!followSquad&&<label className="ground-squad-sector-picker">
        <span>Examinar</span>
        <select data-testid="ground-map-sector" aria-label="Examinar sector del mapa"
          value={overviewSector}
          onChange={event=>setOverviewSector(event.target.value as 'all'|'west'|'center'|'east')}>
          <option value="all">Todo el mapa</option>
          <option value="west">Zona oeste</option>
          <option value="center" disabled={!sectorDiscovered(7,11)}>
            Zona central
          </option>
          <option value="east" disabled={!sectorDiscovered(12,scene.width-1)}>
            Zona este
          </option>
        </select>
      </label>}
    </div>}
    <div className="ground-squad-viewport" ref={viewportRef}>
      <svg ref={svg} data-testid="ground-squad-board" viewBox={cameraView}
        className={focused ? 'ground-squad-board-focused' : undefined} tabIndex={0}
        preserveAspectRatio="xMidYMid meet" role="img" onKeyDown={onBoardKeyDown}
        aria-label="Vista elevada del puesto planetario, con los tres oficiales desplegados"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture} onContextMenu={event => {
          event.preventDefault();
          requestMove(pickGroundCell(event.clientX,event.clientY),
            realtime?pickFreePoint(event.clientX,event.clientY):null);
        }}>
        <defs>
          {/* One material coordinate system across the whole explored
              installation. Tile IDs and all movement math stay identical. */}
          <linearGradient id="ground-continuous-colony"
            gradientUnits="userSpaceOnUse" x1="210" y1="105" x2="870" y2="555">
            <stop stopColor="#71877b"/>
            <stop offset=".5" stopColor="#526e67"/>
            <stop offset="1" stopColor="#354f54"/>
          </linearGradient>
          <linearGradient id="ground-continuous-outside"
            gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="1180" y2="660">
            <stop stopColor="#66796b"/>
            <stop offset=".53" stopColor="#526a62"/>
            <stop offset="1" stopColor="#3b4d4b"/>
          </linearGradient>
          <linearGradient id="ground-continuous-wallstone"
            gradientUnits="userSpaceOnUse" x1="170" y1="175" x2="1120" y2="550">
            <stop stopColor="#354a4b"/>
            <stop offset="1" stopColor="#20383f"/>
          </linearGradient>
        </defs>
        {/* Give the entire visible world the EXACT same atmospheric material
            as undiscovered terrain. Otherwise the fog's outermost cells draw
            a giant board-shaped island against an unrelated backdrop. This is
            only a paint layer: known positions, picking and LOS are unchanged.
            The root gradient is defined in the fog layer below and uses the
            same user-space coordinates for every fragment. */}
        <rect data-testid="ground-fog-seamless-surround"
          x="-72" y="0" width="1280" height="640"
          fill="url(#ground-undiscovered-gradient)"
          pointerEvents="none" aria-hidden="true"/>
        {/* Draw the non-interactive planet ABOVE the opaque uniform fog
            undercoat but BELOW every canonical tile/unknown fog polygon.
            Previously the full-screen fog rect buried all authored cliffs,
            distant mountain layers and moon: a black floating board. No
            unpublished grid geometry or stations can show through fog. */}
        <GroundPlanetBackdrop />
        {/* Shared undercoat covers tiny raster seams between neighboring
            diamonds. This is *below* fog and authored scenery, and cannot
            reveal unseen objects or intercept a grid interaction. */}
        {(['colony','outside'] as const).map(area=><path key={area}
          data-testid={'ground-continuous-floor-'+area}
          d={sceneTiles.filter(cell=>!blocked.has(cell.key)&&
             (area==='outside' ? cell.x>=9||cell.y>=8
               : cell.x<9&&cell.y<8)).map(cellPath).join(' ')}
          fill={area==='outside'
            ? 'url(#ground-continuous-outside)'
            : 'url(#ground-continuous-colony)'}
          pointerEvents="none" aria-hidden="true"/>)}
        {sceneTiles.map(cell => <polygon key={cell.key}
          data-cell-id={cell.key} data-ground-material={blocked.has(cell.key)
            ? 'wallstone' : cell.x>=9||cell.y>=8 ? 'outside' : 'colony'}
          points={tileShape(cell.x, cell.y)}
          fill={floorMaterial(cell)}
          stroke="#b4c4ae" strokeOpacity=".025" strokeWidth=".8" />)}
        {/* The original 3D environment shares the EXACT canonical SVG
            projection and sits beneath gameplay decals and the authoritative
            fog; WebGL may fail without changing the playable board. */}
        <GroundLandingCourt3D explored={displayedFog.explored} visible={displayedFog.visible} />
        <GroundColonyFloor explored={displayedFog.explored} visible={displayedFog.visible} />
        {/* Optional world-space 3D volume: the SVG tiles/units remain authoritative,
            and the original vector architecture remains a graphics fallback. */}
        <GroundArchiveVolume3D explored={displayedFog.explored} visible={displayedFog.visible} />
        <GroundColonyWalls explored={displayedFog.explored} visible={displayedFog.visible} />
        <GroundColonyFixtures explored={displayedFog.explored} visible={displayedFog.visible} />
        <GroundWildSectorScenery explored={displayedFog.explored} visible={displayedFog.visible} />
        {/* One world-space material, rather than checkerboard colors per
            undiscovered tile. Fog is still derived ONLY from explored cells,
            never unseen walls, mission objects or combat data. */}
        <g data-testid="ground-fog-layer" pointerEvents="none">
          <defs>
            {/* One world-space atmospheric falloff shared by the outside
                planet AND every unrevealed tile. Soft central dusk light
                anchors the colony to a real landscape, while the untouched
                fully opaque fog still hides unknown stations and paths. */}
            <radialGradient id="ground-undiscovered-gradient"
              gradientUnits="userSpaceOnUse" cx="535" cy="265" r="790"
              gradientTransform="matrix(1 0 0 .82 0 30)">
              <stop stopColor="#324a48"/>
              <stop offset=".32" stopColor="#293f42"/>
              <stop offset=".7" stopColor="#182e35"/>
              <stop offset="1" stopColor="#0e222f"/>
            </radialGradient>
          </defs>
          {/* The compound silhouette is painted first, covering subpixel
              hairlines between neighboring diamonds with the SAME gradient.
              No second geometry, object or navigational cells are exposed. */}
          <path data-testid="ground-undiscovered-continuous-field"
            d={sceneTiles.filter(cell=>!displayedFog.explored.has(cell.key))
              .map(cell=>'M'+tileShape(cell.x,cell.y).trim()
                .replace(/\\s+/g,'L')+'Z').join(' ')}
            fill="url(#ground-undiscovered-gradient)"
            pointerEvents="none"/>
          {sceneTiles.filter(cell=>!displayedFog.visible.has(cell.key)).map(cell=>{
            const remembered=displayedFog.explored.has(cell.key);
            return <g key={cell.key} data-fog-terrain={cell.key}>
              <polygon data-fog-cell={cell.key}
                data-fog-state={remembered?'remembered':'unknown'}
                points={tileShape(cell.x,cell.y)}
                fill={remembered?'#25434a':'url(#ground-undiscovered-gradient)'}
                fillOpacity={remembered?.60:1}
                stroke="#8aaba4" strokeOpacity={remembered?.045:0}
                strokeWidth="1" />
            </g>;
          })}
        </g>
        {/* Continuous weather, not gameplay geography: these soft world-space
            bands cross both shrouded and discovered cells. They add atmosphere
            without exposing a wall, station or path before exploration. */}
        <g data-testid="ground-shared-atmospheric-haze"
          pointerEvents="none" aria-hidden="true">
          <defs>
            <radialGradient id="ground-haze-amber">
              <stop stopColor="#d9ac7c" stopOpacity=".16"/>
              <stop offset="1" stopColor="#d9ac7c" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="ground-haze-cold">
              <stop stopColor="#8cc6c4" stopOpacity=".13"/>
              <stop offset="1" stopColor="#8cc6c4" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <ellipse cx="714" cy="267" rx="450" ry="208"
            fill="url(#ground-haze-amber)"/>
          <ellipse cx="230" cy="480" rx="420" ry="176"
            fill="url(#ground-haze-cold)"/>
          <path d="M-72 538Q134 516 313 543T695 529T1128 542
            M-72 580Q108 556 332 585T745 574T1208 582"
            stroke="#a3c1b1" strokeOpacity=".07"
            strokeWidth="5" fill="none"/>
        </g>
        {/* Known elevated station equipment must remain above the ground
            fog: an unknown neighboring tile can cover its mast while leaving
            the high dish floating in empty sky. Each parent station already
            uses the canonical explored/visible sets to hide unknown targets
            and dim remembered ones; only its paint order changes. */}
        <GroundColonyStations explored={displayedFog.explored} visible={displayedFog.visible}
          labelFrame={focused?{left:cameraX,width:cameraWidth}:undefined} />
        {moveMode && <polygon data-testid="ground-keyboard-destination" points={tileShape(keyboardCell.x,keyboardCell.y)}
          fill="#e8d7a4" fillOpacity=".16" stroke="#e8ca82" strokeWidth="3" strokeDasharray="7 4"
          pointerEvents="none" />}
        {orderGroundOfficersByDepth(units, realtime?null:walkPose).map(unit => {
           // Keep fallback-uniform colours tied to identity, not painter order.
           const index = squad.findIndex(officer => officer.id === unit.id);
          const active = selected.includes(unit.id);
          const artReady = readyArt.has(unit.id);
          const artUrl = officerIdleArt[unit.id];
          const walkUrl = officerWalkArt[unit.id];
          const moving = realtime ? realtimeMovingIds.includes(unit.id) :
            walking?.officerId===unit.id && walkPose?.officerId===unit.id;
          const showWalk = moving && readyWalk.has(unit.id);
          const point = !realtime && walkPose?.officerId===unit.id
            ? {x:walkPose.x,y:walkPose.y} : unit;
          const frame = realtime ? Math.floor((unit.gridX+unit.gridY)*13)%12 :
            walkPose?.officerId===unit.id ? walkPose.frame : 0;
          // Camera-aligned identity plaques remain visual only; the original
          // player selection targets and projection are unchanged.
          const callSign=unit.name.split(' ')[0];
          const plateWidth=Math.max(36,callSign.length*7.5+18);
          const plateY=artReady||showWalk?-69:-40;
          return <g key={unit.id} data-testid={'ground-unit-' + unit.id}
            data-officer-id={unit.id} data-proj-x={point.x} data-proj-y={point.y}
            data-grid-x={Math.round(unit.gridX)} data-grid-y={Math.round(unit.gridY)}
            data-world-x={unit.gridX.toFixed(3)} data-world-y={unit.gridY.toFixed(3)}
            data-heading={unit.heading}
            data-walk-phase={moving?'moving':'idle'} data-walk-frame={frame}
            data-walk-atlas-ready={readyWalk.has(unit.id)}
            transform={'translate(' + point.x + ' ' + point.y + ')'}
            className={active ? 'ground-unit is-selected' : 'ground-unit'}>
            <circle r="27" cy="-7" fill="transparent" />
            <ellipse rx="18" ry="8" cy="10" fill="#081821" opacity=".85" />
            <ellipse rx="22" ry="10" cy="9" fill="none" stroke={active ? '#e8ca82' : '#69949b'}
              strokeWidth={active ? 3 : 1.5} />
            {/* Reduce art-only size to match the larger colony's building
                scale. Keep the world pivot, selection ring and tap hitbox in
                canonical coordinates; zoom, walking and grid picking stay
                unchanged. */}
            <g data-testid={'ground-officer-visible-art-'+unit.id}
              transform="translate(0 9) scale(.76) translate(0 -9)"
              pointerEvents="none">
            <g data-testid={'ground-officer-proxy-' + unit.id} opacity={artReady || showWalk ? 0 : 1}>
            <path d="M-12 3 L-10 -12 Q0 -20 10 -12 L12 3 Q0 10 -12 3Z"
              fill={['#9c6c4e','#607a87','#517c76'][index % 3]} stroke="#bbd0ca" strokeWidth="1.3" />
            <path d="M-7 -10 L0 -5 7 -10" fill="none" stroke="#ead7ab" strokeWidth="2" />
            <circle cx="0" cy="-18" r="8" fill="#d4ae8c" stroke="#e4c4a0" strokeWidth="1.2" />
            <path d="M-8 -18 Q-7 -30 2 -27 Q9 -25 8 -18 Q1 -23 -8 -18Z" fill="#28373b" />
            </g>
            {artUrl && <image data-testid={'ground-officer-sprite-' + unit.id}
              data-asset-state={artReady ? 'loaded' : 'fallback'}
              href={artUrl} x="-27" y="-72" width="54" height="80"
              preserveAspectRatio="xMidYMax meet" pointerEvents="none"
              opacity={artReady && !showWalk ? 1 : 0}
              onLoad={() => setReadyArt(previous => new Set(previous).add(unit.id))}
              onError={() => setReadyArt(previous => {
                if (!previous.has(unit.id)) return previous;
                const next = new Set(previous); next.delete(unit.id); return next;
              })} />}
            {showWalk && <foreignObject
              data-testid={'ground-officer-walk-'+unit.id}
              x="-27" y="-72" width="54" height="80" pointerEvents="none">
              <div aria-hidden="true" style={{
                width:'100%',height:'100%',
                backgroundImage:'url("'+walkUrl+'")',
                backgroundRepeat:'no-repeat',
                backgroundSize:(WALK_ATLAS.columns*100)+'% '+(WALK_ATLAS.rows*100)+'%',
                backgroundPosition:(frame%WALK_ATLAS.columns)*50+'% '+
                  Math.floor(frame/WALK_ATLAS.columns)*100+'%',
              }} />
            </foreignObject>}
            </g>
            {/* A stable, narrow selection silhouette. SVG <g> is not itself
                painted: its bounding-box midpoint otherwise falls through
                transparent R2 sprite pixels onto an underlying floor tile. The
                upper bound deliberately stops above the next officer's body
                in a stacked isometric column, avoiding false front-unit hits. */}
            <rect data-testid={'ground-officer-hit-'+unit.id}
              x="-18" y="-56" width="36" height="57" rx="7"
              fill="transparent" pointerEvents="all" />
            <g data-testid={'ground-officer-nameplate-'+unit.id}
              className="ground-officer-nameplate" pointerEvents="none"
              transform={'translate(0 '+plateY+')'}>
              <rect x={-plateWidth/2} y="-12" width={plateWidth} height="17" rx="3"
                fill="#0b1e2a" fillOpacity=".95"
                stroke={active?'#f0ca80':'#659aad'} strokeWidth="1"/>
              <path d="M-3.5 5L0 9L3.5 5" fill="#0b1e2a"
                stroke={active?'#f0ca80':'#659aad'} strokeWidth=".8"/>
              <text y="0" textAnchor="middle" className="ground-unit-name">{callSign}</text>
            </g>
          </g>;
        })}
      </svg>
      {marqueeStyle && <div data-testid="ground-selection-marquee" className="ground-selection-marquee" style={marqueeStyle} />}
    </div>
    {/* One canonical set of selection buttons. A desktop crew rail and a
        compact mobile row present the SAME state and IDs; never clone buttons
        (duplicated test IDs/focus targets would break keyboard and touch). */}
    <div className="ground-squad-crew-rail" data-testid="ground-crew-rail"
      role="group" aria-label="Oficiales desplegados">
      <div className="ground-squad-crew-heading" aria-hidden="true">
        <span>EQUIPO DE SUPERFICIE</span>
        <span>{selected.length}/{squad.length}</span>
      </div>
      <div className="ground-squad-crew-list">
        {squad.map(officer => {
          const unit = units.find(item => item.id === officer.id);
          const rank = OFFICERS.find(item => item.id === officer.id)?.rank;
          const isActive = selected.includes(officer.id);
          return <button key={officer.id} type="button"
            className="ground-squad-crew-entry" data-testid={'ground-select-' + officer.id}
            aria-pressed={isActive} disabled={disabled}
            onClick={() => setSelected(previous => selectOfficer(
              squad.map(item => ({ id: item.id, x: 0, y: 0, visible: true })),
              previous, officer.id, additiveRoster))}>
            <span className="ground-squad-crew-portrait" aria-hidden="true">
              <GroundCrewPortrait officerId={officer.id}/>
            </span>
            <span className="ground-squad-crew-copy">
              <strong>{officer.name}</strong>
              <small>{rank ?? 'Oficial'}{unit ? ' · ' + (realtime ?
                unit.gridX.toFixed(1)+':'+unit.gridY.toFixed(1) :
                unit.gridX+':'+unit.gridY) : ''}</small>
            </span>
            <span className="ground-squad-crew-indicator" aria-hidden="true">
              {isActive ? '◆' : '◇'}
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="ground-squad-toolbar" aria-label="Órdenes del equipo">
      <button type="button" data-testid="ground-select-all" disabled={disabled}
        aria-label="Todo el equipo" title="Seleccionar los tres oficiales"
        onClick={() => setSelected(squad.map(officer => officer.id))}>Todos</button>
      <button type="button" data-testid="ground-selection-additive" disabled={disabled}
        aria-label="Añadir selección" title="Activar selección múltiple"
        aria-pressed={additiveRoster} onClick={() => setAdditiveRoster(value => !value)}>
        {additiveRoster ? 'Sumar ✓' : 'Sumar'}
      </button>
      <button type="button" data-testid="ground-move-mode" aria-pressed={moveMode} disabled={disabled}
        aria-label={moveMode ? 'Cancelar movimiento' : 'Mover selección · tocar destino'}
        title="Ordenar movimiento tocando la casilla de destino"
        onClick={() => {
          setMoveMode(value => !value);
          setKeyboardCell(leaderUnit ? {x:leaderUnit.gridX,y:leaderUnit.gridY} : {x:position.x,y:position.y});
        }}>
        {moveMode ? 'Cancelar' : 'Mover'}
      </button>
      <button type="button" data-testid="ground-inspect-probe"
        disabled={disabled || !probeAtHand}
        aria-label={'Investigar sonda ' + (probeAtHand ? 'con ' + selectedUnit?.name : '· requiere proximidad')}
        title={probeAtHand ? 'Investigar con el oficial seleccionado' : 'Requiere un oficial adyacente a la sonda'}
        onClick={() => {
          if (!probeAtHand || !selectedUnit) return;
          setLastNotice('science');
          setScienceNotice(onInspectProbe(selectedUnit.id));
        }}>
        Sonda
      </button>
      <button type="button" data-testid="ground-assist-civilians"
        disabled={disabled || !reliefAtHand}
        aria-label={'Atender civiles ' + (reliefAtHand ? 'con ' + selectedUnit?.name : '· requiere proximidad')}
        title={reliefAtHand ? 'Atender civiles con el oficial seleccionado' : 'Requiere un oficial adyacente al puesto de socorro'}
        onClick={() => {
          if (!reliefAtHand || !selectedUnit) return;
          setLastNotice('medical');
          setMedicalNotice(onAssistCivilians(selectedUnit.id));
        }}>
        Civiles
      </button>
      {/* A sixth command only materializes when a *single* selected officer
          is physically adjacent to the real uplink. It is not an always-on
          fake button or a second copy of the classic camera controls. */}
      {perimeterAtHand && selectedUnit && <button type="button"
        data-testid="ground-perimeter-contact" disabled={disabled}
        aria-label={'Establecer contacto en la baliza con ' + selectedUnit.name}
        title="Abrir el encuentro táctico opcional desde este oficial"
        onClick={() => {
          setLastNotice('perimeter');
          setPerimeterNotice(onPerimeterContact(selectedUnit.id));
        }}>Baliza</button>}
    </div>
    <div className="ground-squad-event-strip" aria-label="Estado del equipo y órdenes">
    <p className="ground-squad-status" data-testid="ground-selection-status" role="status">
      {selected.length === 0 ? 'Ningún oficial seleccionado' :
        selected.length === squad.length ? 'Todo el equipo seleccionado' :
        selected.length + ' de ' + squad.length + ' oficiales seleccionados'}
    </p>
    <p className="ground-squad-notice-current" data-testid="ground-current-notice" aria-live="polite">
      {lastNotice === 'science' ? scienceNotice : lastNotice === 'medical' ? medicalNotice : lastNotice === 'perimeter' ? perimeterNotice : moveNotice}
    </p>
    {/* Keep existing semantic status IDs for live feedback and regression
        contracts, visually condensed into the single latest notice above. */}
    <p className="ground-squad-status ground-squad-announcement" data-testid="ground-move-status" role="status">{moveNotice}</p>
    <p className="ground-squad-status ground-squad-announcement" data-testid="ground-probe-status" role="status" aria-live="polite">{scienceNotice}</p>
    <p className="ground-squad-status ground-squad-announcement" data-testid="ground-medical-status" role="status" aria-live="polite">{medicalNotice}</p>
    <p className="ground-squad-status ground-squad-announcement" data-testid="ground-perimeter-status" role="status" aria-live="polite">{perimeterNotice}</p>
    </div>
    <details className="ground-squad-instructions">
      <summary>Controles y ayuda</summary>
      {onRealtimeToggle && <button type="button" className="ground-realtime-toggle"
        data-testid="ground-realtime-toggle" aria-pressed={realtime}
        disabled={disabled} onClick={event=>{
          onRealtimeToggle();
          // Disclosure must not cover/intercept ground picking after activation.
          event.currentTarget.closest('details')?.removeAttribute('open');
        }}>
        {realtime?'Volver al movimiento clásico':'Probar movimiento libre (beta)'}
      </button>}
      <p className="ground-squad-help">{realtime
        ? 'Beta: elige un oficial; clic derecho o Mover y tocar. Cambia destino durante la marcha. Volver al clásico descarta el recorrido de prueba.'
        : 'Prueba opcional: desplaza un oficial y cambia destino sin saltos. Las formaciones siguen en modo clásico.'}</p>
      <p className="ground-squad-help">Clic, Shift+clic o arrastrar para seleccionar.
      En móvil, activa «Sumar» y toca los nombres para crear un grupo.
      Clic derecho en el suelo: mueve un oficial o una formación de varios,
      sin apilar compañeros ni atravesar obstáculos.
      En móvil, «Mover selección» y tocar destino; con teclado, flechas y Enter.
      La niebla negra indica terreno desconocido; el terreno gris oscuro es un recuerdo
      y solo las casillas iluminadas están a la vista del equipo.
      La sonda científica y el puesto de socorro admiten acciones del oficial adyacente,
      usando su habilidad real. El archivo de sensores, el perímetro y el transporte
      todavía requieren la exploración clásica.</p>
    </details>
  </div>;
}
