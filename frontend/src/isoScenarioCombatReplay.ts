// Isolated v4 combat replay: movement, player fire and hostile retaliation share
// one authoritative command history. V1/v2/v3 saves and UI are untouched.
// No React, renderer, browser storage, network, clock or random source.
import {
  SCENARIOS, applyMissionAction,
  type MissionAction, type ScenarioId, type SquadId,
} from './isoScenarioCampaign.ts';
import { readAction, MAX_SCENARIO_COMMANDS, MAX_SCENARIO_CHECKPOINT_BYTES } from './isoScenarioCheckpoint.ts';
import { planHostileTurn, type HostileId } from './isoScenarioHostileTurn.ts';
import { replayCombatEncounter, type CombatEncounter, type CombatHit } from './isoScenarioCombatEncounter.ts';
import { startCombatFire, fireCombatShot, type CombatFireState } from './isoScenarioCombatFire.ts';

export const COMBAT_REPLAY_VERSION = 4;
export const COMBAT_REPLAY_SAVE_KEY = 'shadowops.star-adventures.combat-replay.v4';
export type CombatReplayAction = MissionAction | Readonly<{
  type: 'fire'; officer: SquadId; hostile: HostileId;
}>;
export type CombatReplayHistory = Readonly<{
  scenarioId: ScenarioId;
  actions: readonly CombatReplayAction[];
  combat: CombatFireState;
}>;

function readCombatAction(value: unknown): CombatReplayAction {
  if (value && typeof value === 'object' && !Array.isArray(value) &&
      (value as Record<string, unknown>).type === 'fire') {
    const item = value as Record<string, unknown>;
    if (Object.keys(item).length !== 3 ||
        !['type', 'officer', 'hostile'].every(key => Object.hasOwn(item, key)) ||
        !['science', 'security', 'medic'].includes(item.officer as string) ||
        !['aegis', 'veil'].includes(item.hostile as string))
      throw new TypeError('Malformed combat fire command');
    return { type: 'fire', officer: item.officer as SquadId, hostile: item.hostile as HostileId };
  }
  return readAction(value);
}

/** Replay validates every command, never trusting stored health or positions. */
export function replayCombatCommands(
  scenarioId: ScenarioId, commands: readonly CombatReplayAction[],
): CombatReplayHistory {
  if (!Object.hasOwn(SCENARIOS, scenarioId) ||
      !Array.isArray(commands) || commands.length > MAX_SCENARIO_COMMANDS)
    throw new TypeError('Invalid or oversized combat replay');
  const actions: CombatReplayAction[] = [];
  let combat = startCombatFire(replayCombatEncounter(scenarioId, []));
  for (const input of commands) {
    const action = readCombatAction(input);
    // Winning the firefight is not mission extraction. Preserve science/rescue
    // orders after the last hostile falls, but never permit another shot.
    if (combat.encounter.failed || combat.encounter.mission.completed ||
        (combat.victory && action.type === 'fire'))
      throw new RangeError('Combat encounter already ended');
    if (action.type === 'fire') {
      // Old end-turn markers must not masquerade as fresh impacts after firing.
      combat = fireCombatShot({
        ...combat,
        encounter: { ...combat.encounter, moves: [], threats: [], hits: [] },
      }, action.officer, action.hostile);
    } else {
      const defeated = (Object.keys(combat.hostileHealth) as HostileId[])
        .filter(id => combat.hostileHealth[id] === 0);
      const occupied = (Object.keys(combat.hostileHealth) as HostileId[])
        .filter(id => combat.hostileHealth[id] > 0)
        .map(id => combat.encounter.positions[id]);
      const mission = applyMissionAction(combat.encounter.mission, action, occupied);
      let positions = combat.encounter.positions;
      let moves: CombatEncounter['moves'] = [];
      let threats: CombatEncounter['threats'] = [];
      let hits: CombatHit[] = [];
      let health = combat.encounter.health;
      let failed = false;
      let enemyTurns = combat.encounter.enemyTurns;
      // After victory, an end-turn restores AP without a phantom enemy turn.
      if (action.type === 'end-turn' && !combat.victory) {
        const turn = planHostileTurn(
          SCENARIOS[scenarioId], mission.locations, positions, defeated,
        );
        positions = turn.positions;
        moves = turn.moves;
        threats = turn.threats;
        const nextHealth: Record<SquadId, number> = { ...health };
        for (const threat of threats) {
          if (nextHealth[threat.officer] === 0) continue;
          nextHealth[threat.officer]--;
          hits.push(Object.freeze({
            hostile: threat.hostile, officer: threat.officer, cell: threat.cell,
            damage: 1, remainingHp: nextHealth[threat.officer], round: mission.round - 1,
          }));
        }
        health = Object.freeze(nextHealth);
        failed = Object.values(health).some(hp => hp === 0);
        enemyTurns++;
      }
      combat = Object.freeze({
        ...combat,
        encounter: Object.freeze({
          ...combat.encounter, mission, positions, moves, threats,
          hits: Object.freeze(hits), health, failed, enemyTurns,
        }),
      });
    }
    actions.push(action);
  }
  return Object.freeze({
    scenarioId, actions: Object.freeze(actions), combat,
  });
}

/** A v4 checkpoint contains only validated commands, never mutable outcomes. */
export function serializeCombatReplay(
  scenarioId: ScenarioId, commands: readonly CombatReplayAction[],
): string {
  const history = replayCombatCommands(scenarioId, commands);
  const raw = JSON.stringify({
    version: COMBAT_REPLAY_VERSION, scenarioId: history.scenarioId, actions: history.actions,
  });
  if (raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new RangeError('Combat replay checkpoint too large');
  return raw;
}

export function deserializeCombatReplay(raw: string): CombatReplayHistory {
  if (typeof raw !== 'string' || raw.length > MAX_SCENARIO_CHECKPOINT_BYTES)
    throw new TypeError('Invalid combat replay checkpoint size');
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new TypeError('Malformed combat replay checkpoint'); }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new TypeError('Incompatible combat replay checkpoint');
  const record = data as Record<string, unknown>;
  if (Object.keys(record).length !== 3 ||
      !['version', 'scenarioId', 'actions'].every(key => Object.hasOwn(record, key)) ||
      record.version !== COMBAT_REPLAY_VERSION ||
      typeof record.scenarioId !== 'string' ||
      !Object.hasOwn(SCENARIOS, record.scenarioId) ||
      !Array.isArray(record.actions))
    throw new TypeError('Incompatible combat replay checkpoint');
  return replayCombatCommands(record.scenarioId as ScenarioId, record.actions as CombatReplayAction[]);
}
