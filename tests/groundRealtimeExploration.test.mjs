import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REALTIME_WALK_TILES_PER_SECOND,
  startRealtimeExploration,
  orderRealtimeExplorationMove,
  orderRealtimeExplorationFormation,stopRealtimeExploration,
  advanceRealtimeExploration,
  serializeRealtimeExploration,
  deserializeRealtimeExploration,
} from '../src/groundRealtimeExploration.mjs';

const scene={
  width:8,height:6,
  walls:[{x:3,y:2},{x:3,y:3}],
  objects:[{x:5,y:1}],
};
const deploy=()=>startRealtimeExploration(scene,[
  {id:'venn',x:1,y:2},
  {id:'mira',x:1,y:4},
]);
const officer=(state,id)=>state.officers.find(unit=>unit.id===id);
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,
  'Expected '+actual+' to be near '+expected);

test('start is immutable, fractional destinations are legal and blocked cells have clearance',()=>{
  const initial=deploy();
  assert.equal(initial.version,1);
  assert.equal(REALTIME_WALK_TILES_PER_SECOND,2.5);
  assert.deepEqual(officer(initial,'venn'),{id:'venn',x:1,y:2,route:[]});
  const goal={x:5.22,y:2.12};
  const ordered=orderRealtimeExplorationMove(scene,initial,'venn',goal);
  assert.deepEqual(initial,deploy(),'original state cannot be mutated by planning');
  assert.ok(ordered.officers[0].route.length>=5,'route detours around a physical wall');
  assert.deepEqual(ordered.officers[0].route.at(-1),goal);
  for(const point of ordered.officers[0].route)
    assert.notDeepEqual(point,{x:3,y:2},'never route through blocked wall');
  assert.throws(()=>orderRealtimeExplorationMove(scene,initial,'venn',{x:3,y:2}),/blocked/);
  assert.throws(()=>orderRealtimeExplorationMove(scene,initial,'venn',{x:2.43,y:2}),/blocked/,
    'stop close to wall face, not just blocked cell center');
  assert.throws(()=>orderRealtimeExplorationMove(scene,initial,'venn',{x:5,y:1}),/blocked/,
    'mission stations are solid too');
  assert.throws(()=>orderRealtimeExplorationMove(scene,initial,'venn',{x:8,y:2}),/blocked/);
  assert.throws(()=>orderRealtimeExplorationMove(scene,initial,'venn',{x:1,y:4}),/occupied/);
});

test('motion is continuous over waypoints, not a series of tile-turn pauses',()=>{
  const initial=deploy();
  // A clear adjacent tile makes the first half-second deterministic,
  // independent of the BFS detour required by a distant wall.
  const ordered=orderRealtimeExplorationMove(scene,initial,'venn',{x:2.22,y:2.12});
  const first=advanceRealtimeExploration(scene,ordered,160);
  const moving=officer(first,'venn');
  approx(moving.x,1.4);
  approx(moving.y,2);
  assert.ok(moving.route.length>0);
  assert.equal(officer(ordered,'venn').x,1,'command does not teleport authority to target');
  const second=advanceRealtimeExploration(scene,first,240);
  approx(officer(second,'venn').x,2);
  approx(officer(second,'venn').y,2);
  assert.ok(officer(second,'venn').route.length>0);
  const finished=advanceRealtimeExploration(scene,second,30_000);
  approx(officer(finished,'venn').x,2.22);
  approx(officer(finished,'venn').y,2.12);
  assert.deepEqual(officer(finished,'venn').route,[]);
  assert.deepEqual(officer(ordered,'venn').route.at(-1),{x:2.22,y:2.12});
});

