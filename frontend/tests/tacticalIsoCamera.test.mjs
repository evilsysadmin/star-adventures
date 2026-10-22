import test from 'node:test';
import assert from 'node:assert/strict';
import { cells, projectCell, pickCell } from '../src/tacticalGrid.ts';
import { createIsoCamera } from '../src/tacticalIsoCamera.ts';

for (const [width, height] of [[310, 350], [340, 350], [380, 350], [760, 500], [1100, 500]]) {
  test(`fixed isometric camera 64/64 centers stay inside canvas and raycast to exact tile at ${width}×${height}`, () => {
    const rect = { left: 113, top: 207, width, height };
    const camera = createIsoCamera(width / height);
    assert.ok(Math.abs(camera.position.x - camera.position.y) < 0.0001);
    assert.ok(Math.abs(camera.position.y - camera.position.z) < 0.0001);
    for (const cell of cells()) {
      const p = projectCell(cell, camera, rect);
      assert.ok(p.x > rect.left && p.x < rect.left + width, cell.id + ' x cropped');
      assert.ok(p.y > rect.top && p.y < rect.top + height, cell.id + ' y cropped');
      assert.equal(pickCell(p.x, p.y, camera, rect)?.id, cell.id);
    }
  });
}

test('isometric camera rejects impossible viewport and supports extreme mobile/desktop ratios', () => {
  for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => createIsoCamera(aspect), RangeError);
  for (const [w, h] of [[230, 600], [1280, 260], [500, 500]]) {
    const camera = createIsoCamera(w / h);
    const rect = { left: 15, top: 45, width: w, height: h };
    for (const cell of cells()) {
      const p = projectCell(cell, camera, rect);
      assert.equal(pickCell(p.x, p.y, camera, rect)?.id, cell.id);
    }
  }
});

test('decorative unit positions do not become picking authority', () => {
  const camera = createIsoCamera(340 / 350);
  const rect = { left: 33, top: 59, width: 340, height: 350 };
  for (const id of ['1:1', '2:5', '1:6', '6:2', '6:5', '3:3', '4:3']) {
    const [col, row] = id.split(':').map(Number);
    const p = projectCell({ col, row, id }, camera, rect);
    assert.equal(pickCell(p.x, p.y, camera, rect)?.id, id);
  }
});
