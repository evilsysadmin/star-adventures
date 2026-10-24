import * as THREE from 'three';

export const BOARD_SIZE = 8;
export const TILE_SIZE = 1;
export type TacticalBoardSize = 8 | 10 | 12;
export function assertBoardSize(size: number): asserts size is TacticalBoardSize {
  if (![8,10,12].includes(size)) throw new RangeError('Unsupported tactical board size');
}
export type Cell = { col: number; row: number; id: string };

export const cellId = (col: number, row: number) => `${col}:${row}`;
export const cells = (size: TacticalBoardSize = BOARD_SIZE): Cell[] => Array.from({ length: size * size }, (_, index) => ({
  col: index % size,
  row: Math.floor(index / size),
  id: cellId(index % size, Math.floor(index / size)),
}));

export const cellCenter = ({ col, row }: Pick<Cell, 'col' | 'row'>, size: TacticalBoardSize = BOARD_SIZE) => new THREE.Vector3(
  (col - (size - 1) / 2) * TILE_SIZE,
  0,
  (row - (size - 1) / 2) * TILE_SIZE,
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

export function projectCell(cell: Cell, camera: THREE.Camera, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, size: TacticalBoardSize = BOARD_SIZE) {
  const point = cellCenter(cell, size).project(camera);
  return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
}

export function pickCell(clientX: number, clientY: number, camera: THREE.Camera, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, size: TacticalBoardSize = BOARD_SIZE): Cell | null {
  const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointer, camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!hit) return null;
  const col = Math.floor(hit.x / TILE_SIZE + size / 2);
  const row = Math.floor(hit.z / TILE_SIZE + size / 2);
  return col >= 0 && col < size && row >= 0 && row < size ? { col, row, id: cellId(col, row) } : null;
}
