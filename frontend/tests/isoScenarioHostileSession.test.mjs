import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newHostileEncounterSession, restoreHostileEncounterSession, persistHostileEncounterSession,
} from '../src/isoScenarioHostileSession.ts';
import {
  HOSTILE_ENCOUNTER_SAVE_KEY, serializeHostileEncounterCheckpoint,
} from '../src/isoScenarioHostileCheckpoint.ts';
import { SCENARIO_SAVE_KEY } from '../src/isoScenarioSession.ts';
import { serializeScenarioCheckpoint } from '../src/isoScenarioCheckpoint.ts';

function storage(initial = []) {
  const values = new Map(initial);
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

test('new encounter starts independently of v1 training and has replayed enemy positions', () => {
  const history = newHostileEncounterSession('derelict');
  assert.equal(history.scenarioId, 'derelict');
  assert.equal(history.encounter.enemyTurns, 0);
  assert.equal(history.encounter.mission.round, 1);
  assert.deepEqual(history.encounter.positions, { aegis: '7:6', veil: '10:6' });
});

for (const id of ['relay', 'derelict', 'evacuation']) {
  test(id + ': v2 storage round-trips enemy turns and leaves legacy training untouched', () => {
    const legacy = serializeScenarioCheckpoint('relay', [{ type: 'end-turn' }]);
    const store = storage([[SCENARIO_SAVE_KEY, legacy]]);
    const actions = [{ type: 'end-turn' }, { type: 'end-turn' }];
    const history = newHostileEncounterSession(id);
    const progressed = {
      ...history,
      actions,
      encounter: history.encounter, // persisted state must be replayed, never trusted
    };
    assert.equal(persistHostileEncounterSession(progressed, store), true);
    assert.equal(store.getItem(SCENARIO_SAVE_KEY), legacy);
    const restored = restoreHostileEncounterSession(store);
    assert.equal(restored.history.scenarioId, id);
    assert.equal(restored.history.encounter.enemyTurns, 2);
    assert.equal(restored.history.encounter.mission.round, 3);
    assert.match(restored.notice, /restaurado/);
    assert.deepEqual(restored.history.actions, actions);
    assert.equal(store.getItem(SCENARIO_SAVE_KEY), legacy);
  });
}

test('no v2 save never imports or migrates a legacy v1 save', () => {
  const legacy = serializeScenarioCheckpoint('evacuation', [{ type: 'end-turn' }]);
  const store = storage([[SCENARIO_SAVE_KEY, legacy]]);
  const result = restoreHostileEncounterSession(store);
  assert.equal(result.history.scenarioId, 'relay');
  assert.equal(result.history.encounter.enemyTurns, 0);
  assert.equal(store.getItem(HOSTILE_ENCOUNTER_SAVE_KEY), null);
  assert.equal(store.getItem(SCENARIO_SAVE_KEY), legacy);
});

test('corrupt and future v2 saves fail closed without modifying any storage', () => {
  const legacy = serializeScenarioCheckpoint('relay', []);
  for (const raw of ['{', JSON.stringify({ version: 3, scenarioId: 'relay', actions: [] }),
    JSON.stringify({ version: 2, scenarioId: 'relay', actions: [{ type: 'scan', officer: 'science' }] })]) {
    const store = storage([[SCENARIO_SAVE_KEY, legacy], [HOSTILE_ENCOUNTER_SAVE_KEY, raw]]);
    const result = restoreHostileEncounterSession(store);
    assert.equal(result.history.encounter.enemyTurns, 0);
    assert.match(result.notice, /incompatible/);
    assert.equal(store.getItem(HOSTILE_ENCOUNTER_SAVE_KEY), raw);
    assert.equal(store.getItem(SCENARIO_SAVE_KEY), legacy);
  }
});

test('unavailable and denied storage is reported, not treated as persisted progress', () => {
  assert.match(restoreHostileEncounterSession(null).notice, /temporal/);
  assert.equal(persistHostileEncounterSession(newHostileEncounterSession('relay'), null), false);
  const deniedRead = { getItem: () => { throw new Error('denied'); } };
  assert.match(restoreHostileEncounterSession(deniedRead).notice, /temporal/);
  const deniedWrite = { setItem: () => { throw new Error('quota'); } };
  assert.equal(persistHostileEncounterSession(newHostileEncounterSession('relay'), deniedWrite), false);
});

test('invalid history never overwrites a previously valid v2 checkpoint', () => {
  const raw = serializeHostileEncounterCheckpoint('relay', [{ type: 'end-turn' }]);
  const store = storage([[HOSTILE_ENCOUNTER_SAVE_KEY, raw]]);
  const invalid = { ...newHostileEncounterSession('relay'), actions: [{ type: 'scan', officer: 'science' }] };
  assert.equal(persistHostileEncounterSession(invalid, store), false);
  assert.equal(store.getItem(HOSTILE_ENCOUNTER_SAVE_KEY), raw);
});
