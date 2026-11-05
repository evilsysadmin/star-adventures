
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import world from '../../../content/scenes/meridian.json';
import r2Assets from '../assets/r2-assets-manifest.json';
import { GroundPlanetBackdrop, GroundOutpostLandmarks } from './GroundOutpostScenery';
import { officerRouteStepAt } from '../isoOfficerAnimation';
import { WALK_ATLAS } from '../tacticalAnimation';
import { isSelectionDrag, selectOfficer, selectOfficerRectangle } from '../../../src/tacticalSelection.mjs';
import './groundSquadSelection.css';

type Officer = { id: string; name: string };
type Point = { x: number; y: number };
type GroundMoveResult = boolean | { moved: boolean; officerId: string; path: Point[] };
type WalkSession = {officerId:string; path:Point[]; started:number};
type WalkPose = {officerId:string; x:number; y:number; frame:number};
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
// Paths between authored facilities are only painted terrain, never a
// movement shortcut or a substitute for the canonical walkability grid.
const wornPath = new Set(['4,5','4,4','4,3','3,3','2,3','5,4','5,5','6,5']);
const sceneTiles = Array.from({ length: scene.height }, (_, y) =>
  Array.from({ length: scene.width }, (_, x) => ({ x, y, key: x + ',' + y }))).flat();

