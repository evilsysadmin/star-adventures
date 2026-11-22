import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWorld} from '../src/spatial.mjs';
import {composeGroundExpansion} from '../src/groundWideLayout.mjs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {startGroundSquadPositions} from '../src/groundSquadPositions.mjs';
import {groundVisionCells} from '../src/groundFogOfWar.mjs';
import {
  startGroundRealtimeWorld,orderGroundRealtimeWorld,advanceGroundRealtimeWorld,
  serializeGroundRealtimeWorld,restoreGroundRealtimeWorld,groundRealtimeVision,
} from '../src/groundRealtimeWorld.mjs';
import {startRealtimeExploration,orderRealtimeExplorationMove} from '../src/groundRealtimeExploration.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const base=read('../content/scenes/meridian.json');
const plan=read('../content/scenes/k47-wide-plan.json');
const proposed=composeGroundExpansion(base,plan);
const scene=proposed.scenes.surface;
const pos=point=>point.x+','+point.y;
const blockedOf=s=>new Set([...s.walls,...s.objects].map(pos));
const ways=[[0,-1],[1,0],[0,1],[-1,0]];
const crew=startAwayTeam();
const legacy=()=>startGroundSquadPositions(proposed,
  {version:1,area:'surface',...scene.spawn,pending:null},crew);
const motion=()=>startRealtimeExploration(scene,[
  {id:'venn',x:4,y:5},{id:'dorn',x:4,y:4},{id:'mira',x:5,y:5},
]);

function reachable(s,start){
 const blocked=blockedOf(s);
 const walked=new Set([pos(start)]),queue=[start];
 for(let i=0;i<queue.length;i++){
  const p=queue[i];
  for(const [dx,dy] of ways){
   const x=p.x+dx,y=p.y+dy,k=x+','+y;
   if(x<0||y<0||x>=s.width||y>=s.height||
      blocked.has(k)||walked.has(k))continue;
   walked.add(k);queue.push({x,y});
  }
 }
 return walked;
}

test('the 32x20 candidate is a new legal world; the shipped 18x12 mission is untouched',()=>{
 assert.equal(validateWorld(proposed),true);
 assert.equal(base.scenes.surface.width,18);
 assert.equal(base.scenes.surface.height,12);
 assert.deepEqual(base.scenes.surface.spawn,{x:4,y:5,heading:'N'});
 assert.deepEqual(base.scenes.surface.objects.map(o=>o.id),
  ['probe','sensor-vault','relief-point','perimeter-uplink','beam-out']);
 assert.equal(scene.width*scene.height,640);
 assert.equal(scene.width,32);
 assert.equal(scene.height,20);
 assert.equal(plan.status,'candidate-not-active');
 assert.deepEqual(proposed.scenes.bridge,base.scenes.bridge);
 assert.deepEqual(proposed.scenes.surface.objects,base.scenes.surface.objects,
  'planned waypoints MUST NOT register phantom live mission stations');
 assert.notStrictEqual(scene.walls,base.scenes.surface.walls);
 assert.equal(base.scenes.surface.walls.some(p=>p.x===17&&p.y===4),true);
 assert.equal(scene.walls.some(p=>p.x===17&&p.y===4),false);
});

test('all 413 free cells belong to one actual connected ground mission; no fake isolated islands',()=>{
 const blocked=blockedOf(scene);
 const walked=reachable(scene,scene.spawn);
 assert.equal(scene.width*scene.height-blocked.size,413);
 assert.equal(walked.size,413);
 assert.equal(scene.walls.length,222);
 assert.equal(scene.objects.length,5);
 for(const [x,y] of plan.openings){
  assert.equal(blocked.has(x+','+y),false,'a declared gateway is navigable');
  assert.equal(walked.has(x+','+y),true);
 }
 for(const zone of plan.sectors)
  assert.equal(walked.has(zone.entry.join(',')),true,
   zone.id+' must have a physically reachable entrance');
 for(const target of plan.proposedObjectives)
  assert.equal(walked.has(target.at.join(',')),true,
   target.id+' must not be stranded behind cosmetic architecture');
});

test('real existing PBR geometry footprints remain physically blocked, with no cloned assets',()=>{
 const manifest=read('../content/scenes/k47-environment-art.json');
 assert.deepEqual(plan.retainedAuthoredFootprints,manifest.slots.map(slot=>slot.id));
 const walls=new Set(scene.walls.map(pos));
 const original=new Set(base.scenes.surface.walls.map(pos));
 for(const slot of manifest.slots){
  for(const [x,y] of slot.footprint){
   assert.equal(original.has(x+','+y),true,'source manifest is authoritative');
   assert.equal(walls.has(x+','+y),true,
    slot.id+' cannot become a walkable fake door when expanding');
  }
 }
});

