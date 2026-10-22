import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as THREE from 'three';
import assets from '../assets/r2-assets-manifest.json';
import { cells, cellCenter, pickCell, type Cell } from '../tacticalGrid';
import { createIsoCamera } from '../tacticalIsoCamera';
import { WALK_ATLAS, walkFrameAt, walkFrameUv } from '../tacticalAnimation';
import './isoTacticalLab.css';

const cover = new Set(['3:3', '4:3']);
const deployments = [
  { cell: '1:1', sex: 'female', label: 'Oficial científica' },
  { cell: '2:5', sex: 'male', label: 'Oficial de seguridad' },
  { cell: '1:6', sex: 'female', label: 'Médica' },
] as const;
const targets = ['6:2', '6:5'] as const;
const femaleUrl = assets.assets['starAdventures.tactical.officerFemaleWalkV1'].url;
const maleUrl = assets.assets['starAdventures.tactical.officerMaleWalkV1'].url;
const cellFromId = (id: string) => {
  const [col, row] = id.split(':').map(Number);
  return cellCenter({ col, row });
};
const initial: Cell = { col: 0, row: 0, id: '0:0' };

export function IsoTacticalLab() {
  const host = useRef<HTMLDivElement>(null);
  const selection = useRef<THREE.Object3D | null>(null);
  const animateEnabled = useRef(true);
  const [active, setActive] = useState<Cell>(initial);
  const [playing, setPlaying] = useState(true);
  const [assetStatus, setAssetStatus] = useState('Conectando con los atlas originales en R2…');
  const [rendererStatus, setRendererStatus] = useState<string | null>(null);

  useEffect(() => { animateEnabled.current = playing; }, [playing]);
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
    const marker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(.98, .17, .98)),
      new THREE.LineBasicMaterial({ color: '#ffdf92', depthTest: false })
    );
    marker.renderOrder = 50;
    add(marker);
    selection.current = marker;
    const start = cellCenter(initial);
    marker.position.set(start.x, .21, start.z);

    // Training targets are deliberately simple geometry, not fabricated enemy atlas art.
    for (const id of targets) {
      const center = cellFromId(id);
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(.23, .31, .9, 10),
        new THREE.MeshStandardMaterial({ color: '#a36555', metalness: .58, roughness: .34 })
      );
      stand.position.set(center.x, .52, center.z); add(stand);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(.14, 12, 10),
        new THREE.MeshBasicMaterial({ color: '#ffc398' })
      );
      beacon.position.set(center.x, 1.05, center.z); add(beacon);
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
    const loader = new THREE.TextureLoader();
    const textures: Record<string, THREE.Texture> = {};
    let settled = 0;
    let succeeded = 0;
    let disposed = false;
    const finishAsset = (success: boolean) => {
      if (disposed) return;
      settled += 1;
      if (success) succeeded += 1;
      setAssetStatus(settled === 2
        ? `Atlas R2 reales: ${succeeded}/2 cargados${succeeded !== 2 ? ' · fichas geométricas de reserva' : ''}`
        : `Cargando atlas R2: ${settled}/2…`);
      render();
    };
    for (const [sex, url] of [['female', femaleUrl], ['male', maleUrl]] as const) {
      const tex = loader.load(url, () => finishAsset(true), undefined, () => finishAsset(false));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(1 / WALK_ATLAS.columns, 1 / WALK_ATLAS.rows);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      textures[sex] = tex;
      atlasTextures.push(tex);
    }

    for (const unit of deployments) {
      const p = cellFromId(unit.cell);
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
    }

    const resize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      renderer.setSize(rect.width, rect.height, false);
      camera = createIsoCamera(rect.width / rect.height);
      render();
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
      if (picked) setActive(picked);
    };
    const onCancel = () => { down = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frameHandle = 0;
    let previousFrame = -1;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setPlaying(false);
    const frame = (time: number) => {
      const index = reduced || !animateEnabled.current ? 0 : walkFrameAt(time);
      if (index !== previousFrame) {
        const uv = walkFrameUv(index);
        for (const texture of atlasTextures) texture.offset.set(uv.x, uv.y);
        previousFrame = index;
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

  const choose = (col: number, row: number) => {
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    setActive({ col, row, id: `${col}:${row}` });
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

  return <section className="iso-lab" aria-labelledby="iso-lab-title" data-testid="iso-lab">
    <header className="iso-lab-header">
      <div>
        <span className="iso-overline">SHADOWOPS / PRUEBA VISUAL / 8 × 8</span>
        <h2 id="iso-lab-title">Contacto en el observatorio</h2>
        <p>Perspectiva isométrica fija · oficiales originales · blancos de entrenamiento, sin combate simulado</p>
      </div>
      <span className="iso-badge">POC</span>
    </header>
    <div className="iso-lab-viewport" ref={host} data-testid="iso-canvas" />
    {rendererStatus && <p role="status" className="iso-status">{rendererStatus}</p>}
    <div className="iso-lab-bar">
      <div className="iso-cell-readout" data-testid="iso-selected" aria-live="polite">
        <span>CASILLA SELECCIONADA</span>
        <strong>{active.id}</strong>
        <small>{cover.has(active.id) ? 'Cobertura · no transitable' :
          deployments.some(unit => unit.cell === active.id) ? 'Oficial desplegado' :
          targets.includes(active.id as typeof targets[number]) ? 'Blanco de entrenamiento' : 'Suelo transitable'}</small>
      </div>
      <button className="iso-motion" type="button" onClick={() => setPlaying(v => !v)} data-testid="iso-motion">
        {playing ? 'Pausar caminata' : 'Reproducir caminata'}
      </button>
    </div>
    <div className="iso-lab-bottom">
      <p role="status" data-testid="iso-atlas-status">{assetStatus}</p>
      <p>3 oficiales · 2 blancos geométricos · 2 obstáculos · cámara sin orbitación</p>
    </div>
    <div className="iso-lab-a11y" tabIndex={0} onKeyDown={keyboard}
      aria-label="Control de casilla con flechas" data-testid="iso-keyboard">
      <span>Seleccionar casilla: clic, toque o enfoca aquí y usa las flechas.</span>
    </div>
    <details className="iso-lab-grid" data-testid="iso-accessible-grid">
      <summary>Selección alternativa: 64 casillas</summary>
      <div role="group" aria-label="Casillas del tablero">
        {cells().map(cell => <button key={cell.id} type="button"
          aria-label={`Casilla ${cell.id}`} aria-pressed={active.id === cell.id}
          onClick={() => setActive(cell)}>{cell.id}</button>)}
      </div>
    </details>
  </section>;
}
