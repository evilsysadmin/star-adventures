// Authenticated-in-campaign ground interactions derive the actual operator pose
// from the independently replayed squad journal, never from the legacy camera.
import { replayGroundSquadPositions } from './groundSquadPositions.mjs';
import { applyExploration } from './spatial.mjs';

const DIRECTIONS = [
  { dx: 0, dy: -1, heading: 'N' },
  { dx: 1, dy: 0, heading: 'E' },
  { dx: 0, dy: 1, heading: 'S' },
  { dx: -1, dy: 0, heading: 'W' },
];

/**
 * Resolve an existing station through canonical "use" rules, but from the
 * specified deployed officer's real saved cell. Do not mutate the campaign
 * camera, the journal or the mission; the caller invokes an authorized action.
 */
export function groundStationUse(world, away, snapshot, officerId, stationId) {
  const officers = replayGroundSquadPositions(world, away, snapshot).officers;
  if (typeof officerId !== 'string' || typeof stationId !== 'string')
    throw new TypeError('Invalid ground interaction identifiers');
  const officer = officers.find(unit => unit.id === officerId);
  const station = world.scenes.surface.objects.find(item =>
    item.id === stationId && item.type === 'station');
  if (!officer || !station) throw new RangeError('Unknown deployed officer or station');
  const direction = DIRECTIONS.find(step =>
    officer.x + step.dx === station.x && officer.y + step.dy === station.y);
  if (!direction) throw new RangeError('Selected officer is not adjacent to station');

  const pose = {
    version: 1, area: 'surface', x: officer.x, y: officer.y,
    heading: direction.heading, pending: null,
  };
  const result = applyExploration(world, pose, { type: 'use' });
  if (result.event.type !== 'station' || result.event.stationId !== stationId)
    throw new RangeError('Station cannot be used from this officer');
  return { pose, event: result.event };
}
