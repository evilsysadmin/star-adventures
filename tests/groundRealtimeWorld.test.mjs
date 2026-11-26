import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {startGroundSquadPositions} from '../src/groundSquadPositions.mjs';
import {
  startGroundRealtimeWorld,restoreGroundRealtimeWorld,
  serializeGroundRealtimeWorld,orderGroundRealtimeWorld,appendGroundRealtimeWorld,
  advanceGroundRealtimeWorld,groundRealtimeVision,groundRealtimeStationUse,
  orderGroundRealtimeFormation,groundRealtimeStationApproach,stopGroundRealtimeWorld,
} from '../src/groundRealtimeWorld.mjs';
import {serializeGroundRealtimeSave} from '../src/groundRealtimeSave.mjs';
const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const legacy=()=>startGroundSquadPositions(world,{
  version:1,area:'surface',x:4,y:5,heading:'N',pending:null,
},away);
const deploy=()=>startGroundRealtimeWorld(world,away,legacy());
const officer=(state,id='venn')=>state.motion.officers.find(o=>o.id===id);
const finish=(state)=>{
  for(let i=0;i<20;i++){
    state=advanceGroundRealtimeWorld(world,state,500);
    if(state.motion.officers.every(o=>o.route.length===0))return state;
  }
  throw new Error('Movement was not completed');
};

test('orders cannot reveal an undiscovered mission sector before anyone gets there',()=>{
  const fresh=deploy();
  const first=groundRealtimeVision(world,fresh);
  assert.equal(first.visible.has('10,4'),false);
  assert.equal(first.explored.has('10,4'),false);
  const planned=orderGroundRealtimeWorld(world,fresh,'venn',{x:9,y:4});
  assert.equal(officer(planned).x,4,'accepting an order does not teleport');
  assert.equal(groundRealtimeVision(world,planned).explored.has('10,4'),false);
  const early=advanceGroundRealtimeWorld(world,planned,80);
  assert.equal(groundRealtimeVision(world,early).visible.has('10,4'),false);
  assert.equal(groundRealtimeVision(world,early).explored.has('10,4'),false);
  assert.deepEqual(officer(fresh).route,[],'prior state remains immutable');
  const arrived=finish(planned);
  assert.equal(officer(arrived).x,9);
  assert.equal(officer(arrived).y,4);
  assert.equal(groundRealtimeVision(world,arrived).visible.has('10,4'),true);
  const returned=finish(orderGroundRealtimeWorld(world,arrived,'venn',{x:4,y:5}));
  const vision=groundRealtimeVision(world,returned);
  assert.equal(vision.visible.has('10,4'),false);
  assert.equal(vision.explored.has('10,4'),true,'real visited terrain remains remembered');
});

test('station actions are forbidden while moving even when destination is adjacent',()=>{
  const fresh=deploy();
  const planned=orderGroundRealtimeWorld(world,fresh,'venn',{x:4,y:3});
  assert.throws(()=>groundRealtimeStationUse(world,planned,'venn','probe'),/must stop/);
  const moving=advanceGroundRealtimeWorld(world,planned,100);
  assert.throws(()=>groundRealtimeStationUse(world,moving,'venn','probe'),/must stop/);
  const reached=finish(planned);
  assert.deepEqual([officer(reached).x,officer(reached).y],[4,3]);
  const actual=groundRealtimeStationUse(world,reached,'venn','probe');
  assert.equal(actual.event.stationId,'probe');
  assert.equal(actual.pose.x,4);
  assert.equal(actual.pose.y,3);
  assert.throws(()=>groundRealtimeStationUse(world,reached,'mira','probe'),/not adjacent/);
  assert.throws(()=>groundRealtimeStationUse(world,reached,'venn','missing'),/Unknown/);
});

test('nearby but not actually at a station-compatible position is rejected',()=>{
  let state=finish(orderGroundRealtimeWorld(world,deploy(),'venn',{x:4.34,y:3.2}));
  assert.equal(officer(state).route.length,0);
  assert.throws(()=>groundRealtimeStationUse(world,state,'venn','probe'),/not reached/);
});

