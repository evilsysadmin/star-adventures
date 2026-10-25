// Versioned identity for one tactical mission attempt, independent of its
// commands. Two attempts may have identical orders but must not share credit.
// This is an opt-in pure contract, not yet wired into the v4 UI or campaign.
import {
  deserializeCombatReplay, serializeCombatReplay,
  type CombatReplayHistory,
} from './isoScenarioCombatReplay.ts';
import { MAX_SCENARIO_CHECKPOINT_BYTES } from './isoScenarioCheckpoint.ts';

export const COMBAT_MISSION_INSTANCE_VERSION = 1;
export const MAX_COMBAT_MISSION_INSTANCE_BYTES = MAX_SCENARIO_CHECKPOINT_BYTES + 200;

export type CombatMissionInstance = Readonly<{
  instanceId: string;
  history: CombatReplayHistory;
}>;

// The caller supplies crypto.randomUUID() at the UI boundary. The replay
// engine remains deterministic and has no browser, clock or random dependency.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validId(instanceId: string): string {
  if (typeof instanceId !== 'string' || !UUID_V4.test(instanceId)) {
    throw new TypeError('Invalid tactical mission instance ID');
  }
  return instanceId;
}

export function createCombatMissionInstance(
  instanceId: string, history: CombatReplayHistory,
): CombatMissionInstance {
  validId(instanceId);
  // Never trust caller-provided health, victory or objective flags.
  const checkpoint = serializeCombatReplay(history.scenarioId, history.actions);
  return Object.freeze({
    instanceId,
    history: deserializeCombatReplay(checkpoint),
  });
}

/** Advance one attempt without allowing a different mission or rewritten past. */
export function advanceCombatMissionInstance(
  current: CombatMissionInstance, next: CombatReplayHistory,
): CombatMissionInstance {
  const before = createCombatMissionInstance(current.instanceId, current.history);
  if (before.history.scenarioId !== next.scenarioId ||
      next.actions.length < before.history.actions.length) {
    throw new RangeError('Cannot replace tactical mission history');
  }
  const advanced = createCombatMissionInstance(current.instanceId, next);
  const prefix = advanced.history.actions.slice(0, before.history.actions.length);
  if (JSON.stringify(prefix) !== JSON.stringify(before.history.actions)) {
    throw new RangeError('Cannot rewrite tactical mission history');
  }
  return advanced;
}

/** Portable evidence envelope; never overwrites or migrates existing v4 saves. */
export function serializeCombatMissionInstance(instance: CombatMissionInstance): string {
  validId(instance.instanceId);
  const checkpoint = serializeCombatReplay(instance.history.scenarioId, instance.history.actions);
  const raw = JSON.stringify({
    version: COMBAT_MISSION_INSTANCE_VERSION, instanceId: instance.instanceId, checkpoint,
  });
  if (raw.length > MAX_COMBAT_MISSION_INSTANCE_BYTES) {
    throw new RangeError('Tactical mission instance too large');
  }
  return raw;
}

export function deserializeCombatMissionInstance(raw: string): CombatMissionInstance {
  if (typeof raw !== 'string' || raw.length > MAX_COMBAT_MISSION_INSTANCE_BYTES) {
    throw new TypeError('Invalid tactical mission instance size');
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new TypeError('Malformed tactical mission instance'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Incompatible tactical mission instance');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 3 ||
      !['version', 'instanceId', 'checkpoint'].every(key => Object.hasOwn(record, key)) ||
      record.version !== COMBAT_MISSION_INSTANCE_VERSION ||
      typeof record.instanceId !== 'string' ||
      typeof record.checkpoint !== 'string') {
    throw new TypeError('Incompatible tactical mission instance');
  }
  validId(record.instanceId);
  const history = deserializeCombatReplay(record.checkpoint);
  if (serializeCombatReplay(history.scenarioId, history.actions) !== record.checkpoint) {
    throw new TypeError('Noncanonical tactical mission evidence');
  }
  return createCombatMissionInstance(record.instanceId, history);
}
