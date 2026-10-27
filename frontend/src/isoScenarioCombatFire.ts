// Experimental player-fire domain primitive, deliberately NOT a v3 save migration.
// A future versioned replay must own interleaved movement, fire and enemy turns
// before this is connected to the UI. No renderer, storage, clock or RNG.
import type { SquadId } from './isoScenarioCampaign.ts';
import type { HostileId } from './isoScenarioHostileTurn.ts';
import type { CombatEncounter } from './isoScenarioCombatEncounter.ts';
import { evaluateCombatAim } from './isoScenarioCombatAim.ts';

export const COMBAT_HOSTILE_MAX_HP = 2;
export type CombatShot = Readonly<{
  officer: SquadId; hostile: HostileId; cell: string;
  damage: 1; remainingHp: number; round: number;
}>;
export type CombatFireState = Readonly<{
  encounter: CombatEncounter;
  hostileHealth: Readonly<Record<HostileId, number>>;
  shots: readonly CombatShot[];
  victory: boolean;
  truce: boolean;
}>;

/** Start a separate, unsaved player-fire experiment from a v3 encounter. */
export function startCombatFire(encounter: CombatEncounter): CombatFireState {
  return Object.freeze({
    encounter,
    hostileHealth: Object.freeze({ aegis: COMBAT_HOSTILE_MAX_HP, veil: COMBAT_HOSTILE_MAX_HP }),
    shots: Object.freeze([]) as readonly CombatShot[],
    victory: false,
    truce: false,
  });
}

/**
 * One legal shot costs one AP and deals exactly one damage. Eliminated
 * contacts cease blocking line of sight and cannot be shot again. This pure
 * transition does not advance enemy AI or rewrite v1/v2/v3 checkpoints.
 */
export function fireCombatShot(
  state: CombatFireState, officer: SquadId, hostile: HostileId,
): CombatFireState {
  if (state.truce) throw new RangeError('Ceasefire prohibits firing');
  if (state.victory) throw new RangeError('Combat already won');
  if (state.hostileHealth[hostile] === 0) throw new RangeError('Hostile already eliminated');
  const activePositions = Object.fromEntries(
    Object.entries(state.encounter.positions)
      .filter(([id]) => state.hostileHealth[id as HostileId] > 0),
  ) as Record<HostileId, string>;
  const aim = evaluateCombatAim(
    { ...state.encounter, positions: activePositions }, officer, hostile,
  );
  if (!aim.allowed) throw new RangeError('Shot denied: ' + aim.reason);
  const remainingHp = state.hostileHealth[hostile] - 1;
  const shot: CombatShot = Object.freeze({
    officer, hostile, cell: activePositions[hostile], damage: 1,
    remainingHp, round: state.encounter.mission.round,
  });
  const mission = Object.freeze({
    ...state.encounter.mission,
    ap: state.encounter.mission.ap - 1,
    events: Object.freeze([...state.encounter.mission.events,
      officer + ': disparo a ' + hostile + ' (' + remainingHp + ' PV restantes)']),
  });
  const hostileHealth = Object.freeze({ ...state.hostileHealth, [hostile]: remainingHp });
  return Object.freeze({
    encounter: Object.freeze({ ...state.encounter, mission }),
    hostileHealth,
    shots: Object.freeze([...state.shots, shot]),
    victory: Object.values(hostileHealth).every(hp => hp === 0),
    truce: state.truce,
  });
}
