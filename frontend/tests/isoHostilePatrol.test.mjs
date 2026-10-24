import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTILE_PATROLS, HOSTILE_PATROL_STEP_MS,
  hostilePatrolCellsAt, hostilePatrolPositionAt, validateHostilePatrols,
} from '../src/isoHostilePatrol.ts';

test('hostile routes are deterministic, distinct and start at the authored training targets', () => {
  validateHostilePatrols();
  assert.deepEqual(hostilePatrolCellsAt(0), ['6:2', '6:5']);
  assert.deepEqual(hostilePatrolCellsAt(HOSTILE_PATROL_STEP_MS), ['6:1', '6:6']);
  assert.deepEqual(hostilePatrolCellsAt(HOSTILE_PATROL_STEP_MS * 4), ['6:2', '6:5']);
  assert.equal(new Set(HOSTILE_PATROLS.flatMap(patrol => patrol.cells)).size, 8);
});

test('patrol segments interpolate forward and wrap without relying on browser time', () => {
  assert.deepEqual(hostilePatrolPositionAt('aegis', 0),
    {from:'6:2', to:'6:1', fraction:0});
  assert.deepEqual(hostilePatrolPositionAt('veil', HOSTILE_PATROL_STEP_MS * 1.5),
    {from:'6:6', to:'5:6', fraction:.5});
  assert.deepEqual(hostilePatrolPositionAt('aegis', HOSTILE_PATROL_STEP_MS * 3.25),
    {from:'5:2', to:'6:2', fraction:.25});
});

test('forged patrol definitions and elapsed times fail closed', () => {
  assert.throws(() => validateHostilePatrols([{id:'aegis',label:'x',cells:['6:2']}]), TypeError);
  assert.throws(() => validateHostilePatrols([
    {id:'aegis',label:'x',cells:['6:2','5:2']},
    {id:'veil',label:'y',cells:['6:2','5:5']},
  ]), TypeError);
  assert.throws(() => hostilePatrolPositionAt('aegis', -1), RangeError);
  assert.throws(() => hostilePatrolPositionAt('veil', Number.NaN), RangeError);
});
