// Opt-in v3 combat storage. V1 training, v2 hostile and campaign saves
// are never read, migrated or overwritten. All health is replay-derived.
import {
  COMBAT_ENCOUNTER_SAVE_KEY,
  replayCombatEncounterCommands,
  serializeCombatEncounterCheckpoint,
  deserializeCombatEncounterCheckpoint,
  type CombatEncounterHistory,
} from './isoScenarioCombatCheckpoint.ts';
import type { ScenarioId } from './isoScenarioCampaign.ts';

export function newCombatEncounterSession(id: ScenarioId): CombatEncounterHistory {
  return replayCombatEncounterCommands(id, []);
}

export function restoreCombatEncounterSession(storage: Pick<Storage, 'getItem'> | null): {
  history: CombatEncounterHistory; notice: string;
} {
  const blank = () => newCombatEncounterSession('relay');
  if (!storage) return { history: blank(), notice: 'Combate temporal · almacenamiento no disponible' };
  let raw: string | null;
  try { raw = storage.getItem(COMBAT_ENCOUNTER_SAVE_KEY); }
  catch { return { history: blank(), notice: 'Combate temporal · almacenamiento no disponible' }; }
  if (raw === null) return {
    history: blank(), notice: 'Combate experimental nuevo · sin progreso guardado',
  };
  try {
    const history = deserializeCombatEncounterCheckpoint(raw);
    return {
      history,
      notice: 'Combate experimental restaurado · ronda ' + history.encounter.mission.round,
    };
  } catch {
    // Never erase incompatible/future data during a read.
    return { history: blank(), notice: 'Guardado de combate incompatible · sesión temporal reiniciada' };
  }
}

export function persistCombatEncounterSession(
  history: CombatEncounterHistory, storage: Pick<Storage, 'setItem'> | null,
): boolean {
  if (!storage) return false;
  try {
    const raw = serializeCombatEncounterCheckpoint(history.scenarioId, history.actions);
    storage.setItem(COMBAT_ENCOUNTER_SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