test('retarget during a real walk starts at current fractional position, not old destination',()=>{
  const go=orderRealtimeExplorationMove(scene,deploy(),'venn',{x:2.2,y:2.1});
  const mid=advanceRealtimeExploration(scene,go,160);
  const diverted=orderRealtimeExplorationMove(scene,mid,'venn',{x:2.15,y:1.15});
  approx(officer(diverted,'venn').x,1.4);
  approx(officer(diverted,'venn').y,2);
  assert.deepEqual(officer(diverted,'venn').route.at(-1),{x:2.15,y:1.15});
  const arrived=advanceRealtimeExploration(scene,diverted,8_000);
  approx(officer(arrived,'venn').x,2.15);
  approx(officer(arrived,'venn').y,1.15);
  assert.deepEqual(officer(arrived,'venn').route,[]);
  assert.deepEqual(officer(go,'venn').route.at(-1),{x:2.2,y:2.1});
});

test('multiple officers progress in parallel; paused combat freezes positions and routes',()=>{
  const first=orderRealtimeExplorationMove(scene,deploy(),'venn',{x:2.2,y:2});
  const both=orderRealtimeExplorationMove(scene,first,'mira',{x:1.2,y:3.1});
  const paused=advanceRealtimeExploration(scene,both,5000,{paused:true});
  assert.deepEqual(paused,both);
  assert.notStrictEqual(paused,both);
  const moving=advanceRealtimeExploration(scene,both,200);
  approx(officer(moving,'venn').x,1.5);
  approx(officer(moving,'mira').y,3.5);
  assert.notEqual(officer(moving,'venn').x,officer(both,'venn').x);
  assert.notEqual(officer(moving,'mira').y,officer(both,'mira').y);
  assert.deepEqual(officer(both,'venn'),officer(first,'venn'),
    'ordering Mira cannot overwrite Venn’s existing route');
});

test('fractional mid-walk state and outstanding route survive a deterministic JSON roundtrip',()=>{
  const ordered=orderRealtimeExplorationMove(scene,deploy(),'venn',{x:5.22,y:2.12});
  const midway=advanceRealtimeExploration(scene,ordered,237);
  const before=JSON.stringify(midway);
  const restored=deserializeRealtimeExploration(scene,serializeRealtimeExploration(scene,midway));
  assert.deepEqual(restored,midway);
  assert.deepEqual(advanceRealtimeExploration(scene,restored,1200),
    advanceRealtimeExploration(scene,midway,1200));
  assert.equal(JSON.stringify(midway),before,'serialization and update must be pure');
  assert.throws(()=>deserializeRealtimeExploration(scene,'{'),SyntaxError);
  assert.throws(()=>deserializeRealtimeExploration(scene,JSON.stringify({
    ...midway,version:99,
  })),/Invalid/);
  assert.throws(()=>deserializeRealtimeExploration(scene,JSON.stringify({
    ...midway,officers:midway.officers.map(o=>o.id==='venn'
      ? {...o,route:[{x:3,y:2}]}:o),
  })),/Unsafe/);
  assert.throws(()=>advanceRealtimeExploration(scene,midway,Number.NaN),/Invalid/);
});

test('invalid scene and overlapping start points fail closed',()=>{
  assert.throws(()=>startRealtimeExploration({...scene,width:0},[{id:'venn',x:1,y:2}]),/Invalid/);
  assert.throws(()=>startRealtimeExploration(scene,[
    {id:'venn',x:1,y:2},{id:'mira',x:1.1,y:2},
  ]),/Overlapping/);
  assert.throws(()=>startRealtimeExploration(scene,[
    {id:'venn',x:1,y:2},{id:'venn',x:2,y:2},
  ]),/Invalid/);
});

test('continuous group order commits distinct simultaneous routes, and never overlaps',()=>{
  const origin=deploy();
  const formation=orderRealtimeExplorationFormation(scene,origin,
    ['venn','mira'],{x:5,y:4});
  assert.deepEqual(origin,deploy(),'group planning must not mutate the original state');
  assert.ok(officer(formation,'venn').route.length);
  assert.ok(officer(formation,'mira').route.length);
  const goals=formation.officers.map(o=>o.route.at(-1)??{x:o.x,y:o.y});
  assert.deepEqual(goals[0],{x:5,y:4});
  assert.notDeepEqual(goals[0],goals[1]);
  let live=formation;
  for(let i=0;i<160;i++){
    live=advanceRealtimeExploration(scene,live,80);
    const [a,b]=live.officers;
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=.32-1e-7,
      'no officers intersect while moving');
    if(live.officers.every(o=>!o.route.length))break;
  }
  assert.ok(live.officers.every(o=>!o.route.length));
  assert.deepEqual(live.officers.map(o=>({x:o.x,y:o.y})),goals);
});

