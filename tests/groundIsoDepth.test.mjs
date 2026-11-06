import test from 'node:test';
import assert from 'node:assert/strict';
import { orderGroundOfficersByDepth } from '../src/groundIsoDepth.mjs';

const officers = Object.freeze([
  Object.freeze({id:'rear', x:380, y:192, gridX:3, gridY:5}),
  Object.freeze({id:'front', x:420, y:238, gridX:5, gridY:6}),
  Object.freeze({id:'middle', x:410, y:210, gridX:4, gridY:5}),
]);

test('ground painter order follows projected feet instead of squad roster order', () => {
  const before = officers.map(unit => unit.id);
  const painted = orderGroundOfficersByDepth(officers);
  assert.deepEqual(painted.map(unit => unit.id), ['rear','middle','front']);
  assert.deepEqual(officers.map(unit => unit.id), before);
  assert.equal(painted[0], officers[0], 'render ordering preserves the canonical officer');
});

test('walking officer changes render depth without mutating saved grid coordinates', () => {
  const walkPose = {officerId:'rear', x:400, y:248};
  assert.deepEqual(orderGroundOfficersByDepth(officers, walkPose).map(unit=>unit.id),
    ['middle','front','rear']);
  assert.deepEqual(orderGroundOfficersByDepth(officers, {officerId:'rear',x:440,y:185})
    .map(unit=>unit.id), ['rear','middle','front']);
  assert.equal(officers[0].y, 192);
  assert.equal(officers[0].gridX, 3);
});

test('overlapping feet have a deterministic horizontal and ID tie break', () => {
  const tied = [{id:'z',x:400,y:200},{id:'a',x:400,y:200},{id:'far',x:380,y:200}];
  assert.deepEqual(orderGroundOfficersByDepth(tied).map(unit=>unit.id), ['far','a','z']);
});
