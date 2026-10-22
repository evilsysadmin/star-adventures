import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { cells, createCamera, pickCell, type Cell } from '../tacticalGrid';
import { CROUCH_ATLAS, FIRE_ATLAS, JUMP_ATLAS, RUN_ATLAS, WALK_ATLAS, atlasFrameAt, walkFrameUv } from '../tacticalAnimation';
import assets from '../assets/r2-assets-manifest.json';

const blocked = new Set(['3:3', '4:3']);
const officerWalkUrl = assets.assets['starAdventures.tactical.officerFemaleWalkV1'].url;
const officerMaleWalkUrl = assets.assets['starAdventures.tactical.officerMaleWalkV1'].url;
const officerRunUrl = assets.assets['starAdventures.tactical.officerFemaleRunV1'].url;
const officerMaleRunUrl = assets.assets['starAdventures.tactical.officerMaleRunV1'].url;
const officerJumpUrl = assets.assets['starAdventures.tactical.officerFemaleJumpV1'].url;
const officerMaleJumpUrl = assets.assets['starAdventures.tactical.officerMaleJumpV1'].url;
const officerCrouchUrl = assets.assets['starAdventures.tactical.officerFemaleCrouchV1'].url;
const officerMaleCrouchUrl = assets.assets['starAdventures.tactical.officerMaleCrouchV1'].url;
const officerFireUrl = assets.assets['starAdventures.tactical.officerFemaleFireV1'].url;
const officerMaleFireUrl = assets.assets['starAdventures.tactical.officerMaleFireV1'].url;
const motions = ['walk', 'run', 'jump', 'crouch', 'fire'] as const;
type Motion = typeof motions[number];
const motionLabel: Record<Motion, string> = { walk: 'caminar', run: 'correr', jump: 'saltar', crouch: 'agacharse', fire: 'disparar' };
const motionFps: Record<Motion, number> = { walk: WALK_ATLAS.fps, run: RUN_ATLAS.fps, jump: JUMP_ATLAS.fps, crouch: CROUCH_ATLAS.fps, fire: FIRE_ATLAS.fps };
const motionAtlas: Record<Motion, { columns: number; rows: number }> = { walk: WALK_ATLAS, run: RUN_ATLAS, jump: JUMP_ATLAS, crouch: CROUCH_ATLAS, fire: FIRE_ATLAS };
const femaleMotionUrl: Record<Motion, string> = { walk: officerWalkUrl, run: officerRunUrl, jump: officerJumpUrl, crouch: officerCrouchUrl, fire: officerFireUrl };
const maleMotionUrl: Record<Motion, string> = { walk: officerMaleWalkUrl, run: officerMaleRunUrl, jump: officerMaleJumpUrl, crouch: officerMaleCrouchUrl, fire: officerMaleFireUrl };

export function TacticalProbe() {
  const host = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Cell>({ col: 0, row: 0, id: '0:0' });
  const [motion, setMotion] = useState<Motion>('run');
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071018');
    const board = new THREE.Group(); scene.add(board);
    for (const cell of cells()) {
      const material = new THREE.MeshBasicMaterial({ color: (cell.col + cell.row) % 2 ? '#19364c' : '#21475e', transparent: true, opacity: 0.96 });
      const tile = new THREE.Mesh(new THREE.BoxGeometry(.94, blocked.has(cell.id) ? .28 : .08, .94), material);
      tile.position.set(cell.col - 3.5, blocked.has(cell.id) ? .1 : 0, cell.row - 3.5); board.add(tile);
    }
    const render = () => renderer.render(scene, camera);
    const markers = ['6:2', '2:6'];
    markers.forEach(id => { const [col, row] = id.split(':').map(Number); const marker = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .35, 12), new THREE.MeshBasicMaterial({ color: '#e8b85b' })); marker.position.set(col - 3.5, .24, row - 3.5); scene.add(marker); });
    const atlas = motionAtlas[motion];
    const spriteTexture = new THREE.TextureLoader().load(femaleMotionUrl[motion], render);
    spriteTexture.colorSpace = THREE.SRGBColorSpace;
    spriteTexture.repeat.set(1 / atlas.columns, 1 / atlas.rows);
    const officer = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture, transparent: true, depthWrite: false }));
    officer.name = 'officer-female-walk-v1'; officer.scale.set(1.55, 2.4, 1); officer.position.set(-2.5, 1.2, -2.5); scene.add(officer);
    const officerMaleTexture = new THREE.TextureLoader().load(maleMotionUrl[motion], render);
    officerMaleTexture.colorSpace = THREE.SRGBColorSpace;
    officerMaleTexture.repeat.set(1 / atlas.columns, 1 / atlas.rows);
    const officerMale = new THREE.Sprite(new THREE.SpriteMaterial({ map: officerMaleTexture, transparent: true, depthWrite: false }));
    officerMale.name = 'officer-male-walk-v1'; officerMale.scale.set(1.55, 2.4, 1); officerMale.position.set(1.5, 1.2, -1.5); scene.add(officerMale);
    let camera = createCamera(1);
    const resize = () => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera = createCamera(width / height); render(); };
    const pointer = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); const cell = pickCell(event.clientX, event.clientY, camera, rect); if (cell) setSelected(cell); };
    renderer.domElement.addEventListener('pointerup', pointer);
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let previousFrame = -1;
    let animationFrame = 0;
    const animate = (now: number) => {
      const frame = atlasFrameAt(now, motionFps[motion]);
      if (frame !== previousFrame) {
        const uv = walkFrameUv(frame);
        spriteTexture.offset.set(uv.x, uv.y);
        officerMaleTexture.offset.set(uv.x, uv.y);
        previousFrame = frame;
      }
      render();
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animationFrame); observer.disconnect(); renderer.domElement.removeEventListener('pointerup', pointer); spriteTexture.dispose(); officerMaleTexture.dispose(); board.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); (mesh.material as THREE.Material)?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, [motion]);
  return <section className="tactical-probe" aria-labelledby="tactical-title">
    <div><span>PRUEBA TÁCTICA / CÁMARA FIJA</span><h2 id="tactical-title">Tablero de selección</h2><p data-testid="tactical-selected">Celda seleccionada: {selected.id}{blocked.has(selected.id) ? ' · obstáculo, no transitable' : ''}</p><p className="tactical-mvs" data-testid="tactical-mvs">MVS · {motionLabel[motion]} {motionFps[motion]} FPS · oficial mujer 1:1 · oficial hombre 5:2</p><button className="tactical-motion" type="button" onClick={() => setMotion(current => motions[(motions.indexOf(current) + 1) % motions.length])} aria-pressed={motion === 'run'}>Movimiento: {motionLabel[motion]}</button></div>
    <div ref={host} className="tactical-canvas" data-testid="tactical-canvas" aria-label="Tablero táctico 8 por 8" />
    <div className="tactical-controls" aria-label="Controles alternativos del tablero">{cells().map(cell => <button key={cell.id} type="button" onClick={() => setSelected(cell)} aria-pressed={selected.id === cell.id}>{cell.id}</button>)}</div>
  </section>;
}
