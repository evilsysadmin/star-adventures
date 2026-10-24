import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../src/isoScenarioCampaign.ts';
import {
  HOSTILE_ENCOUNTER_CHECKPOINT_VERSION, HOSTILE_ENCOUNTER_SAVE_KEY,
  replayHostileEncounterCommands, serializeHostileEncounterCheckpoint,
  deserializeHostileEncounterCheckpoint,
} from '../src/isoScenarioHostileCheckpoint.ts';
import {
  SCENARIO_SAVE_KEY, serializeScenarioCheckpoint, deserializeScenarioCheckpoint,
  MAX_SCENARIO_CHECKPOINT_BYTES,
} from '../src/isoScenarioCheckpoint.ts';

test('hostile checkpoints have a separate key and explicit v2 schema', () => {
  assert.equal(HOSTILE_ENCOUNTER_CHECKPOINT_VERSION, 2);
  assert.notEqual(HOSTILE_ENCOUNTER_SAVE_KEY, SCENARIO_SAVE_KEY);
  const raw = serializeHostileEncounterCheckpoint('relay', [{ type: 'end-turn' }]);
  assert.deepEqual(Object.keys(JSON.parse(raw)), ['version', 'scenarioId', 'actions']);
  assert.equal(JSON.parse(raw).version, 2);
  assert.equal(JSON.parse(serializeScenarioCheckpoint('relay', [])).version, 1);
  assert.throws(() => deserializeHostileEncounterCheckpoint(serializeScenarioCheckpoint('relay', [])),
    /Incompatible/);
  assert.throws(() => deserializeScenarioCheckpoint(raw), /Incompatible/);
});

for (const scenario of Object.values(SCENARIOS)) {
  test(`${scenario.id}: 20 enemy turns survive deterministic v2 round-trip`, () => {
    const actions = Array.from({ length: 20 }, () => ({ type: 'end-turn' }));
    const raw = serializeHostileEncounterCheckpoint(scenario.id, actions);
    const history = deserializeHostileEncounterCheckpoint(raw);
    const direct = replayHostileEncounterCommands(scenario.id, actions);
    assert.deepEqual(history, direct);
    assert.equal(history.encounter.enemyTurns, 20);
    assert.equal(history.encounter.mission.round, 21);
    assert.equal(new Set(Object.values(history.encounter.positions)).size, 2);
    assert.equal(serializeHostileEncounterCheckpoint(history.scenarioId, history.actions), raw);
    assert.deepEqual(actions, Array.from({ length: 20 }, () => ({ type: 'end-turn' })),
      'serialization cannot mutate caller commands');
  });
}

test('hostile save never trusts injected positions, events, or command fields', () => {
  const base = JSON.parse(serializeHostileEncounterCheckpoint('relay', [{ type: 'end-turn' }]));
  for (const extra of [
    { positions: { aegis: '0:0', veil: '0:1' } },
    { completed: true },
    { events: ['Victory'] },
  ]) assert.throws(() => deserializeHostileEncounterCheckpoint(JSON.stringify({ ...base, ...extra })),
    /Incompatible/);
  for (const actions of [
    [{ type: 'end-turn', extra: 'forged' }],
    [{ type: 'move', officer: 'science', cell: '2:1', ap: 99 }],
    [{ type: 'scan', officer: 'science' }],
    [null],
  ]) assert.throws(() => deserializeHostileEncounterCheckpoint(JSON.stringify({ ...base, actions })));
  assert.throws(() => deserializeHostileEncounterCheckpoint(JSON.stringify({ ...base, scenarioId: '__proto__' })),
    /Incompatible/);
});

test('invalid, future, malformed and oversized hostile saves fail closed', () => {
  const base = JSON.parse(serializeHostileEncounterCheckpoint('relay', []));
  for (const payload of [
    { ...base, version: 1 },
    { ...base, version: 3 },
    { ...base, actions: {} },
    { ...base, scenarioId: 'missing' },
  ]) assert.throws(() => deserializeHostileEncounterCheckpoint(JSON.stringify(payload)),
    /Incompatible/);
  assert.throws(() => deserializeHostileEncounterCheckpoint('{bad json'), /Malformed/);
  assert.throws(() => deserializeHostileEncounterCheckpoint('x'.repeat(MAX_SCENARIO_CHECKPOINT_BYTES + 1)),
    /size/);
  assert.throws(() => serializeHostileEncounterCheckpoint('relay',
    Array.from({ length: 257 }, () => ({ type: 'end-turn' }))), /oversized/);
});

test('v1 training history is unchanged when a separate v2 encounter is created', () => {
  const legacy = serializeScenarioCheckpoint('relay', [
    { type: 'end-turn' }, { type: 'move', officer: 'science', cell: '2:1' },
  ]);
  const encounter = serializeHostileEncounterCheckpoint('relay', [
    { type: 'end-turn' }, { type: 'move', officer: 'science', cell: '2:1' },
  ]);
  assert.equal(deserializeScenarioCheckpoint(legacy).state.locations.science, '2:1');
  assert.equal(deserializeHostileEncounterCheckpoint(encounter).encounter.mission.locations.science, '2:1');
  assert.equal(JSON.parse(legacy).version, 1);
  assert.equal(JSON.parse(encounter).version, 2);
});
