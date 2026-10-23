import test from 'node:test';
import assert from 'node:assert/strict';
import { isoOfficerFrame } from '../src/isoOfficerAnimation.ts';
import { WALK_ATLAS } from '../src/tacticalAnimation.ts';

test('stationary officers use a real fixed atlas frame rather than walking in place', () => {
  for (const unit of ['science','security','medic']) {
    for (const time of [0,167,360,1300,48_900]) {
      assert.equal(isoOfficerFrame(unit,null,time,true),0);
    }
  }
});

test('only the moving officer walks; two other sprites remain on their first frame', () => {
  const motion = {unitId:'science',start:1_000};
  assert.equal(isoOfficerFrame('science',motion,1_001,true),0);
  assert.equal(isoOfficerFrame('science',motion,1_210,true),1);
  assert.equal(isoOfficerFrame('science',motion,1_550,true),3);
  assert.equal(isoOfficerFrame('science',motion,2_001,true),0);
  for (const unit of ['security','medic']) {
    assert.equal(isoOfficerFrame(unit,motion,1_210,true),0);
    assert.equal(isoOfficerFrame(unit,motion,1_550,true),0);
  }
  assert.equal(isoOfficerFrame('science',{unitId:'security',start:0},1_550,true),0);
});

test('pause, reduced motion, not-yet-started paths and negative timestamps stay at rest', () => {
  const motion={unitId:'medic',start:2_000};
  assert.equal(isoOfficerFrame('medic',motion,2_550,false),0);
  assert.equal(isoOfficerFrame('medic',{unitId:'medic',start:null},2_550,true),0);
  assert.equal(isoOfficerFrame('medic',motion,1_000,true),0);
  assert.equal(isoOfficerFrame('medic',motion,Number.NaN,true),0);
  assert.equal(isoOfficerFrame('medic',motion,Number.POSITIVE_INFINITY,true),0);
  assert.equal(isoOfficerFrame('medic',motion,2_550,true),3);
  assert.equal(WALK_ATLAS.frames,6);
});
