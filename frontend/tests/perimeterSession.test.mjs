import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERIMETER_SAVE_KEY, atPerimeterStation, newPerimeterHistory,
  perimeterResolution, persistPerimeterSession, restorePerimeterSession,
} from '../src/perimeterSession.ts';
import { COMBAT_REPLAY_SAVE_KEY, replayCombatCommands, serializeCombatReplay } from '../src/isoScenarioCombatReplay.ts';
import { CHECKPOINT_KEY, restoreSession } from '../src/session.ts';
import { startCrewSession, serializeCrewCheckpoint } from '../../src/crewSession.mjs';

const world = JSON.parse(readFileSync(new URL('../../content/scenes/meridian.json', import.meta.url)));
const episode = JSON.parse(readFileSync(new URL('../../content/episodes/border-signal.json', import.meta.url)));
const store = (values = []) => {
  const data = new Map(values);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, raw) => data.set(key, raw) };
};
const approach = [
  { type: 'move', officer: 'security', cell: '1:8' },
  { type: 'move', officer: 'security', cell: '5:8' },
  { type: 'move', officer: 'security', cell: '7:8' },
  { type: 'end-turn' },
];
const truce = [...approach, { type: 'parley', officer: 'security' }];
const victory = [
  ...approach,
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'move', officer: 'security', cell: '9:8' },
  { type: 'end-turn' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

test('physical orders resume with actual positions, injuries and visibility after reload', () => {
  const storage = store();
  const history = replayCombatCommands('evacuation', approach);
  assert.equal(history.combat.encounter.health.security, 2);
  for (const active of [true, false]) {
    assert.equal(persistPerimeterSession(history, 0, active, storage), true);
    const restored = restorePerimeterSession(storage, 0);
    assert.equal(restored.status, 'ready');
    assert.equal(restored.active, active);
    assert.deepEqual(restored.history, history);
    assert.equal(perimeterResolution(restored.history), null);
    const next = replayCombatCommands('evacuation', [...restored.history.actions, truce.at(-1)]);
    assert.equal(perimeterResolution(next), 'truce');
    assert.equal(next.combat.encounter.health.security, 2, 'reload must not replay a new injury');
  }
});

test('negotiation and lethal victory retain distinct, replay-derived reports without awarding a rescue', () => {
  for (const [commands, outcome] of [[truce, 'truce'], [victory, 'victory']]) {
    const storage = store();
    const history = replayCombatCommands('evacuation', commands);
    assert.equal(persistPerimeterSession(history, 2, false, storage), true);
    const restored = restorePerimeterSession(storage, 2).history;
    assert.equal(perimeterResolution(restored), outcome);
    assert.equal(restored.combat.encounter.mission.completed, false);
    assert.equal(restored.combat.encounter.health.security, 2);
    assert.deepEqual(restored.combat.hostileHealth, outcome === 'truce'
      ? { aegis: 2, veil: 2 } : { aegis: 0, veil: 0 });
  }
  const history = newPerimeterHistory();
  const forged = { ...history, combat: { ...history.combat, victory: true, truce: true } };
  assert.equal(perimeterResolution(forged), null);
  const storage = store();
  assert.equal(persistPerimeterSession(forged, 0, false, storage), true);
  assert.equal(perimeterResolution(restorePerimeterSession(storage, 0).history), null);
});

test('a new rescue run cannot inherit the old perimeter even if its reset write fails', () => {
  const storage = store();
  persistPerimeterSession(replayCombatCommands('evacuation', truce), 0, false, storage);
  const old = storage.getItem(PERIMETER_SAVE_KEY);
  assert.equal(persistPerimeterSession(newPerimeterHistory(), 1, false, {
    ...storage, setItem() { throw Error('quota'); },
  }), false);
  const restored = restorePerimeterSession(storage, 1);
  assert.equal(restored.status, 'different-run');
  assert.equal(perimeterResolution(restored.history), null);
  assert.equal(restored.active, false);
  assert.equal(storage.getItem(PERIMETER_SAVE_KEY), old, 'read does not mutate the checkpoint');
  assert.equal(persistPerimeterSession(newPerimeterHistory(), 1, false, storage), true);
  assert.equal(restorePerimeterSession(storage, 1).history.actions.length, 0);
});

test('laboratory saves are neither read as field credit nor overwritten', () => {
  const lab = serializeCombatReplay('evacuation', truce);
  const storage = store([[COMBAT_REPLAY_SAVE_KEY, lab], [CHECKPOINT_KEY, 'crew sentinel']]);
  assert.equal(restorePerimeterSession(storage, 0).status, 'missing');
  persistPerimeterSession(replayCombatCommands('evacuation', approach), 0, true, storage);
  assert.equal(perimeterResolution(restorePerimeterSession(storage, 0).history), null);
  assert.equal(storage.getItem(COMBAT_REPLAY_SAVE_KEY), lab);
  assert.equal(storage.getItem(CHECKPOINT_KEY), 'crew sentinel');
  assert.equal(persistPerimeterSession(replayCombatCommands('relay', []), 0, true, storage), false);
});

test('corrupt, oversized, forged and future field checkpoints cannot mint outcomes or erase evidence on read', () => {
  const valid = { version: 1, rescueRun: 0, active: true,
    combat: JSON.parse(serializeCombatReplay('evacuation', truce)) };
  for (const raw of [
    '{', 'x'.repeat(34000), JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, rescueRun: -1 }), JSON.stringify({ ...valid, active: 1 }),
    JSON.stringify({ ...valid, victory: true }),
    JSON.stringify({ ...valid, combat: { ...valid.combat, victory: true } }),
    JSON.stringify({ ...valid, combat: { ...valid.combat, scenarioId: 'relay' } }),
    JSON.stringify({ ...valid, combat: { ...valid.combat, actions: [{ type: 'parley', officer: 'security' }] } }),
  ]) {
    const storage = store([[PERIMETER_SAVE_KEY, raw]]);
    const restored = restorePerimeterSession(storage, 0);
    assert.equal(restored.status, 'incompatible');
    assert.equal(restored.history.actions.length, 0);
    assert.equal(restored.active, false);
    assert.equal(storage.getItem(PERIMETER_SAVE_KEY), raw);
  }
});

