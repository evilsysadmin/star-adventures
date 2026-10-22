import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { cells, createCamera, pickCell, type Cell } from '../tacticalGrid';
import assets from '../assets/r2-assets-manifest.json';

const blocked = new Set(['3:3', '4:3']);
const officerSpriteUrl = assets.assets['starAdventures.tactical.officerFemaleMvsV1'].url;
const officerMaleSpriteUrl = assets.assets['starAdventures.tactical.officerMaleMvsV1'].url;

export function TacticalProbe() {
  const host = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Cell>({ col: 0, row: 0, id: '0:0' });
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
    const spriteTexture = new THREE.TextureLoader().load(officerSpriteUrl, render);
    spriteTexture.colorSpace = THREE.SRGBColorSpace;
    const officer = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTexture, transparent: true, depthWrite: false }));
    officer.name = 'officer-mvs-v1'; officer.scale.set(1.55, 2.4, 1); officer.position.set(-2.5, 1.2, -2.5); scene.add(officer);
    const officerMaleTexture = new THREE.TextureLoader().load(officerMaleSpriteUrl, render);
    officerMaleTexture.colorSpace = THREE.SRGBColorSpace;
    const officerMale = new THREE.Sprite(new THREE.SpriteMaterial({ map: officerMaleTexture, transparent: true, depthWrite: false }));
    officerMale.name = 'officer-mvs-male-v1'; officerMale.scale.set(1.55, 2.4, 1); officerMale.position.set(1.5, 1.2, -1.5); scene.add(officerMale);
    let camera = createCamera(1);
    const resize = () => { const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera = createCamera(width / height); render(); };
    const pointer = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); const cell = pickCell(event.clientX, event.clientY, camera, rect); if (cell) setSelected(cell); };
    renderer.domElement.addEventListener('pointerup', pointer);
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => { observer.disconnect(); renderer.domElement.removeEventListener('pointerup', pointer); spriteTexture.dispose(); officerMaleTexture.dispose(); board.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); (mesh.material as THREE.Material)?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <section className="tactical-probe" aria-labelledby="tactical-title">
    <div><span>PRUEBA TÁCTICA / CÁMARA FIJA</span><h2 id="tactical-title">Tablero de selección</h2><p data-testid="tactical-selected">Celda seleccionada: {selected.id}{blocked.has(selected.id) ? ' · obstáculo, no transitable' : ''}</p><p className="tactical-mvs" data-testid="tactical-mvs">MVS · oficial mujer 1:1 · oficial hombre 5:2</p></div>
    <div ref={host} className="tactical-canvas" data-testid="tactical-canvas" aria-label="Tablero táctico 8 por 8" />
    <div className="tactical-controls" aria-label="Controles alternativos del tablero">{cells().map(cell => <button key={cell.id} type="button" onClick={() => setSelected(cell)} aria-pressed={selected.id === cell.id}>{cell.id}</button>)}</div>
  </section>;
}
