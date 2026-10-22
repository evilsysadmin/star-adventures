// Small validated exploration snapshot, independent of mission/crew v2 checkpoints.
// Snapshot data is untrusted browser storage; never save a pending transport dialog.
import { validateExploration, startExploration } from './spatial.mjs';

export const SPATIAL_SAVE_VERSION = 1;
export const MAX_SPATIAL_SAVE_BYTES = 1024;

export class SpatialCheckpointError extends Error {
  constructor(message) { super(message); this.name = 'SpatialCheckpointError'; }
}
const fail = message => { throw new SpatialCheckpointError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function serializeSpatialCheckpoint(world, state) {
  try { validateExploration(world, state); } catch { fail('Invalid spatial state'); }
  const data = {
    saveVersion: SPATIAL_SAVE_VERSION,
    worldVersion: world.version,
    area: state.area,
    x: state.x,
    y: state.y,
    heading: state.heading,
  };
  const raw = JSON.stringify(data);
  if (raw.length > MAX_SPATIAL_SAVE_BYTES) fail('Oversized spatial checkpoint');
  return raw;
}

export function deserializeSpatialCheckpoint(world, raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_SPATIAL_SAVE_BYTES)
    fail('Missing or oversized spatial checkpoint');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('Malformed spatial checkpoint'); }
  if (!object(parsed) || parsed.saveVersion !== SPATIAL_SAVE_VERSION ||
      parsed.worldVersion !== world.version ||
      Object.keys(parsed).sort().join(',') !== 'area,heading,saveVersion,worldVersion,x,y') {
    fail('Unsupported spatial checkpoint version or shape');
  }
  const state = { version: 1, area: parsed.area, x: parsed.x, y: parsed.y, heading: parsed.heading, pending: null };
  try { validateExploration(world, state); } catch { fail('Unsafe spatial checkpoint'); }
  return state;
}

// Convenience wrapper for callers: a corrupt, future-version or blocked checkpoint
// safely returns the authored spawn, rather than forcing a wall/teleporter intersection.
export function recoverSpatialCheckpoint(world, raw) {
  if (raw === null || raw === undefined) return { state: startExploration(world), notice: 'fresh' };
  try {
    return { state: deserializeSpatialCheckpoint(world, raw), notice: 'restored' };
  } catch {
    return { state: startExploration(world), notice: 'reset-invalid' };
  }
}
