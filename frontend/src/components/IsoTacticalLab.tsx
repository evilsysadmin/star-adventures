import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as THREE from 'three';
import assets from '../assets/r2-assets-manifest.json';
import { cells, cellCenter, pickCell, type Cell } from '../tacticalGrid';
import { createIsoCamera } from '../tacticalIsoCamera';
import { createIsoDetailCamera } from '../tacticalIsoFocus';
import { WALK_ATLAS, FIRE_ATLAS, walkFrameUv } from '../tacticalAnimation';
import { isoFireFrame, nextFireReviewFrame } from '../isoFirePlayback';
import { isoOfficerFrame } from '../isoOfficerAnimation';
import { evaluatePracticeShot } from '../isoTrainingLineOfSight';
import { IsoAtlasMagnifier } from './IsoAtlasMagnifier';
import { TRAINING_START, planTrainingMove, commitTrainingMove, type TrainingUnit } from '../isoTrainingMovement';
import './isoTacticalLab.css';

const cover = new Set(['3:3', '4:3']);
const deployments = [
  { id:'science' as const, sex:'female', label:'Oficial científica' },
  { id:'security' as const, sex:'male', label:'Oficial de seguridad' },
  { id:'medic' as const, sex:'female', label:'Médica' },
] as const;
type Motion = { unitId: TrainingUnit['id']; cells: readonly string[]; start: number | null };
type FireMotion = { unitId: TrainingUnit['id']; sex: 'female' | 'male'; start: number | null; review: boolean; frame: number };
const STEP_MS = 360;
const targets = ['6:2', '6:5'] as const;
const femaleUrl = assets.assets['starAdventures.tactical.officerFemaleWalkV1'].url;
const maleUrl = assets.assets['starAdventures.tactical.officerMaleWalkV1'].url;
const fireUrls = {
  female: assets.assets['starAdventures.tactical.officerFemaleFireV1'].url,
  male: assets.assets['starAdventures.tactical.officerMaleFireV1'].url,
} as const;
const aegisRaiderUrl = assets.assets['starAdventures.tactical.aegisRaiderIdleV1'].url;
const veilAgentUrl = assets.assets['starAdventures.tactical.veilAgentIdleV1'].url;
const cellFromId = (id: string) => {
  const [col, row] = id.split(':').map(Number);
  return cellCenter({ col, row });
};
const initial: Cell = { col: 0, row: 0, id: '0:0' };

