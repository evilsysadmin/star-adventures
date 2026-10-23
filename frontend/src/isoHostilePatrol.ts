// Deterministic presentation/rules fixture for the two original training
// hostiles. This is deliberately independent from Three.js and wall-clock
// scheduling: the renderer can interpolate it, while a later encounter state
// can use the exact same cells for movement and line-of-sight.

export type HostilePatrolId = 'aegis' | 'veil';
export type HostilePatrol = Readonly<{
  id: HostilePatrolId;
  label: string;
  cells: readonly string[];
}>;

export const HOSTILE_PATROL_STEP_MS = 900;

export const HOSTILE_PATROLS: readonly HostilePatrol[] = Object.freeze([
  Object.freeze({
    id: 'aegis', label: 'Incursor Aegis',
    cells: Object.freeze(['6:2', '6:1', '5:1', '5:2']),
  }),
  Object.freeze({
    id: 'veil', label: 'Agente Velo',
    cells: Object.freeze(['6:5', '6:6', '5:6', '5:5']),
  }),
]);

const validCell = (cell: string) => /^[0-7]:[0-7]$/.test(cell);

function patrolFor(id: HostilePatrolId): HostilePatrol {
  const patrol = HOSTILE_PATROLS.find(candidate => candidate.id === id);
  if (!patrol) throw new RangeError(`Unknown hostile patrol: ${id}`);
  return patrol;
}

/** Fail closed before an authored patrol is allowed to drive an encounter. */
export function validateHostilePatrols(patrols: readonly HostilePatrol[] = HOSTILE_PATROLS): void {
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const patrol of patrols) {
    if (!patrol || !['aegis', 'veil'].includes(patrol.id) || ids.has(patrol.id) ||
        patrol.cells.length < 2 || patrol.cells.some(cell => !validCell(cell)))
      throw new TypeError('Invalid hostile patrol');
    ids.add(patrol.id);
    for (const cell of patrol.cells) {
      if (cells.has(cell)) throw new TypeError('Hostile patrols may not overlap');
      cells.add(cell);
    }
  }
  if (ids.size !== 2) throw new TypeError('Training requires exactly two hostile patrols');
}

export type HostilePatrolPosition = Readonly<{
  from: string;
  to: string;
  fraction: number;
}>;

/**
 * Returns a repeatable segment and interpolation fraction for non-negative
 * elapsed time. No rendering or browser timing is involved.
 */
export function hostilePatrolPositionAt(
  id: HostilePatrolId, elapsedMs: number,
): HostilePatrolPosition {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw new RangeError('Patrol elapsed time must be a non-negative finite number');
  const patrol = patrolFor(id);
  const progress = elapsedMs / HOSTILE_PATROL_STEP_MS;
  const index = Math.floor(progress) % patrol.cells.length;
  return Object.freeze({
    from: patrol.cells[index],
    to: patrol.cells[(index + 1) % patrol.cells.length],
    fraction: progress - Math.floor(progress),
  });
}

/** The occupied authored target cells at an exact simulation step. */
export function hostilePatrolCellsAt(elapsedMs: number): readonly string[] {
  return Object.freeze(HOSTILE_PATROLS.map(patrol => hostilePatrolPositionAt(patrol.id, elapsedMs).from));
}

validateHostilePatrols();
