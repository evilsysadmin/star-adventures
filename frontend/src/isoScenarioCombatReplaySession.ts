// Opt-in v4 combat session storage. Movement, fire and retaliation are
// reconstructed from commands; no mutable combat state is trusted on reload.
// Training v1, hostile v2, combat v3 and campaign saves remain untouched.
import {
  COMBAT_REPLAY_SAVE_KEY,
  replayCombatCommands,
  serializeCombatReplay,
  deserializeCombatReplay,
  type CombatReplayHistory,
} from './isoScenarioCombatReplay.ts';
import type { ScenarioId } from './isoScenarioCampaign.ts';

export function newCombatReplaySession(id: ScenarioId): CombatReplayHistory {
  return replayCombatCommands(id, []);
}

export function restoreCombatReplaySession(storage: Pick<Storage, 'getItem'> | null): {
  history: CombatReplayHistory; notice: string;
} {
  const blank = () => newCombatReplaySession('relay');
  if (!storage) return { history: blank(), notice: 'Combate v4 temporal · almacenamiento no disponible' };
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_REPLAY_SAVE_KEY); }
  catch { return { history: blank(), notice: 'Combate v4 temporal · almacenamiento no disponible' }; }
  if (raw === null) return {
    history: blank(), notice: 'Combate v4 nuevo · sin progreso guardado',
  };
  try {
    const history = deserializeCombatReplay(raw);
    return {
      history,
      notice: 'Combate v4 restaurado · ronda ' + history.combat.encounter.mission.round,
    };
  } catch {
    // Incompatible/future checkpoints must not be deleted or silently migrated.
    return { history: blank(), notice: 'Guardado v4 incompatible · sesión temporal reiniciada' };
  }
}

export function persistCombatReplaySession(
  history: CombatReplayHistory, storage: Pick<Storage, 'setItem'> | null,
): boolean {
  if (!storage) return false;
  try {
    // The serializer replays every action and validates the entire history.
    // Never serialize derived health, positions, shots or victory flags.
    const raw = serializeCombatReplay(history.scenarioId, history.actions);
    storage.setItem(COMBAT_REPLAY_SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