test('long routes really navigate new sectors, in continuous mode, with no teleport',()=>{
 const initial=startGroundRealtimeWorld(proposed,crew,legacy());
 const vision=groundRealtimeVision(proposed,initial);
 assert.equal(vision.visible.has('27,13'),false);
 assert.equal(vision.explored.has('27,13'),false);
 assert.equal(groundVisionCells(scene,[scene.spawn]).has('26,4'),false);
 for(const objective of plan.proposedObjectives){
  const [x,y]=objective.at;
  const prepared=orderGroundRealtimeWorld(proposed,initial,'venn',{x,y});
  const path=prepared.motion.officers[0].route;
  assert.ok(path.length>=18,
   objective.id+' must be a meaningful route, not an objective immediately beside spawn');
  assert.deepEqual(path.at(-1),{x,y});
  assert.equal(prepared.motion.officers[0].x,4,
   'accepted distant order never teleports to the mission endpoint');
  assert.equal(groundRealtimeVision(proposed,prepared).explored.has(x+','+y),false);
  const stepping=advanceGroundRealtimeWorld(proposed,prepared,80);
  assert.notEqual(stepping.motion.officers[0].x+stepping.motion.officers[0].y,
   prepared.motion.officers[0].x+prepared.motion.officers[0].y);
  assert.equal(groundRealtimeVision(proposed,stepping).explored.has(x+','+y),false);
 }
});

test('both north and south approaches reach the far laboratory even if opposite gates are sealed',()=>{
 const entrances=[
  {kind:'north',closed:[[10,11],[13,11],[15,11]]},
  {kind:'south',closed:[[17,4],[17,8],[17,10]]},
 ];
 for(const access of entrances){
  const withDoors={...scene,walls:[
   ...scene.walls,...access.closed.map(([x,y])=>({x,y})),
  ]};
  const map={...proposed,scenes:{...proposed.scenes,surface:withDoors}};
  assert.equal(validateWorld(map),true);
  const remaining=reachable(withDoors,scene.spawn);
  for(const target of ['lab-evidence','relay-power','ridge-uplink']){
   const goal=plan.proposedObjectives.find(o=>o.id===target).at;
   assert.equal(remaining.has(goal.join(',')),true,
    access.kind+' approach must reach '+target);
   const routed=orderRealtimeExplorationMove(withDoors,
    startRealtimeExploration(withDoors,motion().officers.map(o=>({
     id:o.id,x:o.x,y:o.y,
    }))), 'venn',{x:goal[0],y:goal[1]});
   assert.deepEqual(routed.officers[0].route.at(-1),
    {x:goal[0],y:goal[1]});
  }
 }
});

test('the prototype uses canonical, restorable continuous save contracts without touching current saves',()=>{
 const oldWorld=JSON.stringify(base),start=legacy();
 let candidate=startGroundRealtimeWorld(proposed,crew,start);
 candidate=orderGroundRealtimeWorld(proposed,candidate,'venn',{x:27,y:13});
 for(let i=0;i<5;i++)candidate=advanceGroundRealtimeWorld(proposed,candidate,350);
 assert.ok(candidate.motion.officers[0].route.length);
 const raw=serializeGroundRealtimeWorld(proposed,crew,start,candidate);
 assert.deepEqual(restoreGroundRealtimeWorld(proposed,crew,start,raw),
  {state:candidate,source:'realtime'});
 assert.equal(JSON.stringify(base),oldWorld);
 assert.equal(start.commands.length,0);
});

test('bad doorway, overlapping real station or invalid objectives fail closed',()=>{
 const mutate=fn=>{
  const clone=structuredClone(plan);fn(clone);
  return ()=>composeGroundExpansion(base,clone);
 };
 assert.throws(mutate(p=>p.openings.push([4,5])),/opening/);
 assert.throws(mutate(p=>p.wallRuns.push([[6,4],[6,4]])),/mission object/);
 assert.throws(mutate(p=>p.wallRuns.push([[3,4],[4,5]])),/non-axial/);
 assert.throws(mutate(p=>p.proposedObjectives.push({
  ...p.proposedObjectives[0],id:'copy',at:[27,13],
 })),/objective/);
 assert.throws(mutate(p=>p.proposedObjectives[0].at=[99,99]),/objective/);
 assert.throws(mutate(p=>p.status='published'),/status/);
});
