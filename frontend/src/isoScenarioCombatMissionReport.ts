// Auditable outcome projection for the opt-in v4 tactical sandbox.
// Replays untrusted commands; never accepts client-provided HP, victories or
// campaign credit. This is NOT a campaign handoff or a save-format migration.
import { SCENARIOS, type ScenarioId, type SquadId } from './isoScenarioCampaign.ts';
import { replayCombatCommands, type CombatReplayAction } from './isoScenarioCombatReplay.ts';
import { type HostileId } from './isoScenarioHostileTurn.ts';
import { COMBAT_OFFICER_MAX_HP } from './isoScenarioCombatEncounter.ts';

export type CombatMissionStatus =
  | 'active' | 'threats-neutralized' | 'mission-extracted' | 'squad-incapacitated';

export type CombatMissionReport = Readonly<{
  scope: 'experimental-sandbox';
  scenarioId: ScenarioId;
  label: string;
  status: CombatMissionStatus;
  round: number;
  orders: number;
  shots: number;
  enemyTurns: number;
  hostilesNeutralized: number;
  wounds: number;
  officerHealth: Readonly<Record<SquadId, number>>;
  hostileHealth: Readonly<Record<HostileId, number>>;
  objectives: Readonly<{
    scanned: boolean;
    operated: boolean;
    rescued: boolean;
    extracted: boolean;
  }>;
}>;

/**
 * Separate a firefight victory from successful mission extraction. Neutralizing
 * all contacts does not silently complete science/rescue objectives or credit
 * the main campaign. The original v4 replay remains authoritative and unchanged.
 */
export function combatMissionReport(input: Readonly<{
  scenarioId: ScenarioId;
  actions: readonly CombatReplayAction[];
}>): CombatMissionReport {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid combat history');
  const history = replayCombatCommands(input.scenarioId, input.actions);
  const { combat } = history;
  const { mission, health } = combat.encounter;
  const status: CombatMissionStatus = combat.encounter.failed
    ? 'squad-incapacitated'
    : mission.completed
      ? 'mission-extracted'
      : combat.victory
        ? 'threats-neutralized'
        : 'active';
  const officerHealth = Object.freeze({ ...health });
  const hostileHealth = Object.freeze({ ...combat.hostileHealth });
  return Object.freeze({
    scope: 'experimental-sandbox',
    scenarioId: history.scenarioId,
    label: SCENARIOS[history.scenarioId].label,
    status,
    round: mission.round,
    orders: history.actions.filter(action => action.type !== 'end-turn').length,
    shots: combat.shots.length,
    enemyTurns: combat.encounter.enemyTurns,
    hostilesNeutralized: Object.values(hostileHealth).filter(hp => hp === 0).length,
    wounds: Object.values(officerHealth).reduce((sum, hp) => sum + COMBAT_OFFICER_MAX_HP - hp, 0),
    officerHealth,
    hostileHealth,
    objectives: Object.freeze({
      scanned: mission.scanned,
      operated: mission.consoleOnline,
      rescued: mission.rescued,
      extracted: mission.completed,
    }),
  });
}
