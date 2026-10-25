// Experimental v3 combat contract. V1 training and v2 hostile encounter replay
// remain untouched; health is reconstructed from legal commands, never saved.
// No browser, random, renderer, network or campaign state dependency.
import {
  type MissionAction, type ScenarioId, type SquadId,
} from './isoScenarioCampaign.ts';
import {
  replayHostileEncounter, type HostileEncounter,
} from './isoScenarioHostileEncounter.ts';
import {
  replayHostileEncounterCommands,
} from './isoScenarioHostileCheckpoint.ts';
import type { HostileId } from './isoScenarioHostileTurn.ts';

export const COMBAT_OFFICER_MAX_HP = 3;
export type CombatHit = Readonly<{
  hostile: HostileId;
  officer: SquadId;
  cell: string;
  damage: 1;
  remainingHp: number;
  round: number;
}>;
export type CombatEncounter = HostileEncounter & Readonly<{
  health: Readonly<Record<SquadId, number>>;
  hits: readonly CombatHit[];
  failed: boolean;
}>;

/**
 * Each adjacent hostile threat deals exactly one point on its end-turn.
 * Hits use the planner's authored hostile order, without chance or RNG.
 * The first incapacitated officer ends this experimental encounter: there
 * is deliberately no invented healing, counterattack or mission victory.
 *
 * This is a NEW v3 replay contract, not a reinterpretation of v2 saves.
 * Reusing the validated v2 planner ensures that occupancy and routes match
 * the visible sandbox. The 256-command cap bounds prefix reconstruction.
 */
export function replayCombatEncounter(
  scenarioId: ScenarioId, commands: readonly MissionAction[],
): CombatEncounter {
  const history = replayHostileEncounterCommands(scenarioId, commands);
  const health: Record<SquadId, number> = { science: 3, security: 3, medic: 3 };
  let failed = false;
  let hits: CombatHit[] = [];

  for (let i = 0; i < history.actions.length; i++) {
    if (failed) throw new RangeError('Combat encounter already failed');
    const command = history.actions[i];
    hits = [];
    if (command.type !== 'end-turn') continue;
    const turn = replayHostileEncounter(scenarioId, history.actions.slice(0, i + 1));
    for (const threat of turn.threats) {
      if (health[threat.officer] === 0) continue;
      health[threat.officer]--;
      hits.push(Object.freeze({
        hostile: threat.hostile,
        officer: threat.officer,
        cell: threat.cell,
        damage: 1,
        remainingHp: health[threat.officer],
        round: turn.mission.round - 1,
      }));
    }
    failed = Object.values(health).some(value => value === 0);
  }

  return Object.freeze({
    ...history.encounter,
    health: Object.freeze({ ...health }),
    hits: Object.freeze(hits),
    failed,
  });
}
