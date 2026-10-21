import { startEpisode } from '../../src/episode.mjs';
import { deserializeSave, serializeSave } from '../../src/save.mjs';

export type SessionState = {
  schemaVersion: number;
  episodeId: string;
  nodeId: string;
  stats: { science: number; diplomacy: number; shipDamage: number };
  log: Array<{ nodeId: string; choiceId: string; next: string; effects: Record<string, number> }>;
};
type State = SessionState;
export const CHECKPOINT_KEY = 'shadowops.star-adventures.border-signal.v1';

export function restoreSession(episode: Parameters<typeof startEpisode>[0], storage: Pick<Storage, 'getItem'> | null): { state: State; notice: string } {
  if (!storage) return { state: startEpisode(episode), notice: 'Sesión temporal · almacenamiento no disponible' };
  try {
    const raw = storage.getItem(CHECKPOINT_KEY);
    if (raw === null) return { state: startEpisode(episode), notice: 'Nueva misión · progreso local' };
    return { state: deserializeSave(episode, raw), notice: 'Misión restaurada desde este dispositivo' };
  } catch {
    return { state: startEpisode(episode), notice: 'Guardado incompatible · misión reiniciada' };
  }
}

export function persistSession(episode: Parameters<typeof startEpisode>[0], state: State, storage: Pick<Storage, 'setItem'> | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHECKPOINT_KEY, serializeSave(episode, state));
    return true;
  } catch { return false; }
}

export function localStorageOrNull(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
