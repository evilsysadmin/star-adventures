import { startCrewSession, serializeCrewCheckpoint, deserializeCrewCheckpoint, migrateLegacyCheckpoint } from '../../src/crewSession.mjs';
import { startExploration } from '../../src/spatial.mjs';
import { recoverSpatialCheckpoint, serializeSpatialCheckpoint } from '../../src/spatialCheckpoint.mjs';

export type SessionState = {
  episodeState: {
    schemaVersion: number;
    episodeId: string;
    nodeId: string;
    stats: { science: number; diplomacy: number; shipDamage: number };
    log: Array<{ nodeId: string; choiceId: string; next: string; effects: Record<string, number>; officerId?: string; station?: string; skill?: number; check?: string }>;
  };
  crew: { version: number; assignments: Record<string, string>; progression: Record<string, { xp: number; level: number }> };
  actions: Array<{ type: string; choiceId?: string; station?: string; officerId?: string }>;
};
export const CHECKPOINT_KEY = 'shadowops.star-adventures.border-signal.v2';
export const LEGACY_CHECKPOINT_KEY = 'shadowops.star-adventures.border-signal.v1';

export function restoreSession(episode: Parameters<typeof startCrewSession>[0], storage: Pick<Storage, 'getItem'> | null): { state: SessionState; notice: string } {
  const fresh = () => startCrewSession(episode);
  if (!storage) return { state: fresh(), notice: 'Sesión temporal · almacenamiento no disponible' };
  try {
    const raw = storage.getItem(CHECKPOINT_KEY);
    if (raw !== null) {
      try {
        return { state: deserializeCrewCheckpoint(episode, raw), notice: 'Tripulación y misión restauradas' };
      } catch {
        // A corrupt v2 must never silently roll back to stale v1 progress.
        return { state: fresh(), notice: 'Guardado incompatible · misión reiniciada' };
      }
    }
    const legacy = storage.getItem(LEGACY_CHECKPOINT_KEY);
    if (legacy !== null) {
      try {
        return { state: migrateLegacyCheckpoint(episode, legacy), notice: 'Partida anterior recuperada · tripulación preparada' };
      } catch {
        return { state: fresh(), notice: 'Guardado incompatible · misión reiniciada' };
      }
    }
    return { state: fresh(), notice: 'Nueva misión · progreso local' };
  } catch {
    return { state: fresh(), notice: 'Sesión temporal · almacenamiento no disponible' };
  }
}

export function persistSession(episode: Parameters<typeof startCrewSession>[0], state: SessionState, storage: Pick<Storage, 'setItem'> | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHECKPOINT_KEY, serializeCrewCheckpoint(episode, state));
    return true;
  } catch { return false; }
}

export function localStorageOrNull(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Standalone v1 location snapshot. The mission/crew v2 checkpoint is never altered. */
export const SPATIAL_CHECKPOINT_KEY = 'shadowops.star-adventures.spatial.v1';

export function restoreSpatialSession(world: Parameters<typeof startExploration>[0], storage: Pick<Storage, 'getItem'> | null) {
  if (!storage) return { state: startExploration(world), notice: 'temporary' };
  try { return recoverSpatialCheckpoint(world, storage.getItem(SPATIAL_CHECKPOINT_KEY)); }
  catch { return { state: startExploration(world), notice: 'temporary' }; }
}

export function persistSpatialSession(world: Parameters<typeof startExploration>[0],
  position: ReturnType<typeof startExploration>, storage: Pick<Storage, 'setItem'> | null) {
  if (!storage) return false;
  try {
    storage.setItem(SPATIAL_CHECKPOINT_KEY, serializeSpatialCheckpoint(world, position));
    return true;
  } catch { return false; }
}
