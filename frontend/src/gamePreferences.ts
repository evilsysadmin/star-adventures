export const GAME_PREFERENCES_KEY = 'shadowops.star-adventures.presentation.v1';
export type GamePreferences = {
  version: 1; layout: 'game' | 'journal'; hints: boolean; muted: boolean; volume: number;
};
export const DEFAULT_GAME_PREFERENCES: GamePreferences = {
  version: 1, layout: 'game', hints: true, muted: false, volume: .6,
};
type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

export function readGamePreferences(storage: PreferencesStorage): GamePreferences {
  try {
    const raw = storage?.getItem(GAME_PREFERENCES_KEY);
    if (!raw || raw.length > 1024) return { ...DEFAULT_GAME_PREFERENCES };
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !['game', 'journal'].includes(value.layout) ||
      typeof value.hints !== 'boolean' || typeof value.muted !== 'boolean' ||
      !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1)
      return { ...DEFAULT_GAME_PREFERENCES };
    return { version: 1, layout: value.layout, hints: value.hints, muted: value.muted, volume: value.volume };
  } catch { return { ...DEFAULT_GAME_PREFERENCES }; }
}

export function saveGamePreferences(storage: PreferencesStorage, preferences: GamePreferences): boolean {
  try {
    if (!storage) return false;
    const raw = JSON.stringify(preferences);
    storage.setItem(GAME_PREFERENCES_KEY, raw);
    return storage.getItem(GAME_PREFERENCES_KEY) === raw;
  } catch { return false; }
}
