import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWorld} from '../src/spatial.mjs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {planGroundSquadRoute} from '../src/groundSquadRoute.mjs';
import {
  startGroundSquadPositions,orderGroundOfficerMove,replayGroundSquadPositions,
  serializeGroundSquadPositions,deserializeGroundSquadPositions,
} from '../src/groundSquadPositions.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const spawn={version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
const point=(p)=>p.x+','+p.y;
// Reconstruct the pre-expansion domain, so the compatibility assertion is
// based on historical 9×8 blocking cells rather than a new fabricated save.
const oldWorld=structuredClone(world);
oldWorld.scenes.surface.width=9;
oldWorld.scenes.surface.height=8;
oldWorld.scenes.surface.walls=[
  ...oldWorld.scenes.surface.walls.filter(p=>p.x<9&&p.y<8),
  {x:8,y:4},
  {x:8,y:6},
];
delete oldWorld.scenes.surface.scenery;

test('13×10 eastern sector has two real safe service passages through the old perimeter',()=>{
  assert.equal(validateWorld(world),true);
  assert.equal(validateWorld(oldWorld),true);
  const scene=world.scenes.surface;
  assert.equal(scene.width,13);assert.equal(scene.height,10);
  const walls=new Set(scene.walls.map(point));
  assert.equal(walls.has('8,4'),false);
  assert.equal(walls.has('8,6'),false);
  for(const p of ['8,3','8,5','8,7','12,4','10,2','10,6','4,8','0,8','11,9'])
    assert.ok(walls.has(p),'collision wall '+p);
  assert.equal(scene.objects.length,oldWorld.scenes.surface.objects.length);
  assert.deepEqual(scene.objects,oldWorld.scenes.surface.objects);
});

test('legacy v1 command history, officer positions and headings survive expansion',()=>{
  let legacy=startGroundSquadPositions(oldWorld,spawn,away);
  legacy=orderGroundOfficerMove(oldWorld,away,legacy,'venn',{x:3,y:5}).snapshot;
  legacy=orderGroundOfficerMove(oldWorld,away,legacy,'dorn',{x:4,y:5}).snapshot;
  const saved=serializeGroundSquadPositions(oldWorld,away,legacy);
  assert.deepEqual(deserializeGroundSquadPositions(world,away,saved),legacy);
  assert.deepEqual(replayGroundSquadPositions(world,away,legacy),
    replayGroundSquadPositions(oldWorld,away,legacy));
});

test('east passage permits real multi-tile travel with walls and occupancy enforced',()=>{
  const initial=startGroundSquadPositions(world,spawn,away);
  const result=orderGroundOfficerMove(world,away,initial,'venn',{x:9,y:4});
  assert.ok(result.route.length>5,'not a decorative teleport');
  let previous={x:4,y:5};
  for(const step of result.route){
    assert.equal(Math.abs(step.x-previous.x)+Math.abs(step.y-previous.y),1);
    previous=step;
  }
  const officers=replayGroundSquadPositions(world,away,result.snapshot).officers;
  assert.deepEqual({x:officers[0].x,y:officers[0].y},{x:9,y:4});
  assert.deepEqual({x:officers[1].x,y:officers[1].y},{x:4,y:4});
  assert.deepEqual({x:officers[2].x,y:officers[2].y},{x:5,y:5});
  assert.throws(()=>orderGroundOfficerMove(world,away,result.snapshot,'venn',{x:10,y:6}),/blocked/);
  assert.deepEqual(deserializeGroundSquadPositions(world,away,
    serializeGroundSquadPositions(world,away,result.snapshot)),result.snapshot);
});

test('southern gate is a shorter real route, respects neighboring walls and saves replay',()=>{
  const southern={version:1,area:'surface',x:7,y:6,heading:'E',pending:null};
  const instructions=planGroundSquadRoute(world,southern,{x:9,y:6});
  assert.deepEqual(instructions,['forward','forward']);
  const oldPerimeter=structuredClone(world);
  oldPerimeter.scenes.surface.walls.push({x:8,y:6});
  const oldInstructions=planGroundSquadRoute(oldPerimeter,southern,{x:9,y:6});
  assert.ok(oldInstructions?.length>instructions.length,
    'service gate must offer a genuine shortcut, not a decorative stripe');
  assert.equal(planGroundSquadRoute(world,southern,{x:8,y:5}),null);
  assert.equal(planGroundSquadRoute(world,southern,{x:8,y:7}),null);
  assert.equal(planGroundSquadRoute(world,southern,{x:10,y:6}),null);
  const initial=startGroundSquadPositions(world,spawn,away);
  const first=orderGroundOfficerMove(world,away,initial,'mira',{x:7,y:6});
  assert.ok(first.route.length>0,'existing walkable corridor leads to new service gate');
  const second=orderGroundOfficerMove(world,away,first.snapshot,'mira',{x:9,y:6});
  assert.deepEqual(second.route,[{x:8,y:6},{x:9,y:6}]);
  const saved=serializeGroundSquadPositions(world,away,second.snapshot);
  const restored=deserializeGroundSquadPositions(world,away,saved);
  assert.deepEqual(restored,second.snapshot);
  assert.deepEqual(
    replayGroundSquadPositions(world,away,restored).officers.find(u=>u.id==='mira'),
    {id:'mira',x:9,y:6,heading:'E'});
  assert.equal(world.scenes.surface.objects.length,5,'no fabricated service actions');
});
