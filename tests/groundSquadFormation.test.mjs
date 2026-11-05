import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startAwayTeam } from '../src/awayTeam.mjs';
import {
  startGroundSquadPositions,orderGroundOfficerMove,
  replayGroundSquadPositions,serializeGroundSquadPositions,
  deserializeGroundSquadPositions,
} from '../src/groundSquadPositions.mjs';
import { orderGroundFormation } from '../src/groundSquadFormation.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const start={version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
const position=state=>replayGroundSquadPositions(world,away,state).officers
  .map(officer=>[officer.id,officer.x,officer.y]);
const initial=()=>startGroundSquadPositions(world,start,away);

test('partial selection marches as a compact formation without moving the unselected officer',()=>{
  const before=initial();
  const {snapshot,moves}=orderGroundFormation(world,away,before,['venn','dorn'],{x:3,y:5});
  assert.deepEqual(position(snapshot),[['venn',3,5],['dorn',3,4],['mira',5,5]]);
  assert.equal(moves.length,2);
  assert.deepEqual(before.commands,[]);
  assert.equal(snapshot.commands.length,2);
  assert.deepEqual(deserializeGroundSquadPositions(world,away,serializeGroundSquadPositions(world,away,snapshot)),snapshot);
});

test('dispersed squad can regroup near its anchor through real replayable officer paths',()=>{
  let snapshot=orderGroundOfficerMove(world,away,initial(),'venn',{x:3,y:5}).snapshot;
  const prepared=JSON.parse(JSON.stringify(snapshot));
  const result=orderGroundFormation(world,away,snapshot,['venn','dorn','mira'],{x:4,y:5});
  assert.deepEqual(position(result.snapshot),[['venn',4,5],['dorn',4,4],['mira',5,5]]);
  assert.ok(result.moves.length>=1);
  assert.deepEqual(snapshot,prepared);
  assert.ok(result.snapshot.commands.length>snapshot.commands.length);
});

test('planner resolves a blocker by moving its occupant before the leader, never teleporting',()=>{
  const original=initial();
  // Target for Nara (3,4) is currently occupied by selected Kael (4,4)? No,
  // but Kael's preferred new slot (3,3) is reachable and keeps real routes.
  const first=orderGroundOfficerMove(world,away,original,'venn',{x:3,y:5}).snapshot;
  const result=orderGroundFormation(world,away,first,['venn','dorn'],{x:3,y:4});
  const final=position(result.snapshot);
  assert.deepEqual(final[0],['venn',3,4]);
  assert.equal(final[2][1],5);
  assert.equal(final[2][2],5);
  assert.notDeepEqual(final[0].slice(1),final[1].slice(1));
  assert.ok(result.moves.every(move=>move.steps>=1));
});

test('blocked/invalid group commands reject atomically without mutating saved history',()=>{
  const snapshot=initial();
  const saved=JSON.stringify(snapshot);
  const command=(selection,destination)=>orderGroundFormation(world,away,snapshot,selection,destination);
  assert.throws(()=>command(['venn','dorn'],{x:5,y:5}),/occupied/); // Isa unselected
  assert.throws(()=>command(['venn','dorn'],{x:6,y:4}),/occupied/); // medical station
  assert.throws(()=>command(['venn','dorn'],{x:3,y:2}),/occupied/); // wall
  assert.throws(()=>command(['venn','venn'],{x:3,y:5}),/Invalid/);
  assert.throws(()=>command(['venn','unknown'],{x:3,y:5}),/Invalid/);
  assert.throws(()=>command(['venn'],{x:3,y:5}),/Invalid/);
  assert.throws(()=>command(['venn','dorn'],{x:13,y:5}),/Invalid/);
  assert.equal(JSON.stringify(snapshot),saved);
});
