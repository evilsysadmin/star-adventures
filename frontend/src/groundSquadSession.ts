import { startAwayTeam } from '../../src/awayTeam.mjs';
import {
  startGroundSquadPositions, deserializeGroundSquadPositions,
  serializeGroundSquadPositions, replayGroundSquadPositions, orderGroundOfficerMove,
} from '../../src/groundSquadPositions.mjs';

// Optional versioned squad snapshot. Legacy spatial.v1 remains authoritative
// for first-person mission stations, transporter and bridge transitions.
export const GROUND_SQUAD_KEY = 'shadowops.star-adventures.ground-squad.v1';
export type SurfaceSpatial = {
  version: number; area: string; x: number; y: number; heading: string;
  pending: null | {id: string; to: string};
};
export type GroundSnapshot = {
  version: number;
  origin: {x: number; y: number; heading: string};
  squad: string[];
  commands: Array<{officerId: string; x: number; y: number}>;
};
export type GroundOfficer = {id: string; x: number; y: number; heading: string};
type StorageRead = Pick<Storage, 'getItem'> | null;
type StorageWrite = Pick<Storage, 'setItem'> | null;
type StorageRemove = Pick<Storage, 'removeItem'> | null;
const deployed = (ids: string[]) => ({...startAwayTeam(), squad: [...ids]});

export function matchesGroundAnchor(snapshot: GroundSnapshot, spatial: SurfaceSpatial, ids: string[]): boolean {
  // Turning the legacy camera without walking must NOT erase individual progress.
  return snapshot.version === 1 && snapshot.origin.x === spatial.x &&
    snapshot.origin.y === spatial.y &&
    snapshot.squad.length === ids.length && snapshot.squad.every((id,index) => id === ids[index]);
}

export function restoreGroundSnapshot(world: unknown, spatial: SurfaceSpatial, ids: string[],
  storage: StorageRead): GroundSnapshot | null {
  if (spatial.area !== 'surface' || spatial.pending !== null) return null;
  const away = deployed(ids);
  const fresh = () => startGroundSquadPositions(world, spatial, away) as GroundSnapshot;
  try {
    const raw = storage?.getItem(GROUND_SQUAD_KEY);
    if (raw) {
      const candidate = deserializeGroundSquadPositions(world, away, raw) as GroundSnapshot;
      if (matchesGroundAnchor(candidate, spatial, ids)) return candidate;
    }
  } catch {
    // Corruption, blocked storage, stale roster or impossible replay fail closed.
  }
  return fresh();
}

export function groundOfficers(world: unknown, ids: string[], snapshot: GroundSnapshot): GroundOfficer[] {
  return replayGroundSquadPositions(world, deployed(ids), snapshot).officers as GroundOfficer[];
}

export function moveGroundOfficer(world: unknown, ids: string[], snapshot: GroundSnapshot,
  officerId: string, target: {x: number; y: number}): {snapshot: GroundSnapshot; moved: boolean} {
  const move = orderGroundOfficerMove(world, deployed(ids), snapshot, officerId, target);
  return {snapshot: move.snapshot as GroundSnapshot, moved: move.route.length !== 0};
}

export function persistGroundSnapshot(world: unknown, ids: string[], snapshot: GroundSnapshot,
  storage: StorageWrite): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GROUND_SQUAD_KEY, serializeGroundSquadPositions(world, deployed(ids), snapshot));
    return true;
  } catch { return false; }
}

export function clearGroundSnapshot(storage: StorageRemove): boolean {
  if (!storage) return false;
  try { storage.removeItem(GROUND_SQUAD_KEY); return true; }
  catch { return false; }
}