test('independent retarget reserves moving colleague future route and formation failures stay atomic',()=>{
  const original=deploy();
  const venn=orderRealtimeExplorationMove(scene,original,'venn',{x:2,y:2});
  assert.throws(()=>orderRealtimeExplorationMove(scene,venn,'mira',{x:2,y:2}),
    /occupied/,'the future target is reserved even when Venn has not arrived');
  const active=advanceRealtimeExploration(scene,venn,120);
  const reformed=orderRealtimeExplorationFormation(scene,active,
    ['venn','mira'],{x:5,y:4});
  assert.ok(reformed.officers.every(o=>o.route.length));
  approx(officer(reformed,'venn').x,officer(active,'venn').x);
  approx(officer(reformed,'venn').y,officer(active,'venn').y);
  assert.deepEqual(officer(active,'venn').route,officer(venn,'venn').route,
    'retarget never mutates the previously accepted route');
  assert.throws(()=>orderRealtimeExplorationFormation(scene,active,
    ['venn','mira'],{x:3,y:2}),/blocked/);
  assert.throws(()=>orderRealtimeExplorationFormation(scene,active,
    ['venn','venn'],{x:5,y:4}),/Invalid/);
  assert.throws(()=>orderRealtimeExplorationFormation(scene,active,
    ['venn','unknown'],{x:5,y:4}),/Invalid/);
  assert.deepEqual(active,advanceRealtimeExploration(scene,venn,120));
});


const openField={width:10,height:9,walls:[],objects:[]};
const destinationOf=o=>o.route.at(-1)??{x:o.x,y:o.y};
for(const [label,leaderX,targetX,rearX] of [['east',2,7,6],['west',7,2,3]]){
 test('formation prefers nearest rear flank when moving '+label,()=>{
  const original=startRealtimeExploration(openField,[
   {id:'leader',x:leaderX,y:4},{id:'north',x:leaderX,y:3},{id:'south',x:leaderX,y:5},
  ]);
  // Deliberately reverse the follower order: physical proximity, not order,
  // decides which wing is preferred in this open, unambiguous fixture.
  const ordered=orderRealtimeExplorationFormation(openField,original,
   ['leader','south','north'],{x:targetX,y:4});
  assert.deepEqual(destinationOf(officer(ordered,'leader')),{x:targetX,y:4});
  assert.deepEqual(destinationOf(officer(ordered,'north')),{x:rearX,y:3});
  assert.deepEqual(destinationOf(officer(ordered,'south')),{x:rearX,y:5});
  assert.ok(original.officers.every(o=>o.route.length===0));
  let live=ordered;
  for(let i=0;i<100&&live.officers.some(o=>o.route.length);i++){
   live=advanceRealtimeExploration(openField,live,80);
   for(let a=0;a<live.officers.length;a++)for(let b=a+1;b<live.officers.length;b++)
    assert.ok(Math.hypot(live.officers[a].x-live.officers[b].x,
     live.officers[a].y-live.officers[b].y)>=.32-1e-7);
  }
  assert.ok(live.officers.every(o=>!o.route.length));
  assert.deepEqual(live.officers.map(o=>({x:o.x,y:o.y})),ordered.officers.map(destinationOf));
 });
}
test('blocked preferred flank still produces legal distinct endpoints',()=>{
 const field={...openField,walls:[{x:6,y:3}]};
 const original=startRealtimeExploration(field,[
  {id:'leader',x:2,y:4},{id:'north',x:2,y:3},{id:'south',x:2,y:5},
 ]);
 const ordered=orderRealtimeExplorationFormation(field,original,
  ['leader','north','south'],{x:7,y:4});
 const targets=ordered.officers.map(destinationOf);
 assert.deepEqual(targets[0],{x:7,y:4});
 assert.equal(new Set(targets.map(o=>o.x+','+o.y)).size,3);
 assert.ok(ordered.officers.every(o=>o.route.every(p=>p.x!==6||p.y!==3)));
 assert.deepEqual(deserializeRealtimeExploration(field,serializeRealtimeExploration(field,ordered)),ordered);
});


