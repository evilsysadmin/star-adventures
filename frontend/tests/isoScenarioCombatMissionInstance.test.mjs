import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatMissionInstance, advanceCombatMissionInstance,
  serializeCombatMissionInstance, deserializeCombatMissionInstance,
  MAX_COMBAT_MISSION_INSTANCE_BYTES,
} from '../src/isoScenarioCombatMissionInstance.ts';
import { replayCombatCommands, serializeCombatReplay } from '../src/isoScenarioCombatReplay.ts';

const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondId = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';
const fresh = () => replayCombatCommands('relay', []);

test('two distinct attempts with identical commands retain separate stable IDs', () => {
  const first = createCombatMissionInstance(firstId, fresh());
  const second = createCombatMissionInstance(secondId, fresh());
  assert.notEqual(first.instanceId, second.instanceId);
  assert.deepEqual(first.history, second.history);
  assert.equal(deserializeCombatMissionInstance(serializeCombatMissionInstance(first)).instanceId, firstId);
  assert.equal(deserializeCombatMissionInstance(serializeCombatMissionInstance(second)).instanceId, secondId);
});

test('a tactical attempt survives a round trip with replay-derived state only', () => {
  const history = replayCombatCommands('relay', [{ type: 'end-turn' }]);
  const forged = { ...history, combat: { ...history.combat, victory: true } };
  const instance = createCombatMissionInstance(firstId, forged);
  assert.equal(instance.history.combat.victory, false);
  const saved = serializeCombatMissionInstance(instance);
  assert.deepEqual(JSON.parse(saved), {
    version: 1, instanceId: firstId,
    checkpoint: serializeCombatReplay('relay', history.actions),
  });
  assert.deepEqual(deserializeCombatMissionInstance(saved), instance);
  assert.ok(Object.isFrozen(instance));
});

test('append-only commands preserve identity and reject rewound or rewritten history', () => {
  const initial = createCombatMissionInstance(firstId, fresh());
  const next = replayCombatCommands('relay', [{ type: 'end-turn' }]);
  const advanced = advanceCombatMissionInstance(initial, next);
  assert.equal(advanced.instanceId, firstId);
  assert.equal(advanced.history.actions.length, 1);
  assert.equal(advanceCombatMissionInstance(advanced, next).instanceId, firstId);
  assert.throws(() => advanceCombatMissionInstance(advanced, fresh()), /replace/);
  const alternate = replayCombatCommands('relay', [{ type: 'move', officer: 'security', cell: '3:7' }]);
  assert.throws(() => advanceCombatMissionInstance(advanced, alternate), /rewrite/);
  assert.throws(() => advanceCombatMissionInstance(
    advanced, replayCombatCommands('derelict', [{ type: 'end-turn' }]),
  ), /replace/);
});

test('invalid IDs, forged flags, future schemas and corrupt replay fail closed', () => {
  assert.throws(() => createCombatMissionInstance('mission-1', fresh()), /ID/);
  assert.throws(() => createCombatMissionInstance(firstId, {
    ...fresh(), actions: [{ type: 'fire', officer: 'science', hostile: 'aegis' }],
  }), /./);
  const saved = JSON.parse(serializeCombatMissionInstance(createCombatMissionInstance(firstId, fresh())));
  for (const invalid of [
    '{', JSON.stringify({ ...saved, version: 2 }),
    JSON.stringify({ ...saved, xp: 1000 }),
    JSON.stringify({ ...saved, instanceId: 'not-a-uuid' }),
    JSON.stringify({ ...saved, checkpoint: '{broken' }),
    JSON.stringify({ ...saved, checkpoint: JSON.stringify({ version: 4, scenarioId: 'relay', actions: [], victory: true }) }),
    'x'.repeat(MAX_COMBAT_MISSION_INSTANCE_BYTES + 1),
  ]) assert.throws(() => deserializeCombatMissionInstance(invalid), /./);
});
