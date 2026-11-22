import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REALTIME_WALK_TILES_PER_SECOND,
  startRealtimeExploration,
  orderRealtimeExplorationMove,
  orderRealtimeExplorationFormation,
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
