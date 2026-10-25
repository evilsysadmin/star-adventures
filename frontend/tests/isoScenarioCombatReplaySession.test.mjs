import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCombatReplaySession, restoreCombatReplaySession, persistCombatReplaySession,
} from '../src/isoScenarioCombatReplaySession.ts';
import {
  COMBAT_REPLAY_SAVE_KEY, replayCombatCommands, serializeCombatReplay,
} from '../src/isoScenarioCombatReplay.ts';
import { COMBAT_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioCombatCheckpoint.ts';
import { HOSTILE_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioHostileCheckpoint.ts';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession.ts';

const storage = (initial = []) => {
  const data = new Map(initial);
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
};

const victory = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'end-turn' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

test('v4 session restores actual shots, injuries and victory after F5 without touching v1/v2/v3', () => {
  const originals = [
    [SCENARIO_SAVE_KEY, 'training checkpoint'],
    [HOSTILE_ENCOUNTER_SAVE_KEY, 'patrol checkpoint'],
    [COMBAT_ENCOUNTER_SAVE_KEY, 'combat v3 checkpoint'],
    ['shadowops.star-adventures.campaign', 'campaign checkpoint'],
  ];
  const store = storage(originals);
  const combat = replayCombatCommands('relay', victory);
  assert.equal(combat.combat.victory, true);
  assert.equal(combat.combat.encounter.health.security, 2);
  assert.equal(persistCombatReplaySession(combat, store), true);
  assert.deepEqual(JSON.parse(store.getItem(COMBAT_REPLAY_SAVE_KEY)), {
    version: 4, scenarioId: 'relay', actions: victory,
  });
  const restored = restoreCombatReplaySession(store);
  assert.match(restored.notice, /restaurado/);
  assert.deepEqual(restored.history, combat);
  assert.equal(restored.history.combat.shots.length, 4);
  assert.equal(restored.history.combat.victory, true);
  for (const [key, raw] of originals) assert.equal(store.getItem(key), raw);
});

test('v4 storage writes only replay-verified commands, never forged combat outcomes', () => {
  const store = storage();
  const history = replayCombatCommands('relay', victory.slice(0, 3));
  const forged = { ...history, combat: { ...history.combat, victory: true,
    hostileHealth: { aegis: 0, veil: 0 } } };
  assert.equal(persistCombatReplaySession(forged, store), true);
  assert.deepEqual(restoreCombatReplaySession(store).history, history);
  const raw = store.getItem(COMBAT_REPLAY_SAVE_KEY);
  assert.equal(persistCombatReplaySession({
    ...history, actions: [...history.actions, { type: 'fire', officer: 'science', hostile: 'veil' }],
  }, store), false);
  assert.equal(store.getItem(COMBAT_REPLAY_SAVE_KEY), raw, 'rejected write leaves last valid save');
});

test('v4 incompatible, future and corrupted saves are not erased or interpreted as v3', () => {
  for (const raw of [
    '{',
    JSON.stringify({ version: 5, scenarioId: 'relay', actions: [] }),
    JSON.stringify({ version: 4, scenarioId: 'relay', actions: [
      { type: 'fire', officer: 'science', hostile: 'aegis' },
    ] }),
    JSON.stringify({ version: 4, scenarioId: 'relay', actions: [], victory: true }),
  ]) {
    const store = storage([[COMBAT_REPLAY_SAVE_KEY, raw], [COMBAT_ENCOUNTER_SAVE_KEY, 'v3']]);
    const restored = restoreCombatReplaySession(store);
    assert.match(restored.notice, /incompatible/);
    assert.deepEqual(restored.history, newCombatReplaySession('relay'));
    assert.equal(store.getItem(COMBAT_REPLAY_SAVE_KEY), raw);
    assert.equal(store.getItem(COMBAT_ENCOUNTER_SAVE_KEY), 'v3');
  }
  const legacy = storage([[COMBAT_ENCOUNTER_SAVE_KEY, serializeCombatReplay('relay', victory)]]);
  assert.equal(restoreCombatReplaySession(legacy).history.actions.length, 0);
  assert.equal(legacy.getItem(COMBAT_REPLAY_SAVE_KEY), null);
});

test('v4 session refuses silently discarded or unreadable writes without false saved state', () => {
  const first = serializeCombatReplay('relay', []);
  const next = newCombatReplaySession('derelict');
  const ignored = storage([[COMBAT_REPLAY_SAVE_KEY, first]]);
  assert.equal(persistCombatReplaySession(next, {
    getItem: ignored.getItem,
    setItem() {}, // Browser/storage shim accepts the write but loses it.
  }), false);
  assert.equal(ignored.getItem(COMBAT_REPLAY_SAVE_KEY), first);

  let written = false;
  assert.equal(persistCombatReplaySession(next, {
    setItem(key, value) { written = key === COMBAT_REPLAY_SAVE_KEY && value.length > 0; },
    getItem() { throw new Error('SecurityError on readback'); },
  }), false);
  assert.equal(written, true);
  assert.equal(persistCombatReplaySession(next, {
    setItem() {},
    getItem() { return null; },
  }), false);
});

test('v4 session reports storage denial and quota failures without claiming persistence', () => {
  assert.match(restoreCombatReplaySession(null).notice, /temporal/);
  assert.match(restoreCombatReplaySession({ getItem: () => { throw Error('denied'); } }).notice, /temporal/);
  assert.match(restoreCombatReplaySession(storage()).notice, /nuevo/);
  assert.equal(persistCombatReplaySession(newCombatReplaySession('relay'), null), false);
  assert.equal(persistCombatReplaySession(newCombatReplaySession('relay'), {
    setItem: () => { throw Error('quota'); },
  }), false);
  const store = storage();
  assert.equal(persistCombatReplaySession(newCombatReplaySession('derelict'), store), true);
  assert.equal(restoreCombatReplaySession(store).history.scenarioId, 'derelict');
  assert.equal(persistCombatReplaySession(newCombatReplaySession('relay'), store), true);
  assert.equal(restoreCombatReplaySession(store).history.scenarioId, 'relay');
});
