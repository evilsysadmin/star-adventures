// Separate v2 encounter checkpoint: v1 training saves must never be silently
// reinterpreted as hostile-occupied missions. Derived positions are replayed,
// never accepted from storage. No browser, renderer or network dependency.
import {
  SCENARIOS, type MissionAction, type ScenarioId,
} from './isoScenarioCampaign.ts';
import {
  MAX_SCENARIO_CHECKPOINT_BYTES, replayScenarioCommands,
} from './isoScenarioCheckpoint.ts';
import { replayHostileEncounter, type HostileEncounter } from './isoScenarioHostileEncounter.ts';

export const HOSTILE_ENCOUNTER_CHECKPOINT_VERSION = 2;
export const HOSTILE_ENCOUNTER_SAVE_KEY = 'shadowops.star-adventures.hostile-encounter.v2';

export type HostileEncounterHistory = Readonly<{
  scenarioId: ScenarioId;
  actions: readonly MissionAction[];
  encounter: HostileEncounter;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function replayHostileEncounterCommands(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): HostileEncounterHistory {
  // The existing strict command parser rejects unknown keys, malformed
  // actions and oversized histories before hostile replay begins.
  const parsed = replayScenarioCommands(scenarioId, commands);
  const encounter = replayHostileEncounter(scenarioId, parsed.actions);
  return Object.freeze({
    scenarioId: parsed.scenarioId,
    actions: Object.freeze([...parsed.actions]),
    encounter,
  });
}

export function serializeHostileEncounterCheckpoint(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): string {
  const history = replayHostileEncounterCommands(scenarioId, commands);
  const raw = JSON.stringify({
    version: HOSTILE_ENCOUNTER_CHECKPOINT_VERSION,
    scenarioId: history.scenarioId,
    actions: history.actions,
  });
  if (raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new RangeError('Hostile encounter checkpoint too large');
  return raw;
}

export function deserializeHostileEncounterCheckpoint(raw: string): HostileEncounterHistory {
  if (typeof raw !== 'string' || raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new TypeError('Invalid hostile encounter checkpoint size');
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new TypeError('Malformed hostile encounter checkpoint'); }
  if (!isRecord(data) ||
      Object.keys(data).length !== 3 ||
      !['version', 'scenarioId', 'actions'].every(key => Object.hasOwn(data, key)) ||
      data.version !== HOSTILE_ENCOUNTER_CHECKPOINT_VERSION ||
      typeof data.scenarioId !== 'string' ||
      !Object.hasOwn(SCENARIOS, data.scenarioId) ||
      !Array.isArray(data.actions))
    throw new TypeError('Incompatible hostile encounter checkpoint');
  return replayHostileEncounterCommands(data.scenarioId as ScenarioId, data.actions as MissionAction[]);
}
