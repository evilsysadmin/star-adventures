import * as THREE from 'three';
import { BOARD_SIZE, assertBoardSize, cellCenter, type Cell, type TacticalBoardSize } from './tacticalGrid.ts';
import { createIsoCamera } from './tacticalIsoCamera.ts';

// Opt-in focus is a camera-only transform. Never change grid, art, or picking.
// The baseline full-board camera remains exactly as before for 64/64 selection.
export const ISO_DETAIL_ZOOM = 1.65;

export function createIsoDetailCamera(
  aspect: number, focus: Pick<Cell, 'col' | 'row'>,
  zoom = ISO_DETAIL_ZOOM,
  size: TacticalBoardSize = BOARD_SIZE,
): THREE.OrthographicCamera {
  assertBoardSize(size);
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 2)
    throw new RangeError('Unsupported tactical detail zoom');
  if (!Number.isInteger(focus.col) || !Number.isInteger(focus.row) ||
      focus.col < 0 || focus.col >= size || focus.row < 0 || focus.row >= size)
    throw new RangeError('Invalid detail focus cell');
  const camera = createIsoCamera(aspect, size);
  const shift = cellCenter(focus, size);
  camera.position.add(shift);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
