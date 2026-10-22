import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TacticalGridError, createTacticalBoard, tacticalCellId, tacticalCellCenter,
  tacticalCellAtWorld, pointerToCanvasNdc, canvasNdcToClient, isTacticalCellWalkable,
} from '../src/tacticalGrid.mjs';

test('all 64 centers in an 8x8 board have unique, exact, reversible IDs', () => {
  const board = createTacticalBoard();
  const actual = new Set();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const { x, y, z } = tacticalCellCenter(board, col, row);
      assert.equal(y, 0);
      const hit = tacticalCellAtWorld(board, x, z);
      assert.deepEqual(hit, { col, row, id: `${col}:${row}`, blocked: false });
      actual.add(hit.id);
    }
  }
  assert.equal(actual.size, 64);
  assert.equal(tacticalCellCenter(board, 0, 0).x, -3.5);
  assert.equal(tacticalCellCenter(board, 7, 7).z, 3.5);
});

test('rectangular grids and tile sizes never assume width equals height', () => {
  const board = createTacticalBoard({ columns: 6, rows: 10, tileSize: 2 });
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 6; col++) {
      const center = tacticalCellCenter(board, col, row);
      assert.equal(tacticalCellAtWorld(board, center.x, center.z).id, tacticalCellId(board, col, row));
    }
  assert.equal(tacticalCellAtWorld(board, -6, -10).id, '0:0');
  assert.equal(tacticalCellAtWorld(board, 6, 0), null);
});

test('edges obey half-open boundaries, not arbitrary epsilon corrections', () => {
  const board = createTacticalBoard();
  assert.equal(tacticalCellAtWorld(board, -4, -4).id, '0:0');
  assert.equal(tacticalCellAtWorld(board, -3, -3).id, '1:1');
  assert.equal(tacticalCellAtWorld(board, 3.999, 3.999).id, '7:7');
  for (const [x, z] of [[4, 0], [0, 4], [-4.00001, 0], [0, -4.00001],
    [Infinity, 0], [0, NaN], [-Infinity, 0]]) {
    assert.equal(tacticalCellAtWorld(board, x, z), null);
  }
});

test('occluding objects do not change logical tile ID or movement eligibility', () => {
  const board = createTacticalBoard({ blocked: [{ col: 4, row: 3 }] });
  const center = tacticalCellCenter(board, 4, 3);
  const hit = tacticalCellAtWorld(board, center.x, center.z);
  assert.equal(hit.id, '4:3');
  assert.equal(hit.blocked, true);
  assert.equal(isTacticalCellWalkable(board, 4, 3), false);
  assert.equal(isTacticalCellWalkable(board, 3, 3), true);
});

test('pointer NDC round-trips across mobile/desktop, CSS offsets and DPR-independent rectangles', () => {
  for (const width of [360, 390, 430, 1280]) {
    for (const rect of [
      { left: 0, top: 0, width, height: 240 },
      { left: 57.25, top: 192.5, width: width - 37.5, height: 315.25 },
    ]) {
      for (const ndc of [{ x: 0, y: 0 }, { x: -0.7, y: 0.86 }, { x: 0.8, y: -0.94 }]) {
        const client = canvasNdcToClient(ndc, rect);
        const roundTrip = pointerToCanvasNdc(client.x, client.y, rect);
        assert.ok(Math.abs(roundTrip.x - ndc.x) < 1e-12);
        assert.ok(Math.abs(roundTrip.y - ndc.y) < 1e-12);
      }
    }
  }
});

test('invalid boards and pointer rectangles fail explicitly', () => {
  for (const args of [{ columns: 0 }, { rows: 33 }, { tileSize: 0 }, { tileSize: Infinity },
    { blocked: [{ col: 8, row: 0 }] }, { blocked: [{ col: 2, row: 2 }, { col: 2, row: 2 }] }]) {
    assert.throws(() => createTacticalBoard(args), TacticalGridError);
  }
  const board = createTacticalBoard();
  assert.throws(() => tacticalCellId(board, -1, 0), TacticalGridError);
  assert.throws(() => tacticalCellCenter(board, 1.5, 0), TacticalGridError);
  assert.throws(() => pointerToCanvasNdc(5, 5, { left: 0, top: 0, width: 0, height: 100 }), TacticalGridError);
  assert.throws(() => canvasNdcToClient({ x: NaN, y: 0 }, { left: 0, top: 0, width: 100, height: 100 }), TacticalGridError);
});
