import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_MISSION_INSTANCE_SAVE_KEY, readCombatMissionInstanceSession,
  persistCombatMissionInstanceSession, restartCombatMissionInstanceSession,
} from '../src/isoScenarioCombatMissionInstanceSession.ts';
import {
  createCombatMissionInstance, deserializeCombatMissionInstance,
} from '../src/isoScenarioCombatMissionInstance.ts';
import { replayCombatCommands } from '../src/isoScenarioCombatReplay.ts';
import { COMBAT_REPLAY_SAVE_KEY } from '../src/isoScenarioCombatReplay.ts';
import { COMBAT_EXTRACTION_LEDGER_KEY } from '../src/isoScenarioCombatExtractionLedger.ts';

const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';
const storage = (entries = []) => {
  const data = new Map(entries);
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
};
const instance = (id, actions = [], scenario = 'relay') =>
  createCombatMissionInstance(id, replayCombatCommands(scenario, actions));

test('explicit start, append-only commands and F5 preserve one stable attempt ID', () => {
  const store = storage();
  assert.equal(readCombatMissionInstanceSession(store).status, 'missing');
  assert.equal(persistCombatMissionInstanceSession(
    instance(first, [{ type: 'end-turn' }]), store,
  ), 'needs-start');
  assert.equal(store.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY), null);
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', store), 'saved');
  assert.equal(readCombatMissionInstanceSession(store).instance.instanceId, first);
  const advanced = instance(first, [{ type: 'end-turn' }]);
  assert.equal(persistCombatMissionInstanceSession(advanced, store), 'saved');
  const reloaded = readCombatMissionInstanceSession(store);
  assert.equal(reloaded.status, 'ready');
  assert.deepEqual(reloaded.instance, advanced);
  assert.equal(persistCombatMissionInstanceSession(advanced, store), 'saved');
  assert.equal(persistCombatMissionInstanceSession(instance(first), store), 'conflict');
  assert.deepEqual(readCombatMissionInstanceSession(store).instance, advanced);
});

test('restarts require a different ID and never change the legacy replay or ledger', () => {
  const originals = [
    [COMBAT_REPLAY_SAVE_KEY, 'old v4 checkpoint'],
    [COMBAT_EXTRACTION_LEDGER_KEY, 'old extraction ledger'],
    ['shadowops.star-adventures.campaign', 'campaign'],
  ];
  const store = storage(originals);
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', store), 'saved');
  assert.equal(restartCombatMissionInstanceSession(first, 'derelict', store), 'conflict');
  assert.equal(persistCombatMissionInstanceSession(instance(second), store), 'conflict');
  assert.equal(persistCombatMissionInstanceSession(instance(first, [], 'derelict'), store), 'conflict');
  assert.equal(restartCombatMissionInstanceSession(second, 'derelict', store), 'saved');
  assert.equal(readCombatMissionInstanceSession(store).instance.instanceId, second);
  assert.equal(readCombatMissionInstanceSession(store).instance.history.scenarioId, 'derelict');
  for (const [key, value] of originals) assert.equal(store.getItem(key), value);
});

test('future/corrupt records fail closed and are never silently replaced', () => {
  for (const raw of ['{', JSON.stringify({ version: 99 }), 'null']) {
    const store = storage([[COMBAT_MISSION_INSTANCE_SAVE_KEY, raw]]);
    assert.equal(readCombatMissionInstanceSession(store).status, 'incompatible');
    assert.equal(restartCombatMissionInstanceSession(first, 'relay', store), 'incompatible');
    assert.equal(persistCombatMissionInstanceSession(instance(first), store), 'incompatible');
    assert.equal(store.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY), raw);
  }
  assert.equal(persistCombatMissionInstanceSession(instance('bad-id'), storage()), 'conflict');
});

test('silent write loss, quota errors and denied reads never claim a durable save', () => {
  const ignored = storage();
  const silent = { getItem: ignored.getItem, setItem() {} };
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', silent), 'unavailable');
  assert.equal(ignored.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY), null);
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', {
    getItem: () => null, setItem() { throw new Error('quota'); },
  }), 'unavailable');
  assert.equal(readCombatMissionInstanceSession({
    getItem() { throw new Error('security'); },
  }).status, 'unavailable');
  assert.equal(persistCombatMissionInstanceSession(instance(first), null), 'unavailable');
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', null), 'unavailable');
  const unreadableAfterWrite = { reads: 0,
    getItem() { if (++this.reads > 1) throw new Error('readback'); return null; },
    setItem() {},
  };
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', unreadableAfterWrite), 'unavailable');
});

test('stored envelope contains canonical replay evidence, not forged victory flags', () => {
  const store = storage();
  assert.equal(restartCombatMissionInstanceSession(first, 'relay', store), 'saved');
  const history = replayCombatCommands('relay', [{ type: 'end-turn' }]);
  assert.equal(persistCombatMissionInstanceSession({
    instanceId: first, history: { ...history, combat: { ...history.combat, victory: true } },
  }, store), 'saved');
  const stored = deserializeCombatMissionInstance(store.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY));
  assert.equal(stored.history.combat.victory, false);
  assert.deepEqual(stored.history.actions, history.actions);
});
