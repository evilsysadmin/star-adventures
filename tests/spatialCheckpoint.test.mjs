import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyExploration, startExploration } from '../src/spatial.mjs';
import { SpatialCheckpointError, serializeSpatialCheckpoint, deserializeSpatialCheckpoint, recoverSpatialCheckpoint } from '../src/spatialCheckpoint.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const step = (state, type) => applyExploration(world, state, { type }).state;

test('heading/position survive a verified snapshot without mutating spatial state', () => {
  const initial = startExploration(world);
  const moved = step(step(initial,'turn-left'),'forward');
  const raw = serializeSpatialCheckpoint(world,moved);
  assert.deepEqual(deserializeSpatialCheckpoint(world,raw),moved);
  assert.equal(initial.heading,'N');
  assert.equal(moved.heading,'W');
});

test('surface spawn is restored, not mistaken for a bridge position', () => {
  const surface = {version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
  assert.deepEqual(deserializeSpatialCheckpoint(world,serializeSpatialCheckpoint(world,surface)),surface);
});

test('teleporter prompt is intentionally discarded on restore while player remains on same square', () => {
  const waiting = step({version:1,area:'bridge',x:4,y:5,heading:'S',pending:null},'use');
  assert.deepEqual(waiting.pending,{id:'transporter',to:'surface'});
  const restored = deserializeSpatialCheckpoint(world,serializeSpatialCheckpoint(world,waiting));
  assert.equal(restored.pending,null);
  assert.deepEqual({area:restored.area,x:restored.x,y:restored.y,heading:restored.heading},
    {area:waiting.area,x:waiting.x,y:waiting.y,heading:waiting.heading});
  assert.equal(step(restored,'use').pending.to,'surface');
});

test('future format, unknown world, wall, station, malformed and extra keys are rejected', () => {
  const raw=JSON.parse(serializeSpatialCheckpoint(world,startExploration(world)));
  for(const change of [
    { saveVersion: 99 }, { worldVersion: 99 }, { area:'unknown' },
    { x: 0 }, {x:3,y:2}, {heading:'NE'}, { x:3.14 },
    {unexpected:true},
  ]){
    assert.throws(()=>deserializeSpatialCheckpoint(world,JSON.stringify({...raw,...change})),SpatialCheckpointError);
  }
  assert.throws(()=>deserializeSpatialCheckpoint(world,'{bad'),SpatialCheckpointError);
  assert.throws(()=>deserializeSpatialCheckpoint(world,'X'.repeat(1025)),SpatialCheckpointError);
});

test('invalid saved position recovers at safe world spawn; does not alter crew checkpoint', () => {
  const recovered=recoverSpatialCheckpoint(world,'{"bad":"data"}');
  assert.deepEqual(recovered.state,startExploration(world));
  assert.equal(recovered.notice,'reset-invalid');
  assert.equal(recoverSpatialCheckpoint(world,null).notice,'fresh');
  assert.equal(recoverSpatialCheckpoint(world,serializeSpatialCheckpoint(world,startExploration(world))).notice,'restored');
});
