// Canonical tactical grid: X/Z ground plane, +Y up. Pure and renderer-agnostic.
// Three.js owns only camera projection and raycasting; this module owns cell identity.
export class TacticalGridError extends Error {
  constructor(message) { super(message); this.name = 'TacticalGridError'; }
}
const fail = message => { throw new TacticalGridError(message); };
const validSize = n => Number.isSafeInteger(n) && n >= 1 && n <= 32;
const validNumber = n => typeof n === 'number' && Number.isFinite(n);
const validCell = (board, col, row) =>
  Number.isSafeInteger(col) && Number.isSafeInteger(row) &&
  col >= 0 && row >= 0 && col < board.columns && row < board.rows;

export function createTacticalBoard({ columns = 8, rows = 8, tileSize = 1, blocked = [] } = {}) {
  if (!validSize(columns) || !validSize(rows) || !validNumber(tileSize) ||
      tileSize <= 0 || tileSize > 100 || !Array.isArray(blocked)) fail('Invalid tactical board');
  const ids = new Set();
  for (const cell of blocked) {
    if (!cell || !validCell({ columns, rows }, cell.col, cell.row)) fail('Invalid blocked tile');
    const id = `${cell.col}:${cell.row}`;
    if (ids.has(id)) fail('Duplicate blocked tile');
    ids.add(id);
  }
  return Object.freeze({ columns, rows, tileSize, blocked: Object.freeze([...ids]) });
}

export function tacticalCellId(board, col, row) {
  if (!board || !validCell(board, col, row)) fail('Cell outside tactical board');
  return `${col}:${row}`;
}

export function tacticalCellCenter(board, col, row) {
  tacticalCellId(board, col, row);
  return {
    x: (col + 0.5 - board.columns / 2) * board.tileSize,
    y: 0,
    z: (row + 0.5 - board.rows / 2) * board.tileSize,
  };
}

// Exact boundaries use floor: 0-based tiles occupy half-open intervals.
// With the default 8x8, X/Z each range from -4 (included) to +4 (excluded).
export function tacticalCellAtWorld(board, x, z) {
  if (!board || !validNumber(x) || !validNumber(z)) return null;
  const col = Math.floor(x / board.tileSize + board.columns / 2);
  const row = Math.floor(z / board.tileSize + board.rows / 2);
  if (!validCell(board, col, row)) return null;
  return { col, row, id: tacticalCellId(board, col, row),
    blocked: board.blocked.includes(`${col}:${row}`) };
}

// Pointer conversion uses the actual CSS canvas rectangle, not window size, DPR,
// screen resolution, sidebar offsets, or the WebGL drawing-buffer pixel count.
export function pointerToCanvasNdc(clientX, clientY, rect) {
  if (!validNumber(clientX) || !validNumber(clientY) || !rect ||
      !validNumber(rect.left) || !validNumber(rect.top) ||
      !validNumber(rect.width) || !validNumber(rect.height) ||
      rect.width <= 0 || rect.height <= 0) fail('Invalid canvas pointer rectangle');
  return { x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1 };
}

export function canvasNdcToClient(ndc, rect) {
  if (!ndc || !validNumber(ndc.x) || !validNumber(ndc.y) || !rect ||
      !validNumber(rect.left) || !validNumber(rect.top) ||
      !validNumber(rect.width) || !validNumber(rect.height) ||
      rect.width <= 0 || rect.height <= 0) fail('Invalid camera projection rectangle');
  return { x: rect.left + ((ndc.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndc.y) / 2) * rect.height };
}

export function isTacticalCellWalkable(board, col, row) {
  const id = tacticalCellId(board, col, row);
  return !board.blocked.includes(id);
}
