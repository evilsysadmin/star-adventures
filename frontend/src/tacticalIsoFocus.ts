import * as THREE from 'three';
import { cellCenter, type Cell } from './tacticalGrid.ts';
import { createIsoCamera } from './tacticalIsoCamera.ts';

// Opt-in focus is a camera-only transform. Never change grid, art, or picking.
// The baseline full-board camera remains exactly as before for 64/64 selection.
export const ISO_DETAIL_ZOOM = 1.65;

export function createIsoDetailCamera(
  aspect: number, focus: Pick<Cell, 'col' | 'row'>,
  zoom = ISO_DETAIL_ZOOM,
): THREE.OrthographicCamera {
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > 2)
    throw new RangeError('Unsupported tactical detail zoom');
  if (!Number.isInteger(focus.col) || !Number.isInteger(focus.row) ||
      focus.col < 0 || focus.col > 7 || focus.row < 0 || focus.row > 7)
    throw new RangeError('Invalid detail focus cell');
  const camera = createIsoCamera(aspect);
  const shift = cellCenter(focus);
  camera.position.add(shift);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
