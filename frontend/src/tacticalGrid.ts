import * as THREE from 'three';

export const BOARD_SIZE = 8;
export const TILE_SIZE = 1;
export type Cell = { col: number; row: number; id: string };

export const cellId = (col: number, row: number) => `${col}:${row}`;
export const cells = (): Cell[] => Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
  col: index % BOARD_SIZE,
  row: Math.floor(index / BOARD_SIZE),
  id: cellId(index % BOARD_SIZE, Math.floor(index / BOARD_SIZE)),
}));

export const cellCenter = ({ col, row }: Pick<Cell, 'col' | 'row'>) => new THREE.Vector3(
  (col - (BOARD_SIZE - 1) / 2) * TILE_SIZE,
  0,
  (row - (BOARD_SIZE - 1) / 2) * TILE_SIZE,
);

export function createCamera(aspect: number) {
  const span = BOARD_SIZE * TILE_SIZE + 1.8;
  const camera = new THREE.OrthographicCamera(-span * aspect / 2, span * aspect / 2, span / 2, -span / 2, 0.1, 100);
  camera.position.set(8, 10, 8);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

export function projectCell(cell: Cell, camera: THREE.Camera, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
  const point = cellCenter(cell).project(camera);
  return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
}

export function pickCell(clientX: number, clientY: number, camera: THREE.Camera, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Cell | null {
  const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointer, camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!hit) return null;
  const col = Math.floor(hit.x / TILE_SIZE + BOARD_SIZE / 2);
  const row = Math.floor(hit.z / TILE_SIZE + BOARD_SIZE / 2);
  return col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE ? { col, row, id: cellId(col, row) } : null;
}
