// The tactical camera spike is isolated from the normal bridge and away-team game.
// Three.js does projection and actual Raycaster.intersectObject against ONE ground layer;
// the shared domain model decides which logical tile owns the intersection.
import * as THREE from 'three';
import {
  createTacticalBoard, tacticalCellCenter, tacticalCellAtWorld,
  pointerToCanvasNdc, canvasNdcToClient,
} from '../../../src/tacticalGrid.mjs';

export const TACTICAL_BOARD = createTacticalBoard({
  columns: 8, rows: 8, blocked: [{ col: 4, row: 3 }],
});

const clampDpr = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

function fitOrthoCamera(camera, board, canvas) {
  const rect = canvas.getBoundingClientRect();
  const aspect = Math.max(0.25, rect.width / Math.max(rect.height, 1));
  // Project all board corners into camera-local X/Y. This handles rotated views
  // and different mobile/desktop aspect ratios with no per-width magic offsets.
  camera.updateMatrixWorld(true);
  const halfX = board.columns * board.tileSize / 2;
  const halfZ = board.rows * board.tileSize / 2;
  const projected = [
    [-halfX, -halfZ], [-halfX, halfZ], [halfX, -halfZ], [halfX, halfZ],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(camera.matrixWorldInverse));
  const extentX = Math.max(...projected.map(p => Math.abs(p.x)));
  const extentY = Math.max(...projected.map(p => Math.abs(p.y)));
  const halfHeight = Math.max(extentY, extentX / aspect) * 1.13 + 0.18;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

export function mountTacticalCamera(canvas, onCell) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A mounted HTMLCanvasElement is required');
  if (typeof onCell !== 'function') throw new Error('A selection callback is required');
  const board = TACTICAL_BOARD;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(clampDpr());
  renderer.setClearColor(0x0d1a26, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1a26);
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
  camera.position.set(12, 16, 13);
  camera.lookAt(0, 0, 0);
  const tiles = new THREE.BoxGeometry(0.97, 0.16, 0.97);
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0x294c5a }),
    new THREE.MeshBasicMaterial({ color: 0x345767 }),
    new THREE.MeshBasicMaterial({ color: 0x5f544a }),
  ];
  const blocks = [];
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.columns; col++) {
      const center = tacticalCellCenter(board, col, row);
      const blocked = board.blocked.includes(`${col}:${row}`);
      const tile = new THREE.Mesh(tiles, blocked ? materials[2] : materials[(row + col) % 2]);
      tile.position.set(center.x, -0.105, center.z);
      scene.add(tile);
      blocks.push(tile);
    }
  }
  // Pick only this ground plane, never the visual props over it.
  const planeGeometry = new THREE.PlaneGeometry(board.columns * board.tileSize, board.rows * board.tileSize);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pickingPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  pickingPlane.rotation.x = -Math.PI / 2;
  pickingPlane.updateMatrixWorld(true);
  scene.add(pickingPlane);
  const proxyGeometry = new THREE.CylinderGeometry(0.19, 0.21, 0.48, 8);
  const proxyMaterials = [0x6fafb9, 0xcfbb83, 0x99a48c].map(color => new THREE.MeshBasicMaterial({ color }));
  const proxies = [[1, 1], [2, 5], [5, 3]].map(([col, row], index) => {
    const center = tacticalCellCenter(board, col, row);
    const prop = new THREE.Mesh(proxyGeometry, proxyMaterials[index]);
    prop.position.set(center.x, 0.26, center.z);
    scene.add(prop);
    return prop;
  });
  const raycaster = new THREE.Raycaster();
  const point = new THREE.Vector2();
  let selected = null;
  let pointerDown = null;
  let disposed = false;
  const highlightGeo = new THREE.PlaneGeometry(0.79, 0.79);
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0xe5d49a, transparent: true, opacity: 0.57, side: THREE.DoubleSide, depthWrite: false,
  });
  const highlight = new THREE.Mesh(highlightGeo, highlightMat);
  highlight.rotation.x = -Math.PI / 2;
  highlight.position.y = 0.008;
  highlight.visible = false;
  scene.add(highlight);

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderer.setPixelRatio(clampDpr());
    renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
    fitOrthoCamera(camera, board, canvas);
    render();
  }
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right ||
        clientY < rect.top || clientY > rect.bottom) return null;
    const ndc = pointerToCanvasNdc(clientX, clientY, rect);
    point.set(ndc.x, ndc.y);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObject(pickingPlane, false)[0];
    return hit ? tacticalCellAtWorld(board, hit.point.x, hit.point.z) : null;
  }
  function select(hit) {
    if (!hit || disposed) return;
    selected = hit;
    const center = tacticalCellCenter(board, hit.col, hit.row);
    highlight.position.x = center.x;
    highlight.position.z = center.z;
    highlight.visible = true;
    onCell({ ...hit });
    render();
  }
  function projectCell(col, row) {
    if (disposed) throw new Error('Camera has been disposed');
    const center = tacticalCellCenter(board, col, row);
    camera.updateMatrixWorld(true);
    const projected = new THREE.Vector3(center.x, center.y, center.z).project(camera);
    const rect = canvas.getBoundingClientRect();
    const client = canvasNdcToClient({ x: projected.x, y: projected.y }, rect);
    return { clientX: client.x, clientY: client.y, ndcX: projected.x, ndcY: projected.y };
  }
  const down = event => {
    if (!event.isPrimary) return;
    pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const up = event => {
    if (!pointerDown || event.pointerId !== pointerDown.id) return;
    const delta = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (delta > 6) return; // drag is never a click
    select(pick(event.clientX, event.clientY));
  };
  const cancel = () => { pointerDown = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  const api = {
    projectCell,
    pick,
    selectCell(col, row) {
      const center = tacticalCellCenter(board, col, row);
      select(tacticalCellAtWorld(board, center.x, center.z));
    },
    getSelected: () => selected && { ...selected },
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      scene.remove(pickingPlane, highlight, ...proxies, ...blocks);
      tiles.dispose();
      materials.forEach(mat => mat.dispose());
      planeGeometry.dispose(); planeMaterial.dispose();
      proxyGeometry.dispose(); proxyMaterials.forEach(mat => mat.dispose());
      highlightGeo.dispose(); highlightMat.dispose();
      renderer.dispose();
      if (window.__shadowopsTacticalProbe === api) delete window.__shadowopsTacticalProbe;
    },
  };
  // Isolated diagnostic URL only; lets Playwright sample exactly the projection
  // produced by the *real* camera before pressing the real pointer target.
  window.__shadowopsTacticalProbe = api;
  return api;
}
