// Replay-only checkpoint for the optional authored tactical sandbox.
// No WebGL, browser, storage or campaign save dependency.
import {
  SCENARIOS, createMission, applyMissionAction,
  type ScenarioId, type SquadId, type MissionAction, type MissionState,
} from './isoScenarioCampaign';

export const SCENARIO_CHECKPOINT_VERSION = 1;
export const MAX_SCENARIO_COMMANDS = 256;
export const MAX_SCENARIO_CHECKPOINT_BYTES = 32768;
export type ScenarioHistory = Readonly<{
  scenarioId: ScenarioId;
  actions: readonly MissionAction[];
  state: MissionState;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length &&
  Object.keys(value).every(key => expected.includes(key));
const isScenarioId = (value: unknown): value is ScenarioId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENARIOS, value);
const isOfficer = (value: unknown): value is SquadId =>
  value === 'science' || value === 'security' || value === 'medic';

function readAction(value: unknown): MissionAction {
  if (!isRecord(value)) throw new TypeError('Invalid tactical command');
  switch (value.type) {
    case 'end-turn':
      if (exactKeys(value, ['type'])) return { type: 'end-turn' };
      break;
    case 'move':
      if (exactKeys(value, ['type', 'officer', 'cell']) &&
          isOfficer(value.officer) && typeof value.cell === 'string' &&
          /^(0|[1-9]\d?):(0|[1-9]\d?)$/.test(value.cell))
        return { type: 'move', officer: value.officer, cell: value.cell };
      break;
    case 'scan':
      if (exactKeys(value, ['type', 'officer']) && value.officer === 'science')
        return { type: 'scan', officer: 'science' };
      break;
    case 'operate':
      if (exactKeys(value, ['type', 'officer']) && value.officer === 'security')
        return { type: 'operate', officer: 'security' };
      break;
    case 'rescue':
      if (exactKeys(value, ['type', 'officer']) && value.officer === 'medic')
        return { type: 'rescue', officer: 'medic' };
      break;
    case 'extract':
      if (exactKeys(value, ['type', 'officer']) && isOfficer(value.officer))
        return { type: 'extract', officer: value.officer };
      break;
  }
  throw new TypeError('Unsupported or malformed tactical command');
}

// The saved history is untrusted: rebuild every derived position, AP, objective and
// victory through the authoritative domain reducer; never trust a snapshot of flags.
export function replayScenarioCommands(scenarioId: ScenarioId, input: readonly MissionAction[]): ScenarioHistory {
  if (!isScenarioId(scenarioId) || !Array.isArray(input) || input.length > MAX_SCENARIO_COMMANDS)
    throw new TypeError('Invalid or oversized tactical history');
  let state = createMission(scenarioId);
  const actions: MissionAction[] = [];
  for (const item of input) {
    const action = readAction(item);
    state = applyMissionAction(state, action);
    actions.push(action);
  }
  return { scenarioId, actions, state };
}

export function serializeScenarioCheckpoint(scenarioId: ScenarioId, commands: readonly MissionAction[]): string {
  const history = replayScenarioCommands(scenarioId, commands);
  const payload = JSON.stringify({
    version: SCENARIO_CHECKPOINT_VERSION,
    scenarioId: history.scenarioId,
    actions: history.actions,
  });
  if (payload.length > MAX_SCENARIO_CHECKPOINT_BYTES) throw new RangeError('Tactical checkpoint too large');
  return payload;
}

export function deserializeScenarioCheckpoint(raw: string): ScenarioHistory {
  if (typeof raw !== 'string' || raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new TypeError('Invalid tactical checkpoint size');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new TypeError('Malformed tactical checkpoint'); }
  if (!isRecord(data) || !exactKeys(data, ['version', 'scenarioId', 'actions']) ||
      data.version !== SCENARIO_CHECKPOINT_VERSION || !isScenarioId(data.scenarioId) ||
      !Array.isArray(data.actions))
    throw new TypeError('Incompatible tactical checkpoint');
  return replayScenarioCommands(data.scenarioId, data.actions);
}
