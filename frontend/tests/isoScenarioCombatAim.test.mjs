import test from 'node:test';
import assert from 'node:assert/strict';
import { replayCombatEncounter } from '../src/isoScenarioCombatEncounter.ts';
import { evaluateCombatAim, traceCombatRay, COMBAT_SHOT_MAX_RANGE } from '../src/isoScenarioCombatAim.ts';
import { serializeCombatEncounterCheckpoint } from '../src/isoScenarioCombatCheckpoint.ts';

const baseline = () => replayCombatEncounter('relay', []);
const positioned = locations => {
  const encounter = baseline();
  return { ...encounter, mission: {
    ...encounter.mission,
    locations: { ...encounter.mission.locations, ...locations },
  } };
};

test('authored 10x10 and 12x12 contacts have deterministic adjacent aiming, without damage', () => {
  const near = positioned({ security: '7:5' });
  const before = structuredClone(near);
  const shot = evaluateCombatAim(near, 'security', 'veil');
  assert.equal(COMBAT_SHOT_MAX_RANGE, 7.5);
  assert.deepEqual(shot, { allowed: true, reason: 'ready',
    cells: ['7:5', '8:5'], blocker: null });
  assert.deepEqual(evaluateCombatAim(near, 'security', 'veil'), shot);
  assert.deepEqual(near, before, 'aiming never mutates the replayed encounter');
  assert.deepEqual(JSON.parse(serializeCombatEncounterCheckpoint('relay', [])), {
    version: 3, scenarioId: 'relay', actions: [],
  }, 'a preview must not invent a combat command or change existing saves');
  const other = replayCombatEncounter('derelict', []);
  const next = { ...other, mission: {
    ...other.mission, locations: { ...other.mission.locations, security: '9:6' },
  } };
  assert.equal(evaluateCombatAim(next, 'security', 'veil').allowed, true);
});

test('cover and walls block shots; 8x8 training coordinates are not assumed', () => {
  assert.deepEqual(evaluateCombatAim(positioned({ security: '6:3' }), 'security', 'veil'),
    { allowed: false, reason: 'terrain-blocked',
      cells: traceCombatRay('6:3', '8:5', 10), blocker: '6:4' });
  assert.equal(evaluateCombatAim(baseline(), 'security', 'aegis').reason, 'terrain-blocked');
  assert.deepEqual(traceCombatRay('5:5', '6:6', 10),
    ['5:5', '6:5', '5:6', '6:6'], 'corner grazing cannot pass between two obstacles');
  assert.deepEqual(traceCombatRay('10:10', '11:11', 12),
    ['10:10', '11:10', '10:11', '11:11']);
  assert.throws(() => traceCombatRay('10:10', '11:11', 10), /endpoint/);
  assert.throws(() => traceCombatRay('1:1', '2:2', 9), /size/);
});

test('officers and other hostile contacts block line of sight', () => {
  const ally = evaluateCombatAim(positioned({ security: '6:5', science: '7:5' }), 'security', 'veil');
  assert.equal(ally.reason, 'ally-blocked');
  assert.equal(ally.blocker, '7:5');
  const contact = evaluateCombatAim(positioned({ security: '5:6' }), 'security', 'veil');
  assert.equal(contact.reason, 'contact-blocked');
  assert.equal(contact.blocker, '6:6');
  assert.equal(evaluateCombatAim(positioned({ security: '7:5' }), 'security', 'aegis').allowed, true);
});

test('aiming fails closed on range, invalid IDs, incapacitation, no AP and defeat', () => {
  const ready = baseline();
  assert.equal(evaluateCombatAim(ready, 'science', 'veil').reason, 'out-of-range');
  assert.equal(evaluateCombatAim(ready, 'captain', 'veil').reason, 'unknown-officer');
  assert.equal(evaluateCombatAim(ready, 'security', 'ghost').reason, 'unknown-hostile');
  const near = positioned({ security: '7:5' });
  assert.equal(evaluateCombatAim({ ...near, health: { ...near.health, security: 0 } },
    'security', 'veil').reason, 'incapacitated');
  assert.equal(evaluateCombatAim({ ...near, mission: { ...near.mission, ap: 0 } },
    'security', 'veil').reason, 'no-action-points');
  assert.equal(evaluateCombatAim({ ...near, failed: true },
    'security', 'veil').reason, 'encounter-ended');
});
