// Opt-in, deterministic encounter replay. The existing training mission and its
// v1 checkpoint remain unchanged until hostile occupancy is wired into the UI.
// No renderer, clock, storage, random source or damage authority lives here.
import {
  SCENARIOS, createMission, applyMissionAction, missionPath,
  type ScenarioId, type MissionAction, type MissionState,
} from './isoScenarioCampaign.ts';
import {
  planHostileTurn, type HostileId, type HostileMove, type HostileThreat,
} from './isoScenarioHostileTurn.ts';
import { MAX_SCENARIO_COMMANDS } from './isoScenarioCheckpoint.ts';

export type HostileEncounter = Readonly<{
  mission: MissionState;
  positions: Readonly<Record<HostileId, string>>;
  moves: readonly HostileMove[];
  threats: readonly HostileThreat[];
  enemyTurns: number;
}>;

/**
 * Reconstruct enemy positions solely from authored scenario data and legal
 * player commands. Enemy movement happens once per end-turn, not per render.
 * Threats are intentions only: this deliberately does not invent injuries.
 *
 * Unlike legacy training, encounter movement cannot traverse occupied hostile
 * cells. This separate replay must not be used to reinterpret existing v1 saves
 * until a versioned migration and real browser journeys are validated.
 */
export function replayHostileEncounter(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): HostileEncounter {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new RangeError('Unknown tactical scenario');
  if (!Array.isArray(commands) || commands.length > MAX_SCENARIO_COMMANDS)
    throw new TypeError('Invalid or oversized encounter history');

  let mission = createMission(scenarioId);
  let positions = Object.fromEntries(
    scenario.hostiles.map(hostile => [hostile.id, hostile.cell]),
  ) as Record<HostileId, string>;
  let moves: readonly HostileMove[] = [];
  let threats: readonly HostileThreat[] = [];
  let enemyTurns = 0;

  for (const command of commands) {
    if (!command || typeof command !== 'object')
      throw new TypeError('Invalid encounter command');
    const occupied = Object.values(positions);
    if (command.type === 'move') {
      const original = missionPath(mission, command.officer, command.cell);
      const safe = missionPath(mission, command.officer, command.cell, occupied);
      if (original && original.length <= 6 && (!safe || safe.length > 6))
        throw new RangeError('Hostile contact blocks this movement route');
    }
    mission = applyMissionAction(mission, command, occupied);
    if (command.type === 'end-turn') {
      const turn = planHostileTurn(scenario, mission.locations, positions);
      positions = { ...turn.positions };
      moves = turn.moves;
      threats = turn.threats;
      enemyTurns++;
    } else {
      // The last enemy action belongs to its own turn, not a later player order.
      moves = [];
      threats = [];
    }
  }
  return Object.freeze({
    mission,
    positions: Object.freeze({ ...positions }),
    moves: Object.freeze([...moves]),
    threats: Object.freeze([...threats]),
    enemyTurns,
  });
}
