// The optional isometric mission sandbox has exactly one independent local checkpoint.
// Never touch Border Signal, away team, exploration or dual-mandate storage.
import {
  replayScenarioCommands, serializeScenarioCheckpoint, deserializeScenarioCheckpoint,
  type ScenarioHistory,
} from './isoScenarioCheckpoint.ts';
import type { ScenarioId } from './isoScenarioCampaign.ts';

export const SCENARIO_SAVE_KEY = 'shadowops.star-adventures.iso-scenario.v1';

export function newScenarioSession(id: ScenarioId): ScenarioHistory {
  return replayScenarioCommands(id, []);
}

export function restoreScenarioSession(storage: Pick<Storage, 'getItem'> | null): {
  history: ScenarioHistory; notice: string;
} {
  const blank = () => newScenarioSession('relay');
  if (!storage) return { history: blank(), notice: 'Sin almacenamiento local · misión temporal' };
  let raw: string | null;
  try { raw = storage.getItem(SCENARIO_SAVE_KEY); }
  catch { return { history: blank(), notice: 'Sin almacenamiento local · misión temporal' }; }
  if (raw === null) return {
    history: blank(), notice: 'Selecciona un oficial, una casilla o un objetivo para comenzar.',
  };
  try {
    const history = deserializeScenarioCheckpoint(raw);
    return {
      history,
      notice: 'Misión táctica restaurada · ronda ' + history.state.round +
        ' · ' + history.state.ap + ' órdenes restantes',
    };
  } catch {
    return { history: blank(), notice: 'Guardado táctico incompatible · misión reiniciada' };
  }
}

export function persistScenarioSession(
  history: ScenarioHistory, storage: Pick<Storage, 'setItem'> | null,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SCENARIO_SAVE_KEY, serializeScenarioCheckpoint(history.scenarioId, history.actions));
    return true;
  } catch { return false; }
}
