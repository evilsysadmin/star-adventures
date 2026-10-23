import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_START, commitTrainingMove,
} from '../src/isoTrainingMovement.ts';
import { evaluatePracticeShot, traceTrainingRay } from '../src/isoTrainingLineOfSight.ts';

test('actual authored practice targets may be aimed at only if visibility is clear', () => {
  const valid = evaluatePracticeShot(TRAINING_START,'science','6:2');
  assert.equal(valid.allowed,true);
  assert.equal(valid.reason,'ready');
  assert.equal(valid.cells[0],'1:1');
  assert.equal(valid.cells.at(-1),'6:2');
  assert.equal(valid.blocker,null);
  assert.equal(evaluatePracticeShot(TRAINING_START,'security','6:5').allowed,true);
  assert.deepEqual(TRAINING_START.units.map(u=>u.cell),['1:1','2:5','1:6']);
});

test('real authored cover blocks a line even when no enemy or combat system exists', () => {
  const shot=evaluatePracticeShot(TRAINING_START,'science','6:5');
  assert.equal(shot.allowed,false);
  assert.equal(shot.reason,'cover-blocked');
  assert.equal(shot.blocker,'3:3');
  const fromSecurity=evaluatePracticeShot(TRAINING_START,'security','6:2');
  assert.equal(fromSecurity.reason,'cover-blocked');
  assert.equal(fromSecurity.blocker,'4:3');
});

test('supercover handles exact corner grazing conservatively and symmetrically', () => {
  assert.deepEqual(traceTrainingRay('1:1','2:2'),['1:1','2:1','1:2','2:2']);
  assert.deepEqual(traceTrainingRay('1:1','1:3'),['1:1','1:2','1:3']);
  assert.deepEqual(traceTrainingRay('1:1','3:1'),['1:1','2:1','3:1']);
  const diagonal=traceTrainingRay('1:1','5:5');
  assert.ok(diagonal.includes('3:3'));
  assert.ok(diagonal.includes('4:3'));
  assert.equal(new Set(diagonal).size,diagonal.length);
  assert.deepEqual(traceTrainingRay('7:7','7:7'),['7:7']);
  assert.throws(()=>traceTrainingRay('1:1','8:0'),RangeError);
  assert.throws(()=>traceTrainingRay('-1:1','2:2'),RangeError);
});

test('an officer moved into the sight line prevents a shot through a teammate', () => {
  const safe=evaluatePracticeShot(TRAINING_START,'security','6:5');
  assert.equal(safe.reason,'ready');
  const next=commitTrainingMove(TRAINING_START,'medic','4:5');
  const blocked=evaluatePracticeShot(next,'security','6:5');
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.reason,'ally-blocked');
  assert.equal(blocked.blocker,'4:5');
  assert.equal(evaluatePracticeShot(TRAINING_START,'security','6:5').allowed,true);
});

test('out of range, non-target cells, unknown shooters and corrupt squads fail closed', () => {
  assert.deepEqual(evaluatePracticeShot(TRAINING_START,'science','3:3'),
    {allowed:false,reason:'invalid-target',cells:[],blocker:null});
  assert.deepEqual(evaluatePracticeShot(TRAINING_START,'unknown','6:2'),
    {allowed:false,reason:'unknown-officer',cells:[],blocker:null});
  const distant=commitTrainingMove(TRAINING_START,'science','0:0');
  assert.equal(evaluatePracticeShot(distant,'science','6:5').reason,'out-of-range');
  const corrupted={units:[
    {id:'science',cell:'3:3'},
    {id:'security',cell:'2:5'},
    {id:'medic',cell:'1:6'},
  ]};
  assert.throws(()=>evaluatePracticeShot(corrupted,'science','6:2'),TypeError);
});