export function IsoTacticalLab() {
  const host = useRef<HTMLDivElement>(null);
  const cameraRefresh = useRef<((focus: boolean, cell: Cell) => void) | null>(null);
  const currentView = useRef({ focus: false, cell: initial });
  const selection = useRef<THREE.Object3D | null>(null);
  const aimVisual = useRef<THREE.Line | null>(null);
  const animateEnabled = useRef(true);
  const unitsVisual = useRef(new Map<string, { sprite: THREE.Sprite; shadow: THREE.Mesh }>());
  const routeVisual = useRef(new Map<string, THREE.Mesh>());
  const moveRef = useRef<Motion | null>(null);
  const fireRef = useRef<FireMotion | null>(null);
  const fireRequest = useRef<((unitId: TrainingUnit['id']) => void) | null>(null);
  const fireStepRequest = useRef<(() => void) | null>(null);
  const reviewEnabled = useRef(false);
  const committed = useRef(TRAINING_START);
  // Pointer listeners are mounted only once; read the current squad instead of
  // closing over a stale initial placement after any training movement.
  const latestSquad = useRef({ units: TRAINING_START, moving: false });
  const [active, setActive] = useState<Cell>(initial);
  const [detail, setDetail] = useState(false);
  useEffect(() => {
    currentView.current = {focus:detail,cell:active};
    cameraRefresh.current?.(detail, active);
  }, [detail,active]);
  const [playing, setPlaying] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const [units, setUnits] = useState(TRAINING_START);
  const [officer, setOfficer] = useState<TrainingUnit['id']>('science');
  const [moving, setMoving] = useState(false);
  const [firing, setFiring] = useState(false);
  const [review, setReview] = useState(false);
  const [reviewFrame, setReviewFrame] = useState<number | null>(null);
  const [fireReport, setFireReport] = useState('Sin disparos. Selecciona un blanco despejado.');
  const [motionInfo, setMotionInfo] = useState('Selecciona un oficial y una casilla libre para ensayar su recorrido.');
  const [assetStatus, setAssetStatus] = useState('Conectando con los atlas originales en R2…');
  const [rendererStatus, setRendererStatus] = useState<string | null>(null);
  useEffect(() => { latestSquad.current = { units, moving }; }, [units,moving]);

  const path = moving || firing ? null : planTrainingMove(units, officer, active.id);
  const aim = !moving && targets.includes(active.id as typeof targets[number])
    ? evaluatePracticeShot(units, officer, active.id) : null;
  const aimMessage = !aim ? 'Selecciona uno de los dos blancos geométricos para ver la línea de tiro.' :
    aim.allowed ? `Blanco ${active.id} visible: línea despejada. Puedes probar el atlas de disparo original. Sin daños ni impactos.` :
    aim.reason === 'cover-blocked' ? `Tiro bloqueado por cobertura en ${aim.blocker}.` :
    aim.reason === 'ally-blocked' ? `Tiro bloqueado: compañero en ${aim.blocker}.` :
    aim.reason === 'out-of-range' ? 'Blanco fuera del alcance de entrenamiento.' :
    'Blanco no autorizado para el ensayo.';
  useEffect(() => {
    const line=aimVisual.current;
    if(!line) return;
    line.visible=!!aim;
    if(!aim) return;
    const unit=units.units.find(item=>item.id===officer)!;
    const start=cellFromId(unit.cell);
    const end=cellFromId(aim.blocker ?? active.id);
    line.geometry.dispose();
    line.geometry=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x,1.28,start.z),
      new THREE.Vector3(end.x,.83,end.z),
    ]);
    (line.material as THREE.LineDashedMaterial).color.set(aim.allowed ? '#75eacb' : '#f1a573');
    line.computeLineDistances();
  }, [active.id,officer,units,moving]);
  useEffect(() => { animateEnabled.current = playing; }, [playing]);
  useEffect(() => {
    for (const [cellId, tile] of routeVisual.current)
      tile.visible = !moving && !!path && path.cells.length > 1 && path.cells.includes(cellId);
  }, [active.id, officer, moving, units]);
  useEffect(() => {
    if (moveRef.current) return;
    for (const unit of units.units) {
      const visual = unitsVisual.current.get(unit.id);
      if (!visual) continue;
      const p = cellFromId(unit.cell);
      visual.sprite.position.set(p.x, .13, p.z);
      visual.shadow.position.set(p.x, .105, p.z);
    }
  }, [units]);
  useEffect(() => {
    if (!selection.current) return;
    const p = cellCenter(active);
    selection.current.position.set(p.x, 0.21, p.z);
  }, [active]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setRendererStatus('WebGL no disponible. Sigue operativo el selector accesible de 64 casillas.');
      return;
    }
    const canvas = renderer.domElement;
    canvas.setAttribute('data-testid', 'iso-render-canvas');
    canvas.setAttribute('aria-label', 'Escena táctica isométrica con tres oficiales y dos blancos de entrenamiento');
    canvas.setAttribute('role', 'img');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07121d');
    const ambience = new THREE.AmbientLight('#a9cae8', 1.3); scene.add(ambience);
    const sun = new THREE.DirectionalLight('#e4c99d', 2.8);
    sun.position.set(-4, 9, 3); scene.add(sun);
    const fill = new THREE.DirectionalLight('#4dd2ce', 1.3);
    fill.position.set(4, 3, -4); scene.add(fill);

    const meshes: THREE.Object3D[] = [];
    const add = (mesh: THREE.Object3D) => { scene.add(mesh); meshes.push(mesh); return mesh; };
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, .46, 8.6),
      new THREE.MeshStandardMaterial({ color: '#102d3b', metalness: .46, roughness: .64 })
    );
    platform.position.y = -.31; add(platform);
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(platform.geometry),
      new THREE.LineBasicMaterial({ color: '#b9a26e', transparent: true, opacity: .72 })
    );
    rim.position.copy(platform.position); add(rim);
    for (const cell of cells()) {
      const elevated = cover.has(cell.id);
      const base = (cell.col + cell.row) % 2 === 0 ? '#204658' : '#183646';
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(.965, elevated ? .48 : .14, .965),
        new THREE.MeshStandardMaterial({
          color: elevated ? '#716b56' : base, roughness: .82, metalness: .11,
        })
      );
      const pos = cellCenter(cell);
      tile.position.set(pos.x, elevated ? .21 : .02, pos.z);
      add(tile);
      if (elevated) {
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(tile.geometry),
          new THREE.LineBasicMaterial({ color: '#d4b17f', transparent: true, opacity: .78 })
        );
        edge.position.copy(tile.position); add(edge);
      }
    }
    const routeCells = new Map<string, THREE.Mesh>();
    const routeShape = new THREE.CircleGeometry(.29, 22);
    for (const cell of cells()) {
      const tile = new THREE.Mesh(
        routeShape,
        new THREE.MeshBasicMaterial({ color:'#81e6c2', transparent:true, opacity:.54,
          depthWrite:false, depthTest:true, side:THREE.DoubleSide })
      );
      const p = cellCenter(cell);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(p.x, .119, p.z);
      tile.visible = false;
      add(tile);
      routeCells.set(cell.id, tile);
    }
    routeVisual.current = routeCells;
    const beam=new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,.1,0)]),
      new THREE.LineDashedMaterial({color:'#75eacb',dashSize:.16,gapSize:.10,
        depthTest:false,transparent:true,opacity:.95})
    );
    beam.visible=false;
    beam.renderOrder=55;
    add(beam);
    aimVisual.current=beam;
    const marker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(.98, .17, .98)),
      new THREE.LineBasicMaterial({ color: '#ffdf92', depthTest: false })
    );
    marker.renderOrder = 50;
    add(marker);
    selection.current = marker;
    const start = cellCenter(initial);
    marker.position.set(start.x, .21, start.z);

    // Target cells retain their authored geometry for sight/range rules; their visible
    // occupants are original R2 hostile sprites loaded below.
    for (const id of targets) {
      const center = cellFromId(id);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(.39, 24),
        new THREE.MeshBasicMaterial({ color: '#e4946f', transparent: true, opacity: .19, depthWrite: false })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(center.x, .106, center.z); add(ground);
    }

    let camera = createIsoCamera(1);
    const render = () => renderer.render(scene, camera);
    const atlasTextures: THREE.Texture[] = [];
    const unitTextures = new Map<string, THREE.Texture>();
    const fireAtlases = new Map<'female'|'male', THREE.Texture>();
    let loadingFire = false;
    const lastFrames = new Map<string, number>();
    const loader = new THREE.TextureLoader();
    const textures: Record<string, THREE.Texture> = {};
    let settled = 0;
    let succeeded = 0;
    let disposed = false;
    const finishAsset = (success: boolean) => {
      if (disposed) return;
      settled += 1;
      if (success) succeeded += 1;
      setAssetStatus(settled === 4
        ? `Atlas R2 reales: ${succeeded}/4 cargados${succeeded !== 4 ? ' · fichas geométricas de reserva' : ''}`
        : `Cargando atlas R2: ${settled}/4…`);
      render();
    };
    for (const [sex, url] of [['female', femaleUrl], ['male', maleUrl]] as const) {
      // Fetch only TWO source WebPs from R2. Once each one is decoded, clone its
      // texture for each matching officer, so UV offsets never bleed across units.
      const tex = loader.load(url, loaded => {
        if (disposed) return;
        for (const unit of deployments.filter(unit => unit.sex === sex)) {
          const visual = unitsVisual.current.get(unit.id);
          if (!visual) continue;
          const isolated = loaded.clone();
          isolated.repeat.set(1 / WALK_ATLAS.columns, 1 / WALK_ATLAS.rows);
          isolated.offset.set(walkFrameUv(0).x, walkFrameUv(0).y);
          isolated.needsUpdate = true;
          unitTextures.set(unit.id, isolated);
          atlasTextures.push(isolated);
          visual.sprite.material.map = isolated;
          visual.sprite.material.needsUpdate = true;
          lastFrames.delete(unit.id);
        }
        finishAsset(true);
      }, undefined, () => finishAsset(false));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(1 / WALK_ATLAS.columns, 1 / WALK_ATLAS.rows);
      tex.offset.set(walkFrameUv(0).x, walkFrameUv(0).y);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      textures[sex] = tex;
      atlasTextures.push(tex);
    }
    const hostileAssets = [
      { id: '6:2', name: 'Incursor Aegis', url: aegisRaiderUrl, scale: [1.64, 2.52] as const },
      { id: '6:5', name: 'Agente Velo', url: veilAgentUrl, scale: [1.46, 2.34] as const },
    ];
    for (const hostile of hostileAssets) {
      const p = cellFromId(hostile.id);
      const texture = loader.load(hostile.url, loaded => {
        if (disposed) return;
        const isolated = loaded.clone();
        isolated.repeat.set(1 / WALK_ATLAS.columns, 1 / WALK_ATLAS.rows);
        isolated.offset.set(walkFrameUv(0).x, walkFrameUv(0).y);
        isolated.needsUpdate = true;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: isolated, transparent: true, depthWrite: false, alphaTest: .06 }));
        sprite.name = hostile.name;
        sprite.center.set(.5, 0);
        sprite.scale.set(hostile.scale[0], hostile.scale[1], 1);
        sprite.position.set(p.x, .13, p.z);
        add(sprite); atlasTextures.push(isolated);
        finishAsset(true);
      }, undefined, () => finishAsset(false));
      texture.colorSpace = THREE.SRGBColorSpace;
      atlasTextures.push(texture);
    }

    fireStepRequest.current = () => {
      const burst=fireRef.current;
      if (!burst || !burst.review || disposed) return;
      const next=nextFireReviewFrame(burst.frame);
      burst.frame=next === null ? FIRE_ATLAS.frames : next;
      setReviewFrame(next);
    };
    const showFire = (unitId: TrainingUnit['id']) => {
      if (disposed || loadingFire || fireRef.current || moveRef.current) return;
      const deploy=deployments.find(unit=>unit.id===unitId);
      if(!deploy || !unitTextures.has(unitId)) return;
      const sex=deploy.sex;
      const start=() => {
        if(disposed) return;
        loadingFire=false;
        const manual=reviewEnabled.current;
        fireRef.current={unitId,sex,start:null,review:manual,frame:0};
        setReviewFrame(manual ? 0 : null);
        setFiring(true);
        setFireReport(`${manual ? 'Inspeccionando' : 'Reproduciendo'} disparo original de ${deploy.label}. No registra impactos.`);
      };
      if(fireAtlases.has(sex)){start();return;}
      loadingFire=true;
      setFiring(true);
      setFireReport(`Cargando atlas de disparo R2 de ${deploy.label}…`);
      const tex=loader.load(fireUrls[sex],()=>{
        if(disposed)return;
        fireAtlases.set(sex,tex);
        start();
      },undefined,()=>{
        if(disposed)return;
        loadingFire=false;
        setFiring(false);
        setFireReport(`No se pudo cargar el atlas de disparo de ${deploy.label}; no se ha simulado ningún tiro.`);
      });
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.repeat.set(1/FIRE_ATLAS.columns,1/FIRE_ATLAS.rows);
      tex.offset.set(walkFrameUv(0).x,walkFrameUv(0).y);
      tex.magFilter=THREE.LinearFilter;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      atlasTextures.push(tex);
    };
    fireRequest.current=showFire;

    const initialCells = new Map(TRAINING_START.units.map(unit => [unit.id, unit.cell]));
    for (const unit of deployments) {
      const p = cellFromId(initialCells.get(unit.id)!);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(.42, 28),
        new THREE.MeshBasicMaterial({ color: '#88ddca', transparent: true, opacity: .28, depthWrite: false })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(p.x, .105, p.z); add(ground);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures[unit.sex], transparent: true, depthWrite: false, alphaTest: .06,
      }));
      sprite.name = unit.label;
      // Bottom-center anchor, so the atlas boots stand on the tile instead of floating.
      sprite.center.set(.5, 0);
      sprite.scale.set(1.48, 2.28, 1);
      sprite.position.set(p.x, .13, p.z);
      add(sprite);
      unitsVisual.current.set(unit.id, { sprite, shadow:ground });
    }

    const setView = (focused: boolean, cell: Cell) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      camera = focused
        ? createIsoDetailCamera(rect.width / rect.height, cell)
        : createIsoCamera(rect.width / rect.height);
      render();
    };
    cameraRefresh.current = setView;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      renderer.setSize(rect.width, rect.height, false);
      const view=currentView.current;
      setView(view.focus,view.cell);
    };
    let down: { id: number; x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => {
      down = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return;
      const drag = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      if (drag > 8) return;
      const picked = pickCell(event.clientX, event.clientY, camera, canvas.getBoundingClientRect());
      if (picked) {
        setActive(picked);
        const roster=latestSquad.current;
        if (!roster.moving) {
          const selected=roster.units.units.find(unit=>unit.cell===picked.id);
          if (selected) setOfficer(selected.id);
        }
      }
    };
    const onCancel = () => { down = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frameHandle = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setPlaying(false);
    const frame = (time: number) => {
      const motion = moveRef.current;
      if (motion) {
        if (motion.start === null) motion.start = time;
        const progress = Math.min(motion.cells.length - 1, (time - motion.start) / STEP_MS);
        const leg = Math.min(Math.floor(progress), motion.cells.length - 2);
        const t = Math.min(1, progress - leg);
        const from = cellFromId(motion.cells[leg]);
        const to = cellFromId(motion.cells[leg + 1]);
        const visual = unitsVisual.current.get(motion.unitId);
        if (visual) {
          const x = from.x + (to.x - from.x) * t;
          const z = from.z + (to.z - from.z) * t;
          visual.sprite.position.set(x, .13, z);
          visual.shadow.position.set(x, .105, z);
        }
        if (progress >= motion.cells.length - 1) {
          const destination = motion.cells[motion.cells.length - 1];
          committed.current = commitTrainingMove(committed.current, motion.unitId, destination);
          moveRef.current = null;
          setUnits(committed.current);
          setMotionInfo(`Recorrido completado: ${motion.unitId} en ${destination} (${motion.cells.length - 1} pasos).`);
          setMoving(false);
        }
      }
      const burst=fireRef.current;
      if(burst){
        if(burst.start===null)burst.start=time;
        const index=burst.review
          ? burst.frame === FIRE_ATLAS.frames ? null : burst.frame
          : isoFireFrame(time-burst.start,!reduced&&animateEnabled.current);
        const visual=unitsVisual.current.get(burst.unitId);
        const fireAtlas=fireAtlases.get(burst.sex);
        if(index===null){
          const idle=unitTextures.get(burst.unitId);
          if(visual&&idle){
            visual.sprite.material.map=idle;
            visual.sprite.material.needsUpdate=true;
          }
          fireRef.current=null;
          canvas.removeAttribute('data-fire-frame');
          canvas.removeAttribute('data-fire-unit');
          canvas.removeAttribute('data-fire-mode');
          setReviewFrame(null);
          setFiring(false);
          setFireReport(`Ensayo visual completado: ${burst.unitId}. Sin impactos, daños ni consumo de munición.`);
        }else if(visual&&fireAtlas){
          // Instrument the actual WebGL-backed sprite UV applied this frame.
          // Chrome screenshots can assert the photographed pose is frame N.
          canvas.setAttribute('data-fire-frame', String(index));
          canvas.setAttribute('data-fire-unit', burst.unitId);
          canvas.setAttribute('data-fire-mode', burst.review ? 'manual' : 'auto');
          const uv=walkFrameUv(index);
          fireAtlas.offset.set(uv.x,uv.y);
          if(visual.sprite.material.map!==fireAtlas){
            visual.sprite.material.map=fireAtlas;
            visual.sprite.material.needsUpdate=true;
          }
        }
      }
      for (const unit of deployments) {
        const isolated = unitTextures.get(unit.id);
        if (!isolated) continue;
        const index = isoOfficerFrame(
          unit.id, moveRef.current, time, !reduced && animateEnabled.current
        );
        if (lastFrames.get(unit.id) !== index) {
          const uv = walkFrameUv(index);
          isolated.offset.set(uv.x, uv.y);
          lastFrames.set(unit.id, index);
        }
      }
      render();
      frameHandle = requestAnimationFrame(frame);
    };
    frameHandle = requestAnimationFrame(frame);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      selection.current = null;
      aimVisual.current = null;
      cameraRefresh.current = null;
      moveRef.current = null;
      fireRef.current = null;
      fireRequest.current = null;
      fireStepRequest.current = null;
      unitsVisual.current.clear();
      unitTextures.clear();
      lastFrames.clear();
      routeVisual.current.clear();
      scene.traverse(obj => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (m.material) {
          for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) mat.dispose();
        }
      });
      for (const t of atlasTextures) t.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  const moveOfficer = () => {
    if (moving || firing || !path || path.cells.length < 2 || moveRef.current || fireRef.current) return;
    if (!unitsVisual.current.size || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const next = commitTrainingMove(units, officer, active.id);
      committed.current = next;
      setUnits(next);
      setMotionInfo(`Recorrido completado: ${officer} en ${active.id} (${path.cells.length - 1} pasos).`);
      return;
    }
    moveRef.current = { unitId:officer, cells:path.cells, start:null };
    setMoving(true);
    setMotionInfo(`Desplazando ${officer}: ${path.cells.length - 1} pasos por casillas transitables.`);
  };
  const toggleFireReview = () => {
    if (firing || moving) return;
    setReview(value => {
      reviewEnabled.current = !value;
      return !value;
    });
  };
  const advanceFireReview = () => fireStepRequest.current?.();
  const fireOfficer = () => {
    if(moving||firing||!aim?.allowed||!fireRequest.current||!assetStatus.startsWith('Atlas R2 reales: 4/4'))
      return;
    // Recheck current immutable squad and target immediately before display.
    if(!evaluatePracticeShot(units,officer,active.id).allowed)return;
    fireRequest.current(officer);
  };
  const choose = (col: number, row: number) => {
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    const cell: Cell={ col, row, id: `${col}:${row}` };
    setActive(cell);
    if(!moving) {
      const selected=units.units.find(unit=>unit.cell===cell.id);
      if(selected) setOfficer(selected.id);
    }
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    choose(active.col + delta[0], active.row + delta[1]);
  };

  return <section className={detail ? 'iso-lab iso-lab-detail' : 'iso-lab'}
    aria-labelledby="iso-lab-title" data-testid="iso-lab">
    <header className="iso-lab-header">
      <div>
        <span className="iso-overline">SHADOWOPS / PRUEBA VISUAL / 8 × 8</span>
        <h2 id="iso-lab-title">Contacto en el observatorio</h2>
        <p>Perspectiva isométrica fija · oficiales originales · blancos de entrenamiento, sin combate simulado</p>
      </div>
      <span className="iso-badge">POC</span>
    </header>
    <div className="iso-focus-controls" role="group" aria-label="Detalle de cámara isométrica">
      <button type="button" data-testid="iso-focus-toggle" aria-pressed={detail}
        onClick={() => setDetail(value => !value)}>
        {detail ? 'Vista completa · 8 × 8' : 'Ampliar zona seleccionada'}
      </button>
      <span data-testid="iso-camera-mode">{detail
        ? `Detalle ampliado · centro en ${active.id}` : 'Tablero completo · selección 64/64'}</span>
    </div>
    <div className="iso-lab-viewport" ref={host} data-testid="iso-canvas" />
    {detail && <div className="iso-touch-stepper" role="group"
      aria-label="Desplazar la casilla seleccionada para recentrar la vista">
      <button type="button" data-testid="iso-step-left" aria-label="Seleccionar casilla izquierda"
        disabled={active.col === 0} onClick={() => choose(active.col - 1,active.row)}>←</button>
      <button type="button" data-testid="iso-step-up" aria-label="Seleccionar casilla superior"
        disabled={active.row === 0} onClick={() => choose(active.col,active.row - 1)}>↑</button>
      <strong data-testid="iso-focus-cell">{active.id}</strong>
      <button type="button" data-testid="iso-step-down" aria-label="Seleccionar casilla inferior"
        disabled={active.row === 7} onClick={() => choose(active.col,active.row + 1)}>↓</button>
      <button type="button" data-testid="iso-step-right" aria-label="Seleccionar casilla derecha"
        disabled={active.col === 7} onClick={() => choose(active.col + 1,active.row)}>→</button>
    </div>}
    {rendererStatus && <p role="status" className="iso-status">{rendererStatus}</p>}
    <div className="iso-lab-bar">
      <div className="iso-cell-readout" data-testid="iso-selected" aria-live="polite">
        <span>CASILLA SELECCIONADA</span>
        <strong>{active.id}</strong>
        <small>{cover.has(active.id) ? 'Cobertura · no transitable' :
          units.units.some(unit => unit.cell === active.id) ? 'Oficial desplegado' :
          targets.includes(active.id as typeof targets[number]) ? 'Blanco de entrenamiento' : 'Suelo transitable'}</small>
      </div>
      <button className="iso-motion" type="button" onClick={() => setPlaying(v => !v)} data-testid="iso-motion">
        {playing ? 'Pausar caminata' : 'Reproducir caminata'}
      </button>
    </div>
    <div className="iso-squad-movement" data-testid="iso-squad-movement">
      <div className="iso-squad-list" role="group" aria-label="Elegir oficial para el ensayo">
        {deployments.map(unit => {
          const at = units.units.find(entry => entry.id === unit.id)!;
          return <button key={unit.id} type="button" data-testid={`iso-unit-${unit.id}`}
            aria-pressed={officer === unit.id} disabled={moving || firing}
            data-clip={moving && officer === unit.id ? 'walk' : 'idle'}
            onClick={() => {
              setOfficer(unit.id);
              if (detail) {
                const p = at.cell.split(':').map(Number);
                choose(p[0],p[1]);
              }
              setMotionInfo(`Oficial seleccionado: ${unit.label}.`);
            }}>
            <strong>{unit.label}</strong><span>{at.cell}</span>
          </button>;
        })}
      </div>
      <div className="iso-move-order">
        <div data-testid="iso-route" aria-live="polite">
          {moving ? 'Recorriendo ruta…' :
            path && path.cells.length > 1 ? `Ruta: ${path.cells.length - 1} pasos · ${path.cells.join(' → ')}` :
            path ? 'El oficial ya está en esa casilla.' :
            'No hay ruta: cobertura, blanco u otro oficial bloquea el destino.'}
        </div>
        <button type="button" data-testid="iso-move" onClick={moveOfficer}
          disabled={moving || firing || !path || path.cells.length < 2}>
          {moving ? 'Desplazando oficial…' : 'Mover oficial a la casilla seleccionada'}
        </button>
        <p data-testid="iso-motion-status" role="status">{motionInfo}</p>
      </div>
    </div>
    <div className="iso-aim-panel" data-testid="iso-aim-panel">
      <span className="iso-aim-heading">VISOR DE PUNTERÍA · PRUEBA VISUAL SIN IMPACTOS</span>
      <p className={aim ? aim.allowed ? 'iso-aim-clear' : 'iso-aim-blocked' : ''}
        data-testid="iso-aim-status" role="status">{aimMessage}</p>
      <button type="button" className="iso-fire-button" data-testid="iso-fire"
        disabled={moving||firing||!aim?.allowed||!assetStatus.startsWith('Atlas R2 reales: 4/4')}
        onClick={fireOfficer}>{firing?'Reproduciendo disparo…':'Ensayar ciclo de disparo original'}</button>
      <button type="button" className="iso-review-toggle" data-testid="iso-review-toggle"
        aria-pressed={review} disabled={firing || moving}
        onClick={toggleFireReview}>
        {review ? 'Revisión fotograma a fotograma activada' : 'Revisar disparo fotograma a fotograma'}
      </button>
      {reviewFrame !== null && firing && (
        <div className="iso-fire-review" data-testid="iso-fire-review" role="group"
          aria-label="Fotogramas del disparo original">
          <span data-testid="iso-fire-frame">Fotograma {reviewFrame + 1} / {FIRE_ATLAS.frames}</span>
          <button type="button" data-testid="iso-fire-next" onClick={advanceFireReview}>
            {reviewFrame === FIRE_ATLAS.frames - 1 ? 'Finalizar revisión' : 'Siguiente fotograma →'}
          </button>
        </div>
      )}
      <p data-testid="iso-fire-report" role="status">{fireReport}</p>
    </div>
    <div className="iso-lab-bottom">
      <p role="status" data-testid="iso-atlas-status">{assetStatus}</p>
      <p>Ensayo de desplazamiento, sin turnos ni combate · 2 blancos · cámara fija</p>
    </div>
    <button type="button" className="iso-inspect-toggle" data-testid="iso-inspect-toggle"
      aria-expanded={inspecting} onClick={() => setInspecting(value => !value)}>
      {inspecting ? 'Cerrar visor de atlas' : 'Ampliar y comparar los 2 atlas originales'}
    </button>
    {inspecting && <IsoAtlasMagnifier playing={playing} />}
    <div className="iso-lab-a11y" tabIndex={0} onKeyDown={keyboard}
      aria-label="Control de casilla con flechas" data-testid="iso-keyboard">
      <span>Seleccionar casilla: clic, toque o enfoca aquí y usa las flechas.</span>
    </div>
    <details className="iso-lab-grid" data-testid="iso-accessible-grid">
      <summary>Selección alternativa: 64 casillas</summary>
      <div role="group" aria-label="Casillas del tablero">
        {cells().map(cell => <button key={cell.id} type="button"
          aria-label={`Casilla ${cell.id}`} aria-pressed={active.id === cell.id}
          onClick={() => choose(cell.col,cell.row)}>{cell.id}</button>)}
      </div>
    </details>
  </section>;
}
