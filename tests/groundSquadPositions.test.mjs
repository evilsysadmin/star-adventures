import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {
  startGroundSquadPositions,replayGroundSquadPositions,orderGroundOfficerMove,
  serializeGroundSquadPositions,deserializeGroundSquadPositions,
} from '../src/groundSquadPositions.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const spatial={version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
const ids=state=>state.officers.map(unit=>[unit.id,unit.x,unit.y]);

test('deployed officers have separate, walkable, stable canonical cells',()=>{
  const initial=startGroundSquadPositions(world,spatial,away);
  assert.deepEqual(initial.squad,['venn','dorn','mira']);
  assert.deepEqual(ids(replayGroundSquadPositions(world,away,initial)),
    [['venn',4,5],['dorn',4,4],['mira',5,5]]);
  assert.deepEqual(initial.commands,[]);
  assert.throws(()=>startGroundSquadPositions(world,{...spatial,area:'bridge'},away));
});

test('one officer moves while companions stay put, and replay preserves heading',()=>{
  const initial=startGroundSquadPositions(world,spatial,away);
  const result=orderGroundOfficerMove(world,away,initial,'venn',{x:3,y:5});
  assert.deepEqual(result.route,[{x:3,y:5}]);
  assert.deepEqual(initial.commands,[]);
  const next=replayGroundSquadPositions(world,away,result.snapshot);
  assert.deepEqual(ids(next),[['venn',3,5],['dorn',4,4],['mira',5,5]]);
  assert.equal(next.officers[0].heading,'W');
  assert.deepEqual(next.events,[{type:'move',officerId:'venn',from:{x:4,y:5},to:{x:3,y:5},steps:1}]);
  assert.deepEqual(orderGroundOfficerMove(world,away,result.snapshot,'venn',{x:3,y:5}).snapshot,result.snapshot);
});

test('movement respects stations, walls, squad occupancy and unreachable cells',()=>{
  const initial=startGroundSquadPositions(world,spatial,away);
  assert.throws(()=>orderGroundOfficerMove(world,away,initial,'venn',{x:4,y:4}),/occupied/);
  assert.throws(()=>orderGroundOfficerMove(world,away,initial,'venn',{x:4,y:6}),/occupied/);
  assert.throws(()=>orderGroundOfficerMove(world,away,initial,'venn',{x:3,y:2}),/occupied/);
  assert.throws(()=>orderGroundOfficerMove(world,away,initial,'venn',{x:50,y:50}),/outside/);
  const one=orderGroundOfficerMove(world,away,initial,'venn',{x:3,y:5});
  const two=orderGroundOfficerMove(world,away,one.snapshot,'dorn',{x:4,y:5});
  assert.deepEqual(ids(replayGroundSquadPositions(world,away,two.snapshot)),
    [['venn',3,5],['dorn',4,5],['mira',5,5]]);
  assert.throws(()=>orderGroundOfficerMove(world,away,two.snapshot,'mira',{x:4,y:5}),/occupied/);
});

test('versioned save replays commands; corruption, reselected squad and impossible paths fail closed',()=>{
  const initial=startGroundSquadPositions(world,spatial,away);
  const moved=orderGroundOfficerMove(world,away,initial,'venn',{x:3,y:5}).snapshot;
  const serialized=serializeGroundSquadPositions(world,away,moved);
  assert.deepEqual(deserializeGroundSquadPositions(world,away,serialized),moved);
  assert.deepEqual(replayGroundSquadPositions(world,away,JSON.parse(serialized)),
    replayGroundSquadPositions(world,away,moved));
  assert.throws(()=>deserializeGroundSquadPositions(world,away,'{'));
  assert.throws(()=>deserializeGroundSquadPositions(world,away,JSON.stringify({...moved,version:999})));
  assert.throws(()=>deserializeGroundSquadPositions(world,{...away,squad:['venn','mira','dorn']},serialized));
  assert.throws(()=>deserializeGroundSquadPositions(world,away,
    JSON.stringify({...moved,commands:[{officerId:'venn',x:4,y:4}]})));
  assert.throws(()=>orderGroundOfficerMove(world,away,moved,'nonexistent',{x:1,y:1}));
});