test('fractional retarget within one cell cannot cut the clearance envelope of a solid corner',()=>{
 const field={width:6,height:6,walls:[{x:3,y:3}],objects:[]};
 const from={x:2.35,y:2.44},goal={x:2.44,y:2.35};
 const initial=startRealtimeExploration(field,[{id:'venn',...from}]);
 // Each endpoint is legal; the straight midpoint is only ~.1485 from
 // the wall corner (2.5,2.5), below the existing .16 body clearance.
 assert.ok(Math.hypot(2.5-from.x,2.5-from.y)>.16);
 assert.ok(Math.hypot(2.5-goal.x,2.5-goal.y)>.16);
 const ordered=orderRealtimeExplorationMove(field,initial,'venn',goal);
 assert.deepEqual(ordered.officers[0].route,[{x:2,y:2},goal]);
 let live=ordered;
 for(let i=0;i<100&&live.officers[0].route.length;i++){
  live=advanceRealtimeExploration(field,live,10);
  assert.ok(Math.hypot(2.5-live.officers[0].x,2.5-live.officers[0].y)>=.16);
 }
 assert.deepEqual(live.officers[0],{id:'venn',...goal,route:[]});
 assert.deepEqual(initial.officers[0],{id:'venn',...from,route:[]});
 const unsafe={version:1,officers:[{id:'venn',...from,route:[goal]}]};
 assert.throws(()=>deserializeRealtimeExploration(field,JSON.stringify(unsafe)),/Unsafe exploration segment/);
 assert.throws(()=>serializeRealtimeExploration(field,unsafe),/Unsafe exploration segment/);
 assert.throws(()=>advanceRealtimeExploration(field,unsafe,100),/Unsafe exploration segment/);
 const clear={x:2.1,y:2.2};
 assert.deepEqual(orderRealtimeExplorationMove(field,initial,'venn',clear).officers[0].route,[clear]);
});


test('future fractional waypoints reserve both sides of their cell boundary',()=>{
 const field={width:8,height:6,walls:[],objects:[]};
 const left={x:2.49,y:2},right={x:2.51,y:2};
 const original=startRealtimeExploration(field,[
  {id:'left',x:1,y:2},{id:'right',x:4,y:2},
 ]);
 assert.notEqual(Math.round(left.x),Math.round(right.x));
 assert.ok(Math.hypot(left.x-right.x,left.y-right.y)<.32);
 for(const [first,second,goal,conflict,safe] of [
  ['left','right',left,right,{x:4,y:4}],
  ['right','left',right,left,{x:1,y:4}],
 ]){
  const planned=orderRealtimeExplorationMove(field,original,first,goal);
  const snapshot=JSON.stringify(planned);
  assert.throws(()=>orderRealtimeExplorationMove(field,planned,second,conflict),/Destination occupied/);
  assert.equal(JSON.stringify(planned),snapshot,'rejected order leaves planned route unchanged');
  const parallel=orderRealtimeExplorationMove(field,planned,second,safe);
  let live=parallel;
  for(let i=0;i<200&&live.officers.some(o=>o.route.length);i++){
   live=advanceRealtimeExploration(field,live,20);
   const [a,b]=live.officers;
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=.32-1e-7);
  }
  assert.ok(live.officers.every(o=>!o.route.length));
  assert.deepEqual(destinationOf(officer(live,first)),goal);
  assert.deepEqual(destinationOf(officer(live,second)),safe);
 }
});


