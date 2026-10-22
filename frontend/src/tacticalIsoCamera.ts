import * as THREE from 'three';
import { BOARD_SIZE } from './tacticalGrid';

// A fixed, mathematically isometric orthographic view (35.264° elevation).
// Frustum is fitted to board corners AND the tallest cutout sprites,
// including the actual canvas aspect ratio. Logical tile coordinates stay untouched.
export function createIsoCamera(aspect: number): THREE.OrthographicCamera {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new RangeError('Invalid iso aspect');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(12, 12, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const extent = BOARD_SIZE / 2 + 0.28;
  const corners = [-extent, extent].flatMap(x =>
    [-extent, extent].flatMap(z => [0, 2.45].map(y =>
      new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
    ))
  );
  const minX = Math.min(...corners.map(p => p.x));
  const maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxY = Math.max(...corners.map(p => p.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const verticalSpan = Math.max((maxY - minY) * 1.11, (maxX - minX) * 1.10 / aspect);
  const horizontalSpan = verticalSpan * aspect;
  camera.left = centerX - horizontalSpan / 2;
  camera.right = centerX + horizontalSpan / 2;
  camera.bottom = centerY - verticalSpan / 2;
  camera.top = centerY + verticalSpan / 2;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}
