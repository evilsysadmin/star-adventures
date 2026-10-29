import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GAME_PREFERENCES, GAME_PREFERENCES_KEY, readGamePreferences, saveGamePreferences } from '../src/gamePreferences.ts';

const storage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
test('presentation defaults to the full game and restores only a supported complete preference record', () => {
  const store = storage();
  assert.deepEqual(readGamePreferences(store), DEFAULT_GAME_PREFERENCES);
  const preferences = { version: 1, layout: 'journal', hints: false, volume: .25, muted: true };
  assert.equal(saveGamePreferences(store, preferences), true);
  assert.deepEqual(readGamePreferences(store), preferences);
  assert.notEqual(readGamePreferences(null), DEFAULT_GAME_PREFERENCES);
});
test('malformed, future, oversized and invalid audio records recover without adopting unsafe values', () => {
  const store = storage();
  for (const raw of ['{bad', 'null', 'x'.repeat(1025), JSON.stringify({ ...DEFAULT_GAME_PREFERENCES, version: 2 }),
    JSON.stringify({ ...DEFAULT_GAME_PREFERENCES, volume: -1 }), JSON.stringify({ ...DEFAULT_GAME_PREFERENCES, volume: '1' }),
    JSON.stringify({ ...DEFAULT_GAME_PREFERENCES, layout: 'unknown' }), JSON.stringify({ ...DEFAULT_GAME_PREFERENCES, hints: 1 })]) {
    store.setItem(GAME_PREFERENCES_KEY, raw);
    assert.deepEqual(readGamePreferences(store), DEFAULT_GAME_PREFERENCES);
  }
});
test('read denial, write denial and discarded writes do not falsely report persistent options', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.deepEqual(readGamePreferences(denied), DEFAULT_GAME_PREFERENCES);
  assert.equal(saveGamePreferences(denied, DEFAULT_GAME_PREFERENCES), false);
  assert.equal(saveGamePreferences({ getItem: () => null, setItem() {} }, DEFAULT_GAME_PREFERENCES), false);
  assert.equal(saveGamePreferences(null, DEFAULT_GAME_PREFERENCES), false);
});
