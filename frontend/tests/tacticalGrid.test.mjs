import test from 'node:test';
import assert from 'node:assert/strict';
import { cells, createCamera, pickCell, projectCell } from '../src/tacticalGrid.ts';

for (const [width, height] of [[360, 850], [390, 850], [430, 850], [1280, 820]]) {
  test(`all 64 tactical centers round-trip at ${width}px`, () => {
    const camera = createCamera(width / height);
    const rect = { left: 73, top: 41, width: width - 101, height: 500 };
    for (const cell of cells()) {
      const point = projectCell(cell, camera, rect);
      assert.equal(pickCell(point.x, point.y, camera, rect)?.id, cell.id);
    }
  });
}
