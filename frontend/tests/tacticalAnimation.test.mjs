import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_ATLAS, walkFrameAt, walkFrameUv } from '../src/tacticalAnimation.ts';

test('walk animation advances through all six atlas cells and loops', () => {
  assert.equal(WALK_ATLAS.frames, 6);
  assert.deepEqual(walkFrameUv(0), { x: 0, y: .5 });
  assert.deepEqual(walkFrameUv(2), { x: 2 / 3, y: .5 });
  assert.deepEqual(walkFrameUv(3), { x: 0, y: 0 });
  assert.deepEqual(walkFrameUv(6), walkFrameUv(0));
  assert.equal(walkFrameAt(0), 0);
  assert.equal(walkFrameAt(1_000), 0);
  assert.equal(walkFrameAt(1_000 / WALK_ATLAS.fps), 1);
});
