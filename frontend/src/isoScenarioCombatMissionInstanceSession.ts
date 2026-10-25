// Opt-in persistence for one replay-verified tactical attempt. The v4 replay
// checkpoint, extraction ledger and campaign remain independent and untouched.
// UI integration must explicitly start an attempt and keep both saves in sync.
import {
  createCombatMissionInstance, advanceCombatMissionInstance,
  deserializeCombatMissionInstance, serializeCombatMissionInstance,
  type CombatMissionInstance,
} from './isoScenarioCombatMissionInstance.ts';
import { newCombatReplaySession } from './isoScenarioCombatReplaySession.ts';
import type { ScenarioId } from './isoScenarioCampaign.ts';

export const COMBAT_MISSION_INSTANCE_SAVE_KEY =
  'shadowops.star-adventures.combat-mission-instance.v1';

export type MissionInstanceRead = Readonly<{
  status: 'ready' | 'missing' | 'incompatible' | 'unavailable';
  instance: CombatMissionInstance | null;
}>;
export type MissionInstanceWrite =
  'saved' | 'needs-start' | 'conflict' | 'incompatible' | 'unavailable';

export function readCombatMissionInstanceSession(
  storage: Pick<Storage, 'getItem'> | null,
): MissionInstanceRead {
  if (!storage) return { status: 'unavailable', instance: null };
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY); }
  catch { return { status: 'unavailable', instance: null }; }
  if (raw === null) return { status: 'missing', instance: null };
  try {
    return { status: 'ready', instance: deserializeCombatMissionInstance(raw) };
  } catch {
    // Preserve corrupt/future records for explicit recovery, never overwrite.
    return { status: 'incompatible', instance: null };
  }
}

function writeAndVerify(
  instance: CombatMissionInstance,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): MissionInstanceWrite {
  try {
    const raw = serializeCombatMissionInstance(instance);
    storage.setItem(COMBAT_MISSION_INSTANCE_SAVE_KEY, raw);
    return storage.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY) === raw
      ? 'saved' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Append-only save. A new attempt must first be explicitly started. */
export function persistCombatMissionInstanceSession(
  instance: CombatMissionInstance,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): MissionInstanceWrite {
  if (!storage) return 'unavailable';
  const current = readCombatMissionInstanceSession(storage);
  if (current.status === 'unavailable' || current.status === 'incompatible')
    return current.status;
  let validated: CombatMissionInstance;
  try {
    if (current.instance) {
      validated = advanceCombatMissionInstance(current.instance, instance.history);
      if (validated.instanceId !== instance.instanceId) return 'conflict';
    } else {
      // Do not retroactively give an already-played v4 history a fresh ID.
      if (instance.history.actions.length !== 0) return 'needs-start';
      validated = createCombatMissionInstance(instance.instanceId, instance.history);
    }
  } catch {
    return 'conflict';
  }
  return writeAndVerify(validated, storage);
}

/**
 * Explicit new attempt/restart, never an implicit fallback during restore.
 * The caller supplies a new crypto.randomUUID() at the UI boundary.
 * A new ID is required to replace an existing attempt; incompatible records
 * are protected. This does not clear or rewrite the independent v4 replay.
 */
export function restartCombatMissionInstanceSession(
  instanceId: string, scenarioId: ScenarioId,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): MissionInstanceWrite {
  if (!storage) return 'unavailable';
  const current = readCombatMissionInstanceSession(storage);
  if (current.status === 'unavailable' || current.status === 'incompatible')
    return current.status;
  if (current.instance?.instanceId === instanceId) return 'conflict';
  let fresh: CombatMissionInstance;
  try {
    fresh = createCombatMissionInstance(instanceId, newCombatReplaySession(scenarioId));
  } catch {
    return 'conflict';
  }
  return writeAndVerify(fresh, storage);
}