export function GroundSquadSelection({
  squad, position, officers, onMove, onInspectProbe, onAssistCivilians, allowWholeMove, disabled = false,
}: {
  squad: Officer[];
  position: { x: number; y: number };
  officers: Array<{id: string; x: number; y: number; heading: string}>;
  onMove: (target: Point, selection: string[]) => GroundMoveResult;
  onInspectProbe: (officerId: string) => string;
  onAssistCivilians: (officerId: string) => string;
  allowWholeMove: boolean;
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
  const [walking, setWalking] = useState<WalkSession | null>(null);
  const [walkPose, setWalkPose] = useState<WalkPose | null>(null);
  useEffect(() => {
    if(!walking) return;
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
        y:from.y+(to.y-from.y)*step.progress,frame:step.frame});
      raf=window.requestAnimationFrame(tick);
    };
    raf=window.requestAnimationFrame(tick);
    return ()=>window.cancelAnimationFrame(raf);
  },[walking]);
  const [additiveRoster, setAdditiveRoster] = useState(false);
  const selectedUnit = selected.length === 1 ? units.find(unit => unit.id === selected[0]) : null;
  const leaderUnit = units.find(unit => unit.id === selected[0]);
  // Follow the leading selected officer even when a dispersed group has moved
  // away from the separate first-person campaign anchor.
  const cameraCenter = leaderUnit
    ? walkPose?.officerId===leaderUnit.id ? {x:walkPose.x,y:walkPose.y}
      : {x:leaderUnit.x,y:leaderUnit.y}
    : tile(position.x,position.y);
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches);
  const [followSquad, setFollowSquad] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 520px)');
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  // Follow the selected officer on phones; the complete map stays one tap away.
  const focused = compact && followSquad;
  const focusX = Math.max(0, Math.min(900 - 440, Math.round(cameraCenter.x - 220)));
  const focusY = Math.max(0, Math.min(430 - 300, Math.round(cameraCenter.y - 150)));
  const cameraView = focused ? focusX + ' ' + focusY + ' 440 300' :
    compact ? '0 0 900 430' : '80 48 740 350';
  const [moveMode, setMoveMode] = useState(false);
  const [moveNotice, setMoveNotice] = useState('Selecciona un oficial o todo el equipo para dar una orden.');
  const [scienceNotice, setScienceNotice] = useState('Acerca un oficial a la sonda científica para investigarla.');
  const [medicalNotice, setMedicalNotice] = useState('Acerca un oficial al puesto de socorro para atender a los civiles.');
  const probe = scene.objects.find(object => object.id === 'probe' && object.type === 'station');
  const probeAtHand = !!probe && !!selectedUnit &&
    Math.abs(selectedUnit.gridX - probe.x) + Math.abs(selectedUnit.gridY - probe.y) === 1;
  const reliefPoint = scene.objects.find(object =>
    object.id === 'relief-point' && object.type === 'station');
  const reliefAtHand = !!reliefPoint && !!selectedUnit &&
    Math.abs(selectedUnit.gridX - reliefPoint.x) + Math.abs(selectedUnit.gridY - reliefPoint.y) === 1;
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
  const requestMove = (tileId: string | null) => {
    if (!tileId || disabled) return;
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
    if ((selected.length === squad.length && allowWholeMove && x === position.x && y === position.y) ||
        (selected.length === 1 && selectedUnit?.gridX === x && selectedUnit?.gridY === y)) {
      setMoveNotice('La selección ya está en esa casilla.');
      return;
    }
    const outcome = onMove({x,y}, [...selected]);
    const success = typeof outcome==='boolean' ? outcome : outcome.moved;
    if(success && typeof outcome!=='boolean' && outcome.path.length>1){
      const path=outcome.path, first=path[0], last=walking?.path.at(-1);
      // Consecutive accepted commands for one officer append to the same
      // animation timeline. Never jump through a wall to the next command.
      if(walking?.officerId===outcome.officerId && last?.x===first.x && last.y===first.y){
        setWalking({...walking,path:[...walking.path,...path.slice(1)]});
      }else{
        setWalkPose({officerId:outcome.officerId,...tile(first.x,first.y),frame:0});
        setWalking({officerId:outcome.officerId,path,started:performance.now()});
      }
    }else if(success){
      setWalking(null);setWalkPose(null);
    }
    const name = selected.length === 1 ? squad.find(officer => officer.id === selected[0])?.name :
      'Formación de ' + selected.length + ' oficiales';
    setMoveNotice(success ? name + ' en torno a ' + x + ':' + y :
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
      requestMove(start.tile);
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
    {compact && <div className="ground-squad-viewbar">
      <span>VISTA PLANETARIA · {focused ? 'SEGUIMIENTO' : 'MAPA COMPLETO'}</span>
      <button type="button" data-testid="ground-camera-toggle" aria-pressed={focused}
        onClick={() => setFollowSquad(value => !value)}>
        {focused ? 'Mapa completo' : 'Seguir equipo'}
      </button>
    </div>}
    <div className="ground-squad-viewport">
      <svg ref={svg} data-testid="ground-squad-board" viewBox={cameraView}
        className={focused ? 'ground-squad-board-focused' : undefined} tabIndex={0}
        preserveAspectRatio="xMidYMid meet" role="img" onKeyDown={onBoardKeyDown}
        aria-label="Vista elevada del puesto planetario, con los tres oficiales desplegados"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture} onContextMenu={event => {
          event.preventDefault();
          requestMove(pickGroundCell(event.clientX, event.clientY));
        }}>
        <GroundPlanetBackdrop />
        {sceneTiles.map(cell => <polygon key={cell.key} data-cell-id={cell.key} points={tileShape(cell.x, cell.y)}
          fill={blocked.has(cell.key) ? '#1b3138' : wornPath.has(cell.key) ? '#5a6b5d' :
            (cell.x*7+cell.y*11)%5===0 ? '#51675f' : (cell.x+cell.y)%2 ? '#3e5751' : '#435d55'}
          stroke="#a8b6a1" strokeOpacity=".13" strokeWidth="1" />)}
        {scene.walls.filter(cell => cell.x > 0 && cell.y > 0 &&
          cell.x < scene.width - 1 && cell.y < scene.height - 1).map(cell => {
            const p = tile(cell.x, cell.y);
            return <g key={cell.x + ',' + cell.y} transform={'translate(' + p.x + ' ' + p.y + ')'} pointerEvents="none">
              <path d="M-31 0 L0 -15 31 0 0 15Z" fill="#52615c" />
              <path d="M-31 0 L0 15 V-15 L-31 -27Z" fill="#293c42" />
              <path d="M0 15 L31 0 V-27 L0 -15Z" fill="#1a2b34" />
            </g>;
          })}
        <GroundOutpostLandmarks />
        {moveMode && <polygon data-testid="ground-keyboard-destination" points={tileShape(keyboardCell.x,keyboardCell.y)}
          fill="#e8d7a4" fillOpacity=".16" stroke="#e8ca82" strokeWidth="3" strokeDasharray="7 4"
          pointerEvents="none" />}
        {units.map((unit, index) => {
          const active = selected.includes(unit.id);
          const artReady = readyArt.has(unit.id);
          const artUrl = officerIdleArt[unit.id];
          const walkUrl = officerWalkArt[unit.id];
          const moving = walking?.officerId===unit.id && walkPose?.officerId===unit.id;
          const showWalk = moving && readyWalk.has(unit.id);
          const point = moving ? {x:walkPose.x,y:walkPose.y} : unit;
          const frame = moving ? walkPose.frame : 0;
          return <g key={unit.id} data-testid={'ground-unit-' + unit.id}
            data-officer-id={unit.id} data-proj-x={point.x} data-proj-y={point.y}
            data-grid-x={unit.gridX} data-grid-y={unit.gridY} data-heading={unit.heading}
            data-walk-phase={moving?'moving':'idle'} data-walk-frame={frame}
            transform={'translate(' + point.x + ' ' + point.y + ')'}
            className={active ? 'ground-unit is-selected' : 'ground-unit'}>
            <circle r="27" cy="-7" fill="transparent" />
            <ellipse rx="18" ry="8" cy="10" fill="#081821" opacity=".85" />
            <ellipse rx="22" ry="10" cy="9" fill="none" stroke={active ? '#e8ca82' : '#69949b'}
              strokeWidth={active ? 3 : 1.5} />
            <g data-testid={'ground-officer-proxy-' + unit.id} opacity={artReady || showWalk ? 0 : 1}>
            <path d="M-12 3 L-10 -12 Q0 -20 10 -12 L12 3 Q0 10 -12 3Z"
              fill={['#9c6c4e','#607a87','#517c76'][index % 3]} stroke="#bbd0ca" strokeWidth="1.3" />
            <path d="M-7 -10 L0 -5 7 -10" fill="none" stroke="#ead7ab" strokeWidth="2" />
            <circle cx="0" cy="-18" r="8" fill="#d4ae8c" stroke="#e4c4a0" strokeWidth="1.2" />
            <path d="M-8 -18 Q-7 -30 2 -27 Q9 -25 8 -18 Q1 -23 -8 -18Z" fill="#28373b" />
            </g>
            {artUrl && <image data-testid={'ground-officer-sprite-' + unit.id}
              data-asset-state={artReady ? 'loaded' : 'fallback'}
              href={artUrl} x="-25" y="-65" width="50" height="73"
              preserveAspectRatio="xMidYMax meet" pointerEvents="none"
              opacity={artReady && !showWalk ? 1 : 0}
              onLoad={() => setReadyArt(previous => new Set(previous).add(unit.id))}
              onError={() => setReadyArt(previous => {
                if (!previous.has(unit.id)) return previous;
                const next = new Set(previous); next.delete(unit.id); return next;
              })} />}
            {walkUrl && <image href={walkUrl} x="-95" y="-95" width="1" height="1"
              opacity="0" pointerEvents="none"
              onLoad={() => setReadyWalk(previous => new Set(previous).add(unit.id))}
              onError={() => setReadyWalk(previous => {
                if(!previous.has(unit.id)) return previous;
                const next=new Set(previous);next.delete(unit.id);return next;
              })} />}
            {showWalk && <svg data-testid={'ground-officer-walk-'+unit.id}
              x="-25" y="-65" width="50" height="73" pointerEvents="none"
              preserveAspectRatio="none"
              viewBox={((frame%WALK_ATLAS.columns)*100)+' '+(Math.floor(frame/WALK_ATLAS.columns)*100)+' 100 100'}>
              <image href={walkUrl} x="0" y="0"
                width={WALK_ATLAS.columns*100} height={WALK_ATLAS.rows*100}
                preserveAspectRatio="none" pointerEvents="none" />
            </svg>}
            <text y={artReady || showWalk ? '-65' : '-37'} textAnchor="middle" className="ground-unit-name">{unit.name.split(' ')[0]}</text>
          </g>;
        })}
      </svg>
      {marqueeStyle && <div data-testid="ground-selection-marquee" className="ground-selection-marquee" style={marqueeStyle} />}
    </div>
    <div className="ground-squad-toolbar" aria-label="Selección de equipo">
      {squad.map(officer =>
        <button key={officer.id} type="button" data-testid={'ground-select-' + officer.id}
          aria-pressed={selected.includes(officer.id)} disabled={disabled}
          onClick={() => setSelected(previous => selectOfficer(
            squad.map(item => ({ id: item.id, x: 0, y: 0, visible: true })),
            previous, officer.id, additiveRoster))}>
          {officer.name}
        </button>)}
      <button type="button" data-testid="ground-select-all" disabled={disabled}
        onClick={() => setSelected(squad.map(officer => officer.id))}>Todo el equipo</button>
      <button type="button" data-testid="ground-selection-additive" disabled={disabled}
        aria-pressed={additiveRoster} onClick={() => setAdditiveRoster(value => !value)}>
        {additiveRoster ? 'Añadir: activo' : 'Añadir selección'}
      </button>
      <button type="button" data-testid="ground-move-mode" aria-pressed={moveMode} disabled={disabled}
        onClick={() => {
          setMoveMode(value => !value);
          setKeyboardCell(leaderUnit ? {x:leaderUnit.gridX,y:leaderUnit.gridY} : {x:position.x,y:position.y});
        }}>
        {moveMode ? 'Cancelar movimiento' : 'Mover selección · tocar destino'}
      </button>
      <button type="button" data-testid="ground-inspect-probe"
        disabled={disabled || !probeAtHand}
        onClick={() => {
          if (!probeAtHand || !selectedUnit) return;
          setScienceNotice(onInspectProbe(selectedUnit.id));
        }}>
        Investigar sonda {probeAtHand ? '· ' + selectedUnit.name.split(' ')[0] : '· requiere proximidad'}
      </button>
      <button type="button" data-testid="ground-assist-civilians"
        disabled={disabled || !reliefAtHand}
        onClick={() => {
          if (!reliefAtHand || !selectedUnit) return;
          setMedicalNotice(onAssistCivilians(selectedUnit.id));
        }}>
        Atender civiles {reliefAtHand ? '· ' + selectedUnit.name.split(' ')[0] : '· requiere proximidad'}
      </button>
    </div>
    <p className="ground-squad-status" data-testid="ground-selection-status" role="status">
      {selected.length === 0 ? 'Ningún oficial seleccionado' :
        selected.length === squad.length ? 'Todo el equipo seleccionado' :
        selected.length + ' de ' + squad.length + ' oficiales seleccionados'}
    </p>
    <p className="ground-squad-status" data-testid="ground-move-status" role="status">{moveNotice}</p>
    <p className="ground-squad-status" data-testid="ground-probe-status" role="status" aria-live="polite">{scienceNotice}</p>
    <p className="ground-squad-status" data-testid="ground-medical-status" role="status" aria-live="polite">{medicalNotice}</p>
    <details className="ground-squad-instructions">
      <summary>Controles y ayuda</summary>
      <p className="ground-squad-help">Clic, Shift+clic o arrastrar para seleccionar.
      En móvil, activa «Añadir selección» y toca los nombres para crear un grupo.
      Clic derecho en el suelo: mueve un oficial o una formación de varios,
      sin apilar compañeros ni atravesar obstáculos.
      En móvil, «Mover selección» y tocar destino; con teclado, flechas y Enter.
      La sonda científica y el puesto de socorro admiten acciones del oficial adyacente,
      usando su habilidad real. El archivo de sensores, el perímetro y el transporte
      todavía requieren la exploración clásica.</p>
    </details>
  </div>;
}
