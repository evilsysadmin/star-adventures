import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planGroundSquadRoute } from '../src/groundSquadRoute.mjs';
import { applyExploration } from '../src/spatial.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url), 'utf8'));
const start = {version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
const replay = commands => {
  let state = start;
  for (const type of commands) {
    const result = applyExploration(world,state,{type});
    assert.notEqual(result.event.type,'blocked');
    state=result.state;
  }
  return state;
};

test('one-step ground order uses real spatial commands',() => {
  const commands=planGroundSquadRoute(world,start,{x:4,y:4});
  assert.deepEqual(commands,['forward']);
  assert.deepEqual([replay(commands).x,replay(commands).y],[4,4]);
});

test('pathfinding safely routes around walls and station footprints',() => {
  const commands=planGroundSquadRoute(world,start,{x:2,y:3});
  assert.ok(commands.length>3);
  const final=replay(commands);
  assert.deepEqual([final.x,final.y],[2,3]);
  assert.equal(planGroundSquadRoute(world,start,{x:3,y:2}),null); // wall
  assert.equal(planGroundSquadRoute(world,start,{x:6,y:4}),null); // medical station
  assert.equal(planGroundSquadRoute(world,start,{x:4,y:6}),null); // transporter
});

test('unreachable, invalid and no-op destinations cannot move the squad',() => {
  assert.deepEqual(planGroundSquadRoute(world,start,{x:4,y:5}),[]);
  assert.equal(planGroundSquadRoute(world,start,{x:0,y:0}),null);
  assert.throws(()=>planGroundSquadRoute(world,start,{x:9,y:4}));
  assert.throws(()=>planGroundSquadRoute(world,{...start,area:'bridge'},{x:4,y:4}));
  assert.throws(()=>planGroundSquadRoute(world,{...start,pending:{id:'beam-out',to:'bridge'}},{x:4,y:4}));
});