test('paused world neither moves officers nor discovers terrain; invalid delta fails closed',()=>{
  const planned=orderGroundRealtimeWorld(world,deploy(),'venn',{x:9,y:4});
  const copy=JSON.stringify(planned);
  const paused=advanceGroundRealtimeWorld(world,planned,1000,{paused:true});
  assert.deepEqual(paused,planned);
  assert.equal(JSON.stringify(planned),copy);
  assert.throws(()=>advanceGroundRealtimeWorld(world,planned,-1),/Invalid/);
  assert.throws(()=>advanceGroundRealtimeWorld(world,planned,1001),/Invalid/);
});

test('F5 restores fractional position, pending route and explored memory exactly',()=>{
  const saved=legacy();
  let motion=orderGroundRealtimeWorld(world,startGroundRealtimeWorld(world,away,saved),
    'venn',{x:9,y:4});
  for(let i=0;i<4;i++)motion=advanceGroundRealtimeWorld(world,motion,500);
  assert.ok(motion.explored.length>0);
  assert.ok(officer(motion).route.length>0,'save must capture an unfinished walk');
  const raw=serializeGroundRealtimeWorld(world,away,saved,motion);
  assert.equal(JSON.parse(raw).version,2);
  assert.deepEqual(JSON.parse(raw).explored,motion.explored);
  const result=restoreGroundRealtimeWorld(world,away,saved,raw);
  assert.equal(result.source,'realtime');
  assert.deepEqual(result.state,motion);
  const next=advanceGroundRealtimeWorld(world,result.state,350);
  assert.deepEqual(next,advanceGroundRealtimeWorld(world,motion,350));
  assert.deepEqual(saved.commands,[],'legacy commands remain untouched during a continuous walk');
});

test('v1 sidecar loads, tampered terrain fails closed and legacy recovery never leaks exploration',()=>{
  const saved=legacy(),initial=startGroundRealtimeWorld(world,away,saved);
  const old=serializeGroundRealtimeSave(world,away,saved,initial.motion);
  assert.equal(JSON.parse(old).version,1);
  const restored=restoreGroundRealtimeWorld(world,away,saved,old);
  assert.equal(restored.source,'realtime');
  assert.deepEqual(restored.state,initial);
  const raw=JSON.parse(serializeGroundRealtimeWorld(world,away,saved,initial));
  raw.explored.push('99,99');
  const fallback=restoreGroundRealtimeWorld(world,away,saved,JSON.stringify(raw));
  assert.equal(fallback.source,'recovered-legacy');
  assert.deepEqual(fallback.state,initial);
  raw.explored=['1,1','1,1'];
  assert.equal(restoreGroundRealtimeWorld(world,away,saved,JSON.stringify(raw)).source,
    'recovered-legacy');
});

test('three-person real K-47 free-walk formation commits atomically and survives F5',()=>{
  const original=deploy(),f=orderGroundRealtimeFormation(world,original,
    ['venn','dorn','mira'],{x:2,y:5});
  assert.ok(f.motion.officers.every(o=>o.route.length>0));
  const endpoints=f.motion.officers.map(o=>o.route.at(-1));
  assert.equal(new Set(endpoints.map(o=>o.x+','+o.y)).size,3);
  assert.deepEqual(endpoints[0],{x:2,y:5});
  assert.deepEqual(original,deploy(),'legacy state was not changed by team order');
  let moving=advanceGroundRealtimeWorld(world,f,160);
  assert.ok(moving.motion.officers.some(o=>o.x!==4&&o.y!==5));
  const saved=serializeGroundRealtimeWorld(world,away,legacy(),moving);
  const restored=restoreGroundRealtimeWorld(world,away,legacy(),saved);
  assert.equal(restored.source,'realtime');
  assert.deepEqual(restored.state,moving);
  moving=finish(restored.state);
  assert.ok(moving.motion.officers.every(o=>o.route.length===0));
  assert.deepEqual(moving.motion.officers.map(o=>({x:o.x,y:o.y})),endpoints);
});


