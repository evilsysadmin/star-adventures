import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {
  startGroundSquadPositions,orderGroundOfficerMove,
} from '../src/groundSquadPositions.mjs';
import {
  orderRealtimeExplorationMove,advanceRealtimeExploration,
} from '../src/groundRealtimeExploration.mjs';
import {
  GROUND_REALTIME_SAVE_KEY,initialRealtimeFromLegacy,
  serializeGroundRealtimeSave,restoreGroundRealtimeSave,
} from '../src/groundRealtimeSave.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const legacy=()=>startGroundSquadPositions(world,
  {version:1,area:'surface',x:4,y:5,heading:'N',pending:null},away);
const byId=(state,id)=>state.officers.find(unit=>unit.id===id);

test('legacy deployment migrates to stable independent continuous positions without mutating v1',()=>{
  const saved=legacy(),before=JSON.stringify(saved);
  const initial=initialRealtimeFromLegacy(world,away,saved);
  assert.deepEqual(initial.officers.map(o=>[o.id,o.x,o.y,o.route]),[
    ['venn',4,5,[]],['dorn',4,4,[]],['mira',5,5,[]],
  ]);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(GROUND_REALTIME_SAVE_KEY,'shadowops.star-adventures.ground-realtime.v1');
  const empty=restoreGroundRealtimeSave(world,away,saved,null);
  assert.equal(empty.source,'legacy');
  assert.deepEqual(empty.state,initial);
});

test('F5 restores exact mid-walk coordinates and outstanding route, not the commanded destination',()=>{
  const saved=legacy(),snapshotBefore=JSON.stringify(saved);
  const initial=initialRealtimeFromLegacy(world,away,saved);
  const ordered=orderRealtimeExplorationMove(world.scenes.surface,initial,
    'venn',{x:3.2,y:5.1});
  const mid=advanceRealtimeExploration(world.scenes.surface,ordered,150);
  assert.ok(byId(mid,'venn').x<4&&byId(mid,'venn').x>3);
  assert.ok(byId(mid,'venn').route.length>0);
  const raw=serializeGroundRealtimeSave(world,away,saved,mid);
  const restored=restoreGroundRealtimeSave(world,away,saved,raw);
  assert.equal(restored.source,'realtime');
  assert.deepEqual(restored.state,mid);
  assert.equal(JSON.stringify(saved),snapshotBefore,'v1 rollback commands must not advance');
  assert.deepEqual(advanceRealtimeExploration(world.scenes.surface,restored.state,750),
    advanceRealtimeExploration(world.scenes.surface,mid,750),
    'resuming from the same continuous state is deterministic');
});

test('stale or damaged realtime sidecar fails closed to the current canonical legacy state',()=>{
  const saved=legacy();
  const initial=initialRealtimeFromLegacy(world,away,saved);
  const mid=advanceRealtimeExploration(world.scenes.surface,
    orderRealtimeExplorationMove(world.scenes.surface,initial,
      'venn',{x:3.2,y:5.1}),200);
  const raw=serializeGroundRealtimeSave(world,away,saved,mid);
  const newer=orderGroundOfficerMove(world,away,saved,'venn',{x:3,y:5}).snapshot;
  const stale=restoreGroundRealtimeSave(world,away,newer,raw);
  assert.equal(stale.source,'recovered-legacy');
  assert.equal(byId(stale.state,'venn').x,3);
  assert.deepEqual(byId(stale.state,'venn').route,[]);
  const damaged=restoreGroundRealtimeSave(world,away,saved,'{');
  assert.equal(damaged.source,'recovered-legacy');
  assert.deepEqual(damaged.state,initial);
  const corrupted=JSON.parse(raw);
  corrupted.motion.officers[0].route=[{x:4,y:2}];
  assert.equal(restoreGroundRealtimeSave(world,away,saved,
    JSON.stringify(corrupted)).source,'recovered-legacy');
});

test('foreign roster, future schema and extra untrusted keys cannot replace a mission save',()=>{
  const saved=legacy(),fresh=initialRealtimeFromLegacy(world,away,saved);
  const raw=serializeGroundRealtimeSave(world,away,saved,fresh);
  const other=JSON.parse(raw);
  other.motion.officers[0].id='unknown';
  assert.equal(restoreGroundRealtimeSave(world,away,saved,JSON.stringify(other)).source,
    'recovered-legacy');
  other.motion.officers[0].id='venn';
  other.version=99;
  assert.equal(restoreGroundRealtimeSave(world,away,saved,JSON.stringify(other)).source,
    'recovered-legacy');
  other.version=1;other.surprise={};
  assert.equal(restoreGroundRealtimeSave(world,away,saved,JSON.stringify(other)).source,
    'recovered-legacy');
  const shuffled={...fresh,officers:[...fresh.officers].reverse()};
  assert.throws(()=>serializeGroundRealtimeSave(world,away,saved,shuffled),/roster/);
  assert.throws(()=>serializeGroundRealtimeSave(world,away,
    {...saved,version:42},fresh),/Invalid/);
  assert.deepEqual(restoreGroundRealtimeSave(world,away,saved,' '.repeat(200_001)).state,
    fresh);
});
