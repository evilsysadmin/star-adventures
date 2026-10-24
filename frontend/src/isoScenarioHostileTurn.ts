// Pure, deterministic first enemy-turn rule for the authored tactical sandbox.
// No Three.js, React, wall-clock timing, RNG, damage or campaign save authority.
// The UI/mission reducer will consume this planner in a later, versioned integration.
import { validateScenario, type Scenario, type ScenarioHostile, type SquadId } from './isoScenarioCampaign.ts';

export type HostileId = ScenarioHostile['id'];
export type HostileMove = Readonly<{ hostile: HostileId; from: string; to: string }>;
export type HostileThreat = Readonly<{ hostile: HostileId; officer: SquadId; cell: string }>;
export type HostileTurn = Readonly<{
  positions: Readonly<Record<HostileId, string>>;
  moves: readonly HostileMove[];
  threats: readonly HostileThreat[];
}>;

const OFFICERS: readonly SquadId[] = ['science', 'security', 'medic'];
const HOSTILES: readonly HostileId[] = ['aegis', 'veil'];
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function coordinate(cell: string, size: number): { x: number; y: number } | null {
  if (typeof cell !== 'string' || !/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(cell)) return null;
  const [x, y] = cell.split(':').map(Number);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
    x < size && y < size ? { x, y } : null;
}
function neighbors(cell: string, size: number): string[] {
  const point = coordinate(cell, size);
  if (!point) return [];
  return DIRECTIONS.map(([dx, dy]) => ({ x: point.x + dx, y: point.y + dy }))
    .filter(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size)
    .map(p => `${p.x}:${p.y}`);
}
function shortestPath(start: string, end: string, blocked: ReadonlySet<string>, size: number): string[] | null {
  if (blocked.has(end)) return null;
  const queue = [start];
  const parent = new Map<string, string | null>([[start, null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current === end) break;
    for (const next of neighbors(current, size)) {
      if (!blocked.has(next) && !parent.has(next)) {
        parent.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!parent.has(end)) return null;
  const path: string[] = [];
  let current: string | null = end;
  while (current !== null) {
    path.push(current);
    current = parent.get(current) ?? null;
  }
  return path.reverse();
}

/**
 * Each hostile acts once, in authored order: threaten an adjacent officer or
 * move one orthogonal tile toward the nearest reachable adjacent firing position.
 * Walls, cover, objectives, extraction, squad and other hostiles block movement.
 * Stable officer/direction tie breaks make repeated inputs produce identical turns.
 * A threat is an intent marker, NOT an attack, hit, injury or completed combat.
 */
export function planHostileTurn(
  scenario: Scenario,
  squad: Readonly<Record<SquadId, string>>,
  hostilePositions: Readonly<Record<HostileId, string>>,
): HostileTurn {
  validateScenario(scenario);
  if (!squad || !hostilePositions ||
      Object.keys(squad).length !== OFFICERS.length ||
      Object.keys(hostilePositions).length !== HOSTILES.length)
    throw new TypeError('Invalid tactical occupants');
  const terrain = new Set([
    ...scenario.walls, ...scenario.cover, scenario.sensor, scenario.extraction,
    ...(scenario.console ? [scenario.console] : []),
    ...(scenario.survivor ? [scenario.survivor] : []),
  ]);
  const occupied = new Set<string>(terrain);
  for (const officer of OFFICERS) {
    const cell = squad[officer];
    if (!coordinate(cell, scenario.size) || occupied.has(cell))
      throw new TypeError('Invalid or overlapping squad position');
    occupied.add(cell);
  }
  for (const hostile of HOSTILES) {
    const cell = hostilePositions[hostile];
    if (!coordinate(cell, scenario.size) || occupied.has(cell))
      throw new TypeError('Invalid or overlapping hostile position');
    occupied.add(cell);
  }
  const positions = { ...hostilePositions };
  const moves: HostileMove[] = [];
  const threats: HostileThreat[] = [];
  for (const hostile of scenario.hostiles) {
    const from = positions[hostile.id];
    const adjacent = OFFICERS.find(officer => neighbors(from, scenario.size).includes(squad[officer]));
    if (adjacent) {
      threats.push(Object.freeze({ hostile: hostile.id, officer: adjacent, cell: from }));
      continue;
    }
    const blocked = new Set(occupied);
    blocked.delete(from);
    let route: string[] | null = null;
    for (const officer of OFFICERS) {
      for (const destination of neighbors(squad[officer], scenario.size)) {
        const candidate = shortestPath(from, destination, blocked, scenario.size);
        if (candidate && (!route || candidate.length < route.length)) route = candidate;
      }
    }
    if (!route || route.length < 2) continue; // boxed in: do not teleport or invent an attack
    const to = route[1];
    occupied.delete(from);
    occupied.add(to);
    positions[hostile.id] = to;
    moves.push(Object.freeze({ hostile: hostile.id, from, to }));
  }
  return Object.freeze({
    positions: Object.freeze(positions),
    moves: Object.freeze(moves),
    threats: Object.freeze(threats),
  });
}
