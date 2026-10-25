// Pure line-of-sight gate for future player counterattacks in the opt-in
// tactical encounter. This does NOT apply damage or change v3 replay/saves.
// Covers, terrain, squad mates and other contacts block shots; renderer never
// determines hits. Board sizes are authored (10/12), not training's 8x8.
import {
  SCENARIOS, validateMission, type SquadId,
} from './isoScenarioCampaign.ts';
import type { HostileId } from './isoScenarioHostileTurn.ts';
import type { CombatEncounter } from './isoScenarioCombatEncounter.ts';

export type CombatAimReason =
  | 'ready' | 'unknown-officer' | 'unknown-hostile' | 'incapacitated'
  | 'encounter-ended' | 'no-action-points' | 'out-of-range'
  | 'terrain-blocked' | 'ally-blocked' | 'contact-blocked';
export type CombatAim = Readonly<{
  allowed: boolean;
  reason: CombatAimReason;
  cells: readonly string[];
  blocker: string | null;
}>;
export const COMBAT_SHOT_MAX_RANGE = 7.5;

const point = (cell: string, size: number): { x: number; y: number } | null => {
  if (typeof cell !== 'string' || !/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(cell)) return null;
  const [x, y] = cell.split(':').map(Number);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
    x < size && y < size ? { x, y } : null;
};

/** Conservative supercover: exact diagonal corners include both flank cells.
 * Never let a visual sprite or an interpolated position decide obstruction.
 */
export function traceCombatRay(from: string, to: string, size: number): readonly string[] {
  if (![8, 10, 12].includes(size)) throw new RangeError('Unsupported combat board size');
  const a = point(from, size), b = point(to, size);
  if (!a || !b) throw new RangeError('Invalid combat ray endpoint');
  const dx = b.x - a.x, dy = b.y - a.y;
  if (!dx && !dy) return [from];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const stepX = dx ? 1 / Math.abs(dx) : Infinity;
  const stepY = dy ? 1 / Math.abs(dy) : Infinity;
  let tx = stepX / 2, ty = stepY / 2, x = a.x, y = a.y;
  const cells = [from];
  const add = (col: number, row: number) => {
    const cell = String(col) + ':' + String(row);
    if (col >= 0 && row >= 0 && col < size && row < size && !cells.includes(cell))
      cells.push(cell);
  };
  while (x !== b.x || y !== b.y) {
    if (Math.abs(tx - ty) < 1e-10) {
      add(x + sx, y);
      add(x, y + sy);
      x += sx; y += sy; tx += stepX; ty += stepY;
    } else if (tx < ty) { x += sx; tx += stepX; }
    else { y += sy; ty += stepY; }
    add(x, y);
  }
  return cells;
}

export function evaluateCombatAim(
  encounter: CombatEncounter, officer: SquadId, hostile: HostileId,
): CombatAim {
  const deny = (reason: CombatAimReason, cells: readonly string[] = [],
    blocker: string | null = null): CombatAim => ({ allowed: false, reason, cells, blocker });
  const mission = encounter.mission;
  validateMission(mission);
  const scenario = SCENARIOS[mission.scenarioId];
  if (!['science', 'security', 'medic'].includes(officer)) return deny('unknown-officer');
  if (!scenario.hostiles.some(contact => contact.id === hostile)) return deny('unknown-hostile');
  if (mission.completed || encounter.failed) return deny('encounter-ended');
  if (encounter.health[officer] <= 0) return deny('incapacitated');
  if (mission.ap < 1) return deny('no-action-points');
  const start = mission.locations[officer], end = encounter.positions[hostile];
  const a = point(start, scenario.size), b = point(end, scenario.size);
  if (!a || !b) throw new TypeError('Invalid replayed combat occupant');
  if (Math.hypot(a.x - b.x, a.y - b.y) > COMBAT_SHOT_MAX_RANGE)
    return deny('out-of-range');
  const cells = traceCombatRay(start, end, scenario.size);
  const terrain = new Set([
    ...scenario.walls, ...scenario.cover, scenario.sensor,
    ...(scenario.console ? [scenario.console] : []),
    ...(scenario.survivor ? [scenario.survivor] : []),
  ]);
  const allies = new Set(Object.entries(mission.locations)
    .filter(([id]) => id !== officer).map(([, cell]) => cell));
  const contacts = new Set(Object.entries(encounter.positions)
    .filter(([id]) => id !== hostile).map(([, cell]) => cell));
  for (const cell of cells.slice(1, -1)) {
    if (terrain.has(cell)) return deny('terrain-blocked', cells, cell);
    if (allies.has(cell)) return deny('ally-blocked', cells, cell);
    if (contacts.has(cell)) return deny('contact-blocked', cells, cell);
  }
  return { allowed: true, reason: 'ready', cells, blocker: null };
}
