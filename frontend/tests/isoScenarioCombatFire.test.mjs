import test from 'node:test';
import assert from 'node:assert/strict';
import { replayCombatEncounter } from '../src/isoScenarioCombatEncounter.ts';
import { evaluateCombatAim } from '../src/isoScenarioCombatAim.ts';
import { startCombatFire, fireCombatShot, COMBAT_HOSTILE_MAX_HP } from '../src/isoScenarioCombatFire.ts';
import { serializeCombatEncounterCheckpoint } from '../src/isoScenarioCombatCheckpoint.ts';

const positioned = locations => {
  const encounter = replayCombatEncounter('relay', []);
  return { ...encounter, mission: {
    ...encounter.mission,
    locations: { ...encounter.mission.locations, ...locations },
  } };
};

test('initial enemy HP is independent of the replayed v3 encounter', () => {
  const encounter = replayCombatEncounter('relay', []);
  const before = structuredClone(encounter);
  const state = startCombatFire(encounter);
  assert.equal(COMBAT_HOSTILE_MAX_HP, 2);
  assert.deepEqual(state.hostileHealth, { aegis: 2, veil: 2 });
  assert.deepEqual(state.shots, []);
  assert.equal(state.victory, false);
  assert.deepEqual(encounter, before);
  assert.equal(Object.isFrozen(state.hostileHealth), true);
});

test('legal fire costs exactly one AP, deals one deterministic hit and never mutates input', () => {
  const original = startCombatFire(positioned({ security: '7:5' }));
  const before = structuredClone(original);
  const first = fireCombatShot(original, 'security', 'veil');
  assert.deepEqual(first, fireCombatShot(original, 'security', 'veil'));
  assert.equal(first.encounter.mission.ap, 2);
  assert.deepEqual(first.hostileHealth, { aegis: 2, veil: 1 });
  assert.deepEqual(first.shots, [{
    officer: 'security', hostile: 'veil', cell: '8:5',
    damage: 1, remainingHp: 1, round: 1,
  }]);
  const second = fireCombatShot(first, 'security', 'veil');
  assert.equal(second.hostileHealth.veil, 0);
  assert.equal(second.encounter.mission.ap, 1);
  assert.throws(() => fireCombatShot(second, 'security', 'veil'), /already eliminated/);
  assert.deepEqual(original, before);
  assert.equal(Object.isFrozen(second.shots), true);
  assert.equal(Object.isFrozen(second.encounter.mission.events), true);
  assert.deepEqual(JSON.parse(serializeCombatEncounterCheckpoint('relay', [])), {
    version: 3, scenarioId: 'relay', actions: [],
  }, 'v3 persistence remains unchanged');
});

test('invalid and blocked shots do not consume AP or change state', () => {
  const baseline = startCombatFire(replayCombatEncounter('relay', []));
  const before = structuredClone(baseline);
  assert.throws(() => fireCombatShot(baseline, 'science', 'veil'), /out-of-range/);
  assert.throws(() => fireCombatShot(baseline, 'security', 'aegis'), /terrain-blocked/);
  assert.throws(() => fireCombatShot(baseline, 'captain', 'veil'), /unknown-officer/);
  assert.throws(() => fireCombatShot(baseline, 'security', 'ghost'), /unknown-hostile/);
  const ready = startCombatFire(positioned({ security: '7:5' }));
  assert.throws(() => fireCombatShot({
    ...ready, encounter: { ...ready.encounter,
      mission: { ...ready.encounter.mission, ap: 0 } },
  }, 'security', 'veil'), /no-action-points/);
  assert.throws(() => fireCombatShot({
    ...ready, encounter: { ...ready.encounter, failed: true },
  }, 'security', 'veil'), /encounter-ended/);
  assert.deepEqual(baseline, before);
});

test('eliminated contacts stop blocking shots to living enemies', () => {
  const original = startCombatFire(positioned({ security: '5:6' }));
  assert.equal(evaluateCombatAim(original.encounter, 'security', 'veil').reason, 'contact-blocked');
  const one = fireCombatShot(original, 'security', 'aegis');
  const two = fireCombatShot(one, 'security', 'aegis');
  const three = fireCombatShot(two, 'security', 'veil');
  assert.equal(three.encounter.mission.ap, 0);
  assert.deepEqual(three.hostileHealth, { aegis: 0, veil: 1 });
  assert.equal(three.shots[2].hostile, 'veil');
  assert.throws(() => fireCombatShot(three, 'security', 'veil'), /no-action-points/);
});

test('eliminating the last contact declares victory and rejects extra shots', () => {
  const initial = startCombatFire(positioned({ security: '5:6' }));
  const state = {
    ...initial,
    hostileHealth: { aegis: 0, veil: 1 },
    encounter: { ...initial.encounter, mission: { ...initial.encounter.mission, ap: 1 } },
  };
  const win = fireCombatShot(state, 'security', 'veil');
  assert.equal(win.victory, true);
  assert.deepEqual(win.hostileHealth, { aegis: 0, veil: 0 });
  assert.throws(() => fireCombatShot(win, 'security', 'aegis'), /already won/);
});