test('shared station approach agrees with real fractional movement and authorization',()=>{
 const station=world.scenes.surface.objects.find(o=>o.id==='probe');
 const planned=orderGroundRealtimeWorld(world,deploy(),'venn',{x:4.14,y:3});
 assert.match(groundRealtimeStationApproach(officer(planned),station,true).reason,/must stop/);
 const arrived=finish(planned);
 const approach=groundRealtimeStationApproach(officer(arrived),station,false);
 assert.equal(approach.reason,null);
 const actual=groundRealtimeStationUse(world,arrived,'venn','probe');
 assert.deepEqual([approach.x,approach.y,approach.heading],[actual.pose.x,actual.pose.y,actual.pose.heading]);
 assert.match(groundRealtimeStationApproach({x:4.34,y:3.2},station,false).reason,/not reached/);
 assert.match(groundRealtimeStationApproach({x:3,y:3},station,false).reason,/not adjacent/);
 assert.match(groundRealtimeStationApproach({x:NaN,y:3},station,false).reason,/Invalid/);
});


test('stopping selected formation members preserves K-47 terrain memory and save recovery',()=>{
 const planned=orderGroundRealtimeFormation(world,deploy(),['venn','dorn','mira'],{x:2,y:5});
 const moving=advanceGroundRealtimeWorld(world,planned,80);
 assert.ok(moving.motion.officers.every(o=>o.route.length>0));
 const before=JSON.stringify(moving);
 const stopped=stopGroundRealtimeWorld(world,moving,['venn','dorn']);
 assert.deepEqual(stopped.explored,moving.explored);
 assert.deepEqual(groundRealtimeVision(world,stopped),groundRealtimeVision(world,moving));
 for(const id of ['venn','dorn'])
  assert.deepEqual(officer(stopped,id),{...officer(moving,id),route:[]});
 assert.deepEqual(officer(stopped,'mira'),officer(moving,'mira'));
 assert.equal(JSON.stringify(moving),before);
 const all=stopGroundRealtimeWorld(world,stopped,['venn','dorn','mira']);
 const saved=serializeGroundRealtimeWorld(world,away,legacy(),all);
 const restored=restoreGroundRealtimeWorld(world,away,legacy(),saved);
 assert.equal(restored.source,'realtime');
 assert.deepEqual(restored.state,all);
 assert.deepEqual(advanceGroundRealtimeWorld(world,all,500),all);
});


test('queued K-47 return order preserves actual fog, pending route and save recovery',()=>{
 const initial=deploy();
 const outbound=orderGroundRealtimeWorld(world,initial,'venn',{x:9,y:4});
 const moving=advanceGroundRealtimeWorld(world,outbound,80);
 const before=JSON.stringify(moving);
 const queued=appendGroundRealtimeWorld(world,moving,'venn',{x:4,y:5});
 const prefix=officer(moving).route;
 assert.deepEqual(officer(queued).route.slice(0,prefix.length),prefix);
 assert.deepEqual(officer(queued).route.at(-1),{x:4,y:5});
 assert.equal(officer(queued).x,officer(moving).x);
 assert.equal(officer(queued).y,officer(moving).y);
 assert.deepEqual(groundRealtimeVision(world,queued),groundRealtimeVision(world,moving));
 assert.equal(groundRealtimeVision(world,queued).explored.has('10,4'),false);
 assert.throws(()=>appendGroundRealtimeWorld(world,queued,'venn',{x:-1,y:5}),/outside map/);
 assert.equal(JSON.stringify(moving),before);
 const raw=serializeGroundRealtimeWorld(world,away,legacy(),queued);
 const restored=restoreGroundRealtimeWorld(world,away,legacy(),raw);
 assert.equal(restored.source,'realtime');
 assert.deepEqual(restored.state,queued);
 const arrived=finish(restored.state);
 assert.deepEqual(officer(arrived),{id:'venn',x:4,y:5,route:[]});
 const vision=groundRealtimeVision(world,arrived);
 assert.equal(vision.visible.has('10,4'),false);
 assert.equal(vision.explored.has('10,4'),true,'only actual travel discovers terrain');
 assert.deepEqual(officer(arrived,'mira'),officer(initial,'mira'));
 assert.deepEqual(officer(arrived,'dorn'),officer(initial,'dorn'));
});
