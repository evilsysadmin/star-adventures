import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTILE_IDLE_FRAME_MS, HOSTILE_STEP_MS, hostileIdleFrameAt, hostileStepAt, joinHostileRoutes, hostileRouteStepAt,
} from '../src/isoHostileAnimation.ts';
import { WALK_ATLAS } from '../src/tacticalAnimation.ts';

test('one hostile step visits every walk-atlas frame before arriving exactly', () => {
  const seen = [];
  let previous = -1;
  for (let index = 0; index < WALK_ATLAS.frames; index++) {
    const sample = hostileStepAt((index + .5) * HOSTILE_STEP_MS / WALK_ATLAS.frames);
    assert.equal(sample.frame, index);
    assert.equal(sample.done, false);
    assert.ok(sample.progress > previous && sample.progress < 1);
    previous = sample.progress;
    seen.push(sample.frame);
  }
  assert.deepEqual(seen, [0,1,2,3,4,5]);
  assert.deepEqual(hostileStepAt(HOSTILE_STEP_MS), {progress:1,frame:0,done:true});
  assert.deepEqual(hostileStepAt(HOSTILE_STEP_MS*3), {progress:1,frame:0,done:true});
});

test('invalid timestamps never produce NaN positions or atlas indices', () => {
  for(const t of [-1,NaN,Infinity,-Infinity]){
    assert.deepEqual(hostileStepAt(t),{progress:0,frame:0,done:false});
    assert.equal(hostileIdleFrameAt(t),0);
  }
  assert.deepEqual(hostileStepAt(0),{progress:0,frame:0,done:false});
});

test('idle cycles all six frames and can stagger hostile contacts independently', () => {
  const a=Array.from({length:12},(_,n)=>hostileIdleFrameAt(n*HOSTILE_IDLE_FRAME_MS));
  assert.deepEqual(a,[0,1,2,3,4,5,0,1,2,3,4,5]);
  assert.notEqual(hostileIdleFrameAt(0,0),hostileIdleFrameAt(0,2));
  assert.equal(hostileIdleFrameAt(5*HOSTILE_IDLE_FRAME_MS,2),1);
});


test('consecutive enemy turns preserve every real orthogonal step instead of jumping to the previous endpoint', () => {
  const first = ['6:6', '6:5'];
  const next = ['6:5', '5:5'];
  const route = joinHostileRoutes(first, next);
  assert.deepEqual(route, ['6:6', '6:5', '5:5']);
  assert.deepEqual(first, ['6:6', '6:5'], 'No mutation of the original walk');
  assert.equal(joinHostileRoutes(first, ['5:6', '5:5']), null, 'No diagonal or invented connector');
  assert.equal(joinHostileRoutes(first, ['6:5']), null, 'No movement to append');
  for (let segment = 0; segment < 2; segment++) {
    for (let frame = 0; frame < WALK_ATLAS.frames; frame++) {
      const time = (segment + (frame + .5) / WALK_ATLAS.frames) * HOSTILE_STEP_MS;
      const step = hostileRouteStepAt(route, time);
      assert.equal(step.from, route[segment]);
      assert.equal(step.to, route[segment + 1]);
      assert.equal(step.segment, segment);
      assert.equal(step.frame, frame);
      assert.equal(step.done, false);
    }
  }
  assert.deepEqual(hostileRouteStepAt(route, 2 * HOSTILE_STEP_MS),
    { from:'5:5', to:'5:5', segment:2, progress:1, frame:0, done:true });
  for (const time of [-1, NaN, Infinity, -Infinity]) {
    const step = hostileRouteStepAt(route, time);
    assert.equal(step.from, '6:6');
    assert.equal(step.progress, 0);
  }
});
