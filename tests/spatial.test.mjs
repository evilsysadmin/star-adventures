import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpatialError, validateWorld, startExploration, applyExploration, faceTile } from '../src/spatial.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url), 'utf8'));
const dispatch = (s, type) => applyExploration(world, s, { type });

test('authored bridge/surface world and every spawn validate', () => {
  assert.equal(validateWorld(world), true);
  const start = startExploration(world);
  assert.deepEqual({ area: start.area, x: start.x, y: start.y, heading: start.heading }, { area: 'bridge', x: 3, y: 5, heading: 'N' });
});

test('move and rotate use identical rules regardless of scene, never mutate prior state', () => {
  const start = startExploration(world);
  const left = dispatch(start, 'turn-left').state;
  assert.equal(left.heading, 'W');
  assert.deepEqual(faceTile(left), { x: 2, y: 5 });
  const moved = dispatch(left, 'forward');
  assert.equal(moved.event.type, 'moved');
  assert.equal(moved.state.x, 2);
  assert.equal(start.x, 3);
  const nearerHelm = dispatch(dispatch(start, 'forward').state, 'forward').state;
  const blocked = dispatch(nearerHelm, 'forward');
  assert.equal(blocked.event.type, 'blocked'); // Helm console occupies 3,2
  assert.deepEqual(blocked.state, nearerHelm);
});

test('using a real station returns action ID without pretending command executed', () => {
  const start = dispatch(dispatch(startExploration(world), 'forward').state, 'forward').state;
  const result = dispatch(start, 'use');
  assert.equal(result.event.type, 'station');
  assert.equal(result.event.action, 'helm');
  assert.deepEqual(result.state, start);
});

test('transition is opt-in: declining keeps tile, next use prompts again, confirming changes area', () => {
  const start = startExploration(world);
  const east = dispatch(start, 'turn-right').state;
  const moved = dispatch(east, 'forward').state;
  const south = dispatch(moved, 'turn-right').state;
  const offered = dispatch(south, 'use');
  assert.equal(offered.event.type, 'transition-offered');
  assert.equal(offered.state.area, 'bridge');
  assert.deepEqual({ x: offered.state.x, y: offered.state.y }, { x: moved.x, y: moved.y });
  assert.throws(() => dispatch(offered.state, 'forward'), SpatialError);
  const declined = dispatch(offered.state, 'decline');
  assert.equal(declined.state.pending, null);
  assert.deepEqual({ x: declined.state.x, y: declined.state.y }, { x: moved.x, y: moved.y });
  const promptedAgain = dispatch(declined.state, 'use');
  assert.equal(promptedAgain.event.type, 'transition-offered');
  const confirmed = dispatch(promptedAgain.state, 'confirm');
  assert.equal(confirmed.event.type, 'area-entered');
  assert.equal(confirmed.state.area, 'surface');
  assert.equal(confirmed.state.heading, 'N');
  const returnSouth = dispatch(dispatch(confirmed.state, 'turn-right').state, 'turn-right').state;
  const home = dispatch(dispatch(returnSouth, 'use').state, 'confirm');
  assert.equal(home.state.area, 'bridge');
});

test('blocked boundaries and objects never permit clipping out of area', () => {
  const start = startExploration(world);
  const west = dispatch(start, 'turn-left').state;
  let state = west;
  for(let n=0;n<30;n++) state = dispatch(state,'forward').state;
  assert.equal(state.x,1);
  assert.equal(dispatch(state,'forward').event.type,'blocked');
});

test('invalid objects, overlapping collision, unsafe spawn and unknown transitions fail', () => {
  const copy = () => structuredClone(world);
  let bad = copy(); bad.scenes.bridge.objects[0].to = 'nonexistent'; bad.scenes.bridge.objects[0].type = 'transition';
  assert.throws(() => validateWorld(bad), SpatialError);
  bad = copy(); bad.scenes.bridge.objects[0].x = 4; bad.scenes.bridge.objects[0].y = 4;
  assert.throws(() => validateWorld(bad), SpatialError);
  bad = copy(); bad.scenes.bridge.spawn.x = 0;
  assert.throws(() => validateWorld(bad), SpatialError);
  assert.throws(() => dispatch(startExploration(world), 'confirm'), SpatialError);
});
