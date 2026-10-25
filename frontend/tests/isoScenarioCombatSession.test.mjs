import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCombatEncounterSession, restoreCombatEncounterSession, persistCombatEncounterSession,
} from '../src/isoScenarioCombatSession.ts';
import {
  COMBAT_ENCOUNTER_SAVE_KEY, serializeCombatEncounterCheckpoint,
  replayCombatEncounterCommands,
} from '../src/isoScenarioCombatCheckpoint.ts';
import { HOSTILE_ENCOUNTER_SAVE_KEY } from '../src/isoScenarioHostileCheckpoint.ts';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession.ts';

const storage = (initial = []) => {
  const data = new Map(initial);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('v3 combat session replays wounds across reload without changing v1/v2', () => {
  const actions = [];
  let encounter;
  for (let i = 0; i < 60; i++) {
    actions.push({ type: 'end-turn' });
    encounter = replayCombatEncounterCommands('relay', actions).encounter;
    if (encounter.hits.length) break;
  }
  assert.ok(encounter.hits.length > 0);
  const v1 = 'untouched training', v2 = 'untouched hostile';
  const store = storage([[SCENARIO_SAVE_KEY, v1], [HOSTILE_ENCOUNTER_SAVE_KEY, v2]]);
  const history = { ...newCombatEncounterSession('relay'), actions, encounter: newCombatEncounterSession('relay').encounter };
  assert.equal(persistCombatEncounterSession(history, store), true);
  assert.deepEqual(JSON.parse(store.getItem(COMBAT_ENCOUNTER_SAVE_KEY)), {
    version: 3, scenarioId: 'relay', actions,
  });
  const restored = restoreCombatEncounterSession(store);
  assert.match(restored.notice, /restaurado/);
  assert.deepEqual(restored.history.encounter.health, encounter.health);
  assert.deepEqual(restored.history.encounter.hits, encounter.hits);
  assert.equal(store.getItem(SCENARIO_SAVE_KEY), v1);
  assert.equal(store.getItem(HOSTILE_ENCOUNTER_SAVE_KEY), v2);
});

test('v3 corrupt/future saves are not modified and cannot import older saves', () => {
  for (const raw of ['{', JSON.stringify({ version: 4, scenarioId: 'relay', actions: [] }),
    JSON.stringify({ version: 3, scenarioId: 'relay', actions: [{ type: 'scan', officer: 'science' }] })]) {
    const store = storage([[COMBAT_ENCOUNTER_SAVE_KEY, raw], [SCENARIO_SAVE_KEY, 'v1']]);
    const restored = restoreCombatEncounterSession(store);
    assert.match(restored.notice, /incompatible/);
    assert.equal(restored.history.encounter.mission.round, 1);
    assert.equal(store.getItem(COMBAT_ENCOUNTER_SAVE_KEY), raw);
    assert.equal(store.getItem(SCENARIO_SAVE_KEY), 'v1');
  }
  const store = storage([[SCENARIO_SAVE_KEY, 'v1'], [HOSTILE_ENCOUNTER_SAVE_KEY, 'v2']]);
  assert.equal(restoreCombatEncounterSession(store).history.actions.length, 0);
  assert.equal(store.getItem(COMBAT_ENCOUNTER_SAVE_KEY), null);
});

test('denied storage, invalid history and finished encounters fail safely', () => {
  assert.match(restoreCombatEncounterSession(null).notice, /temporal/);
  assert.match(restoreCombatEncounterSession({ getItem: () => { throw Error('denied'); } }).notice, /temporal/);
  assert.equal(persistCombatEncounterSession(newCombatEncounterSession('relay'), null), false);
  const raw = serializeCombatEncounterCheckpoint('relay', [{ type: 'end-turn' }]);
  const store = storage([[COMBAT_ENCOUNTER_SAVE_KEY, raw]]);
  assert.equal(persistCombatEncounterSession({
    ...newCombatEncounterSession('relay'),
    actions: [{ type: 'scan', officer: 'science' }],
  }, store), false);
  assert.equal(store.getItem(COMBAT_ENCOUNTER_SAVE_KEY), raw);
  assert.equal(persistCombatEncounterSession(newCombatEncounterSession('relay'), {
    setItem: () => { throw Error('quota'); },
  }), false);
});