test('stop at current position cancels only the selected route even inside a conservative reservation',()=>{
 const field={width:8,height:6,walls:[],objects:[]};
 const initial=startRealtimeExploration(field,[
  {id:'left',x:2.1,y:2},{id:'right',x:2.8,y:2},
 ]);
 const moving=orderRealtimeExplorationMove(field,initial,'left',{x:1,y:2});
 const parallel=orderRealtimeExplorationMove(field,moving,'right',{x:4,y:2});
 const snapshot=JSON.stringify(parallel);
 assert.ok(parallel.officers.every(o=>o.route.length));
 // The right officer reserves cells 2 and 3, including left's rounded
 // cell, despite .7 tiles of actual separation. A stop has no swept path.
 const stopped=orderRealtimeExplorationMove(field,parallel,'left',{x:2.1,y:2});
 assert.deepEqual(officer(stopped,'left'),{id:'left',x:2.1,y:2,route:[]});
 assert.deepEqual(officer(stopped,'right'),officer(parallel,'right'));
 assert.equal(JSON.stringify(parallel),snapshot);
 const later=advanceRealtimeExploration(field,stopped,800);
 assert.deepEqual(officer(later,'left'),officer(stopped,'left'));
 assert.deepEqual(officer(later,'right'),{id:'right',x:4,y:2,route:[]});
 assert.throws(()=>orderRealtimeExplorationMove(field,stopped,'left',{x:2.2,y:2}),/Destination occupied/);
 assert.deepEqual(orderRealtimeExplorationMove(field,stopped,'left',{x:2.1,y:2}),stopped);
});


test('atomic stop validates the entire selection, preserves poses and leaves other routes alone',()=>{
 const field={width:8,height:6,walls:[],objects:[]};
 const initial=startRealtimeExploration(field,[
  {id:'a',x:1,y:1},{id:'b',x:1,y:3},{id:'c',x:1,y:5},
 ]);
 let planned=initial;
 for(const [id,y] of [['a',1],['b',3],['c',5]])
  planned=orderRealtimeExplorationMove(field,planned,id,{x:6,y});
 const moving=advanceRealtimeExploration(field,planned,140);
 const before=JSON.stringify(moving);
 for(const invalid of [null,[],['a','a'],['a','unknown'],['a',42]])
  assert.throws(()=>stopRealtimeExploration(field,moving,invalid),/Invalid exploration stop selection/);
 assert.equal(JSON.stringify(moving),before);
 const stopped=stopRealtimeExploration(field,moving,['a','b']);
 for(const id of ['a','b'])
  assert.deepEqual(officer(stopped,id),{...officer(moving,id),route:[]});
 assert.deepEqual(officer(stopped,'c'),officer(moving,'c'));
 assert.deepEqual(stopRealtimeExploration(field,stopped,['a','b']),stopped);
 const later=advanceRealtimeExploration(field,stopped,400);
 for(const id of ['a','b'])assert.deepEqual(officer(later,id),officer(stopped,id));
 assert.ok(officer(later,'c').x>officer(stopped,'c').x);
 const all=stopRealtimeExploration(field,later,['a','b','c']);
 assert.deepEqual(advanceRealtimeExploration(field,all,500),all);
 assert.equal(JSON.stringify(moving),before);
});


test('formation cannot round an out-of-bounds point into a valid edge cell',()=>{
 const field={width:8,height:8,walls:[],objects:[]};
 const initial=startRealtimeExploration(field,[
  {id:'a',x:3,y:3},{id:'b',x:3,y:5},
 ]);
 const before=JSON.stringify(initial);
 for(const destination of [{x:-.1,y:3},{x:7.1,y:3},{x:3,y:-.1},{x:3,y:7.1}]){
  assert.throws(()=>orderRealtimeExplorationFormation(field,initial,['a','b'],destination),
    /Formation destination outside map/);
  assert.throws(()=>orderRealtimeExplorationMove(field,initial,'a',destination),
    /outside map/);
 }
 // Exactly on the legal boundary is still a valid order.
 const edge=orderRealtimeExplorationFormation(field,initial,['a','b'],{x:7,y:3});
 assert.deepEqual(destinationOf(officer(edge,'a')),{x:7,y:3});
 // Valid fractional formation anchors continue to round by design.
 const inside=orderRealtimeExplorationFormation(field,initial,['a','b'],{x:6.8,y:3.1});
 assert.deepEqual(inside,edge);
 assert.equal(JSON.stringify(initial),before);
});
