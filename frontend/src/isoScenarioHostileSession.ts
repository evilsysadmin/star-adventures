// Opt-in v2 hostile encounter storage. Never read, migrate or overwrite
// legacy v1 tactical training saves. The replay remains authoritative.
import {
  HOSTILE_ENCOUNTER_SAVE_KEY,
  replayHostileEncounterCommands,
  serializeHostileEncounterCheckpoint,
  deserializeHostileEncounterCheckpoint,
  type HostileEncounterHistory,
} from './isoScenarioHostileCheckpoint.ts';
import type { ScenarioId } from './isoScenarioCampaign.ts';

export function newHostileEncounterSession(id: ScenarioId): HostileEncounterHistory {
  return replayHostileEncounterCommands(id, []);
}

export function restoreHostileEncounterSession(storage: Pick<Storage, 'getItem'> | null): {
  history: HostileEncounterHistory; notice: string;
} {
  const blank = () => newHostileEncounterSession('relay');
  if (!storage) return { history: blank(), notice: 'Encuentro temporal · almacenamiento no disponible' };
  let raw: string | null;
  try { raw = storage.getItem(HOSTILE_ENCOUNTER_SAVE_KEY); }
  catch { return { history: blank(), notice: 'Encuentro temporal · almacenamiento no disponible' }; }
  if (raw === null) return {
    history: blank(), notice: 'Encuentro hostil nuevo · sin progreso guardado',
  };
  try {
    const history = deserializeHostileEncounterCheckpoint(raw);
    return {
      history,
      notice: 'Encuentro hostil restaurado · ronda ' + history.encounter.mission.round,
    };
  } catch {
    // Do not delete or rewrite an incompatible save on read.
    return { history: blank(), notice: 'Guardado hostil incompatible · encuentro temporal reiniciado' };
  }
}

export function persistHostileEncounterSession(
  history: HostileEncounterHistory, storage: Pick<Storage, 'setItem'> | null,
): boolean {
  if (!storage) return false;
  try {
    const raw = serializeHostileEncounterCheckpoint(history.scenarioId, history.actions);
    storage.setItem(HOSTILE_ENCOUNTER_SAVE_KEY, raw);
    return true;
  } catch {
    // A failed write is never represented as a successful save.
    return false;
  }
}