test('denied storage and silently discarded writes are reported without claiming a save', () => {
  assert.equal(restorePerimeterSession(null, 0).status, 'unavailable');
  assert.equal(restorePerimeterSession({ getItem() { throw Error('denied'); } }, 0).status, 'unavailable');
  assert.equal(persistPerimeterSession(newPerimeterHistory(), 0, true, null), false);
  assert.equal(persistPerimeterSession(newPerimeterHistory(), 0, true, {
    setItem() {}, getItem: () => null,
  }), false);
  assert.equal(persistPerimeterSession(newPerimeterHistory(), -1, true, store()), false);
});

test('reopening requires the actual surfaced, faced perimeter station', () => {
  const pose = { version: 1, area: 'surface', x: 6, y: 5, heading: 'E', pending: null };
  assert.equal(atPerimeterStation(world, pose), true);
  for (const change of [{ heading: 'W' }, { area: 'bridge' }, { x: 5 },
    { pending: { id: 'beam-out', to: 'bridge' } }, { x: 0, y: 0 }]) {
    assert.equal(atPerimeterStation(world, { ...pose, ...change }), false);
  }
});

test('only a valid v2 crew history authorizes resuming a saved physical run', () => {
  assert.equal(restoreSession(episode, store()).restored, false);
  assert.equal(restoreSession(episode, store([[CHECKPOINT_KEY, '{']])).restored, false);
  const raw = serializeCrewCheckpoint(episode, startCrewSession(episode));
  assert.equal(restoreSession(episode, store([[CHECKPOINT_KEY, raw]])).restored, true);
});
