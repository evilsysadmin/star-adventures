// Pure, dependency-free pathfinding for the ISOMETRIC VISUAL LAB.
// Not combat movement, an initiative system, or an authoritative campaign save.
// Grid identity, terrain, and unit occupancy are separate from Three.js meshes.

export type TrainingUnit = Readonly<{ id: 'science' | 'security' | 'medic'; cell: string }>;
export type TrainingState = Readonly<{ units: readonly TrainingUnit[] }>;
export type TrainingPlan = Readonly<{ unitId: TrainingUnit['id']; cells: readonly string[] }>;

export const TRAINING_COVER = Object.freeze(['3:3', '4:3']);
export const TRAINING_TARGETS = Object.freeze(['6:2', '6:5']);
export const TRAINING_START: TrainingState = Object.freeze({ units: Object.freeze([
  Object.freeze({ id: 'science' as const, cell: '1:1' }),
  Object.freeze({ id: 'security' as const, cell: '2:5' }),
  Object.freeze({ id: 'medic' as const, cell: '1:6' }),
]) });

const BOARD = 8;
const coordinate = (id: string) => {
  if (!/^[0-7]:[0-7]$/.test(id)) return null;
  const [col, row] = id.split(':').map(Number);
  return { col, row };
};
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const neighbors = (id: string): string[] => {
  const at = coordinate(id);
  if (!at) return [];
  return directions.map(([dx, dy]) => ({ x: at.col + dx, y: at.row + dy }))
    .filter(p => p.x >= 0 && p.y >= 0 && p.x < BOARD && p.y < BOARD)
    .map(p => `${p.x}:${p.y}`);
};

export function validateTrainingState(state: TrainingState): void {
  if (!state || !Array.isArray(state.units) || state.units.length !== 3)
    throw new TypeError('Training roster must have exactly three units');
  const ids = new Set<string>();
  const tiles = new Set<string>();
  const obstacles = new Set([...TRAINING_COVER, ...TRAINING_TARGETS]);
  for (const unit of state.units) {
    if (!unit || !['science', 'security', 'medic'].includes(unit.id) || ids.has(unit.id) ||
        !coordinate(unit.cell) || obstacles.has(unit.cell) || tiles.has(unit.cell))
      throw new TypeError('Invalid, blocked, or overlapping unit placement');
    ids.add(unit.id); tiles.add(unit.cell);
  }
}

/** Returns [starting cell, ..., destination] or null if unreachable / invalid.
 * Deterministic 4-neighbour BFS; cover, training targets, and OTHER units block passage.
 * A unit may stay in place, in which case it returns a one-cell plan (no movement).
 */
export function planTrainingMove(
  state: TrainingState, unitId: TrainingUnit['id'], destination: string,
): TrainingPlan | null {
  validateTrainingState(state);
  const officer = state.units.find(unit => unit.id === unitId);
  if (!officer || !coordinate(destination)) return null;
  if (destination === officer.cell) return { unitId, cells: [officer.cell] };
  const blocked = new Set([
    ...TRAINING_COVER, ...TRAINING_TARGETS,
    ...state.units.filter(unit => unit.id !== unitId).map(unit => unit.cell),
  ]);
  if (blocked.has(destination)) return null;
  const from = officer.cell;
  const queue = [from];
  const parent = new Map<string, string | null>([[from, null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === destination) break;
    for (const candidate of neighbors(current)) {
      if (!blocked.has(candidate) && !parent.has(candidate)) {
        parent.set(candidate, current);
        queue.push(candidate);
      }
    }
  }
  if (!parent.has(destination)) return null;
  const path: string[] = [];
  let here: string | null = destination;
  while (here !== null) { path.push(here); here = parent.get(here) ?? null; }
  path.reverse();
  return { unitId, cells: path };
}

/** Commit only the end of a freshly recomputed path; never trust UI-provided paths. */
export function commitTrainingMove(
  state: TrainingState, unitId: TrainingUnit['id'], destination: string,
): TrainingState {
  const plan = planTrainingMove(state, unitId, destination);
  if (!plan || plan.cells.length < 2) throw new RangeError('Training move is blocked or has no distance');
  const next: TrainingState = { units: state.units.map(unit =>
    unit.id === unitId ? { ...unit, cell: destination } : { ...unit }
  ) };
  validateTrainingState(next);
  return next;
}
