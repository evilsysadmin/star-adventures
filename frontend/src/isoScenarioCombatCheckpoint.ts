// V3 combat snapshots store only authored commands. Injury, defeat, enemy
// positions and mission state must always be reconstructed by pure replay.
// Existing v1 training and v2 hostile saves are never read or overwritten.
import {
  SCENARIOS, type MissionAction, type ScenarioId,
} from './isoScenarioCampaign.ts';
import { MAX_SCENARIO_CHECKPOINT_BYTES } from './isoScenarioCheckpoint.ts';
import {
  replayHostileEncounterCommands,
} from './isoScenarioHostileCheckpoint.ts';
import {
  replayCombatEncounter, type CombatEncounter,
} from './isoScenarioCombatEncounter.ts';

export const COMBAT_ENCOUNTER_CHECKPOINT_VERSION = 3;
export const COMBAT_ENCOUNTER_SAVE_KEY = 'shadowops.star-adventures.combat-encounter.v3';

export type CombatEncounterHistory = Readonly<{
  scenarioId: ScenarioId;
  actions: readonly MissionAction[];
  encounter: CombatEncounter;
}>;

export function replayCombatEncounterCommands(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): CombatEncounterHistory {
  // V2 already uses the strict v1 action parser and verifies hostile occupancy.
  const parsed = replayHostileEncounterCommands(scenarioId, commands);
  const encounter = replayCombatEncounter(parsed.scenarioId, parsed.actions);
  return Object.freeze({
    scenarioId: parsed.scenarioId,
    actions: Object.freeze([...parsed.actions]),
    encounter,
  });
}

export function serializeCombatEncounterCheckpoint(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): string {
  const history = replayCombatEncounterCommands(scenarioId, commands);
  const raw = JSON.stringify({
    version: COMBAT_ENCOUNTER_CHECKPOINT_VERSION,
    scenarioId: history.scenarioId,
    actions: history.actions,
  });
  if (raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new RangeError('Combat encounter checkpoint too large');
  return raw;
}

export function deserializeCombatEncounterCheckpoint(raw: string): CombatEncounterHistory {
  if (typeof raw !== 'string' || raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new TypeError('Invalid combat encounter checkpoint size');
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new TypeError('Malformed combat encounter checkpoint'); }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new TypeError('Incompatible combat encounter checkpoint');
  const record = data as Record<string, unknown>;
  if (Object.keys(record).length !== 3 ||
      !['version', 'scenarioId', 'actions'].every(key => Object.hasOwn(record, key)) ||
      record.version !== COMBAT_ENCOUNTER_CHECKPOINT_VERSION ||
      typeof record.scenarioId !== 'string' ||
      !Object.hasOwn(SCENARIOS, record.scenarioId) ||
      !Array.isArray(record.actions))
    throw new TypeError('Incompatible combat encounter checkpoint');
  return replayCombatEncounterCommands(record.scenarioId as ScenarioId, record.actions as MissionAction[]);
}
