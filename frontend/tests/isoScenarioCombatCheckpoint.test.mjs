import test from 'node:test';
import assert from 'node:assert/strict';
import { replayHostileEncounter } from '../src/isoScenarioHostileEncounter.ts';
import { serializeHostileEncounterCheckpoint, deserializeHostileEncounterCheckpoint } from '../src/isoScenarioHostileCheckpoint.ts';
import { serializeScenarioCheckpoint, deserializeScenarioCheckpoint, MAX_SCENARIO_CHECKPOINT_BYTES } from '../src/isoScenarioCheckpoint.ts';
import { replayCombatEncounter, COMBAT_OFFICER_MAX_HP } from '../src/isoScenarioCombatEncounter.ts';
import {
  COMBAT_ENCOUNTER_CHECKPOINT_VERSION, COMBAT_ENCOUNTER_SAVE_KEY,
  replayCombatEncounterCommands, serializeCombatEncounterCheckpoint,
  deserializeCombatEncounterCheckpoint,
} from '../src/isoScenarioCombatCheckpoint.ts';

const buildUntil = predicate => {
  const actions = [];
  for (let i = 0; i < 60; i++) {
    actions.push({ type: 'end-turn' });
    const encounter = replayCombatEncounter('relay', actions);
    if (predicate(encounter)) return { actions, encounter };
  }
  assert.fail('authored relay contacts must eventually reach the requested combat state');
};

test('v3 replay converts real adjacent threats into deterministic injuries, not random hits', () => {
  const { actions, encounter } = buildUntil(state => state.hits.length > 0);
  assert.equal(COMBAT_OFFICER_MAX_HP, 3);
  assert.deepEqual(encounter, replayCombatEncounter('relay', actions));
  assert.deepEqual(encounter.hits.map(hit => ({ hostile: hit.hostile, officer: hit.officer, cell: hit.cell })),
    encounter.threats.map(threat => ({ hostile: threat.hostile, officer: threat.officer, cell: threat.cell })));
  const expectedHealth = { science: 3, security: 3, medic: 3 };
  for (const hit of encounter.hits) {
    assert.equal(hit.damage, 1);
    assert.equal(hit.round, encounter.mission.round - 1);
    expectedHealth[hit.officer]--;
    assert.equal(hit.remainingHp, expectedHealth[hit.officer]);
  }
  assert.deepEqual(encounter.health, expectedHealth);
  assert.equal(encounter.failed, false);
  assert.deepEqual(actions, Array.from({ length: actions.length }, () => ({ type: 'end-turn' })),
    'replay cannot mutate commands');
  assert.equal(Object.isFrozen(encounter.health), true);
  assert.equal(Object.isFrozen(encounter.hits), true);
});

test('three sustained hits incapacitate an officer and end the v3 encounter', () => {
  const { actions, encounter } = buildUntil(state => state.failed);
  assert.equal(encounter.failed, true);
  assert.ok(Object.values(encounter.health).includes(0));
  assert.ok(Object.values(encounter.health).every(hp => Number.isInteger(hp) && hp >= 0 && hp <= 3));
  assert.throws(() => replayCombatEncounter('relay', [...actions, { type: 'end-turn' }]),
    /already failed/);
  assert.equal(replayHostileEncounter('relay', [...actions, { type: 'end-turn' }]).enemyTurns,
    actions.length + 1, 'legacy v2 replay still permits the same movement-only turns');
});

test('v3 checkpoint round-trip replays injuries without storing mutable combat snapshots', () => {
  const { actions, encounter } = buildUntil(state => state.hits.length > 0);
  const raw = serializeCombatEncounterCheckpoint('relay', actions);
  assert.equal(COMBAT_ENCOUNTER_CHECKPOINT_VERSION, 3);
  assert.notEqual(COMBAT_ENCOUNTER_SAVE_KEY, 'shadowops.star-adventures.hostile-encounter.v2');
  assert.deepEqual(JSON.parse(raw), { version: 3, scenarioId: 'relay', actions });
  assert.deepEqual(deserializeCombatEncounterCheckpoint(raw).encounter, encounter);
  assert.deepEqual(replayCombatEncounterCommands('relay', actions).encounter, encounter);
  assert.equal(serializeCombatEncounterCheckpoint('relay', actions), raw);
  const v2 = serializeHostileEncounterCheckpoint('relay', actions);
  const v1 = serializeScenarioCheckpoint('relay', actions);
  assert.equal(JSON.parse(v2).version, 2);
  assert.equal(JSON.parse(v1).version, 1);
  assert.equal(deserializeHostileEncounterCheckpoint(v2).encounter.enemyTurns, actions.length);
  assert.equal(deserializeScenarioCheckpoint(v1).state.round, actions.length + 1);
  assert.throws(() => deserializeCombatEncounterCheckpoint(v2), /Incompatible/);
  assert.throws(() => deserializeHostileEncounterCheckpoint(raw), /Incompatible/);
  assert.throws(() => deserializeScenarioCheckpoint(raw), /Incompatible/);
});

test('v3 rejects forged health, injuries, defeat, malformed actions and future versions', () => {
  const base = JSON.parse(serializeCombatEncounterCheckpoint('relay', [{ type: 'end-turn' }]));
  for (const extra of [
    { health: { science: 999 } }, { hits: [{ damage: 0 }] },
    { failed: false }, { positions: { aegis: '0:0' } },
  ]) assert.throws(() => deserializeCombatEncounterCheckpoint(JSON.stringify({ ...base, ...extra })),
    /Incompatible/);
  for (const changed of [
    { ...base, version: 4 },
    { ...base, version: 2 },
    { ...base, scenarioId: '__proto__' },
    { ...base, actions: {} },
  ]) assert.throws(() => deserializeCombatEncounterCheckpoint(JSON.stringify(changed)),
    /Incompatible/);
  for (const actions of [
    [{ type: 'end-turn', damage: 0 }],
    [{ type: 'move', officer: 'science', cell: '01:2' }],
    [{ type: 'scan', officer: 'science' }],
    [null],
  ]) assert.throws(() => deserializeCombatEncounterCheckpoint(JSON.stringify({ ...base, actions })));
  assert.throws(() => deserializeCombatEncounterCheckpoint('{'), /Malformed/);
  assert.throws(() => deserializeCombatEncounterCheckpoint('x'.repeat(MAX_SCENARIO_CHECKPOINT_BYTES + 1)), /size/);
  assert.throws(() => replayCombatEncounter('missing', []));
});
