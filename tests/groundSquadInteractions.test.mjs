import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew } from '../src/crew.mjs';
import { startAwayTeam, investigateProbe, PROBE_FINDING } from '../src/awayTeam.mjs';
import { startGroundSquadPositions, orderGroundOfficerMove, serializeGroundSquadPositions,
  deserializeGroundSquadPositions } from '../src/groundSquadPositions.mjs';
import { groundStationUse } from '../src/groundSquadInteractions.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url), 'utf8'));
const away = startAwayTeam();
const spatial = {version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
const initial = () => startGroundSquadPositions(world, spatial, away);

test('an adjacent, saved officer uses the actual probe station without moving the campaign camera', () => {
  const start=initial();
  const moved=orderGroundOfficerMove(world,away,start,'dorn',{x:4,y:3}).snapshot;
  const saved=JSON.stringify(moved);
  const {pose,event}=groundStationUse(world,away,moved,'dorn','probe');
  assert.deepEqual(pose,{version:1,area:'surface',x:4,y:3,heading:'N',pending:null});
  assert.deepEqual(event,{type:'station',stationId:'probe',action:'inspect-probe',label:'Sonda científica'});
  assert.equal(JSON.stringify(moved),saved);
  assert.deepEqual(spatial,{version:1,area:'surface',x:4,y:5,heading:'N',pending:null});
  const restored=deserializeGroundSquadPositions(world,away,serializeGroundSquadPositions(world,away,moved));
  assert.deepEqual(groundStationUse(world,away,restored,'dorn','probe'),{pose,event});
});

test('a weak selected operator cannot borrow the stronger science rating of a distant specialist', () => {
  const dorn=orderGroundOfficerMove(world,away,initial(),'dorn',{x:4,y:3}).snapshot;
  const interaction=groundStationUse(world,away,dorn,'dorn','probe');
  const first=investigateProbe(world,interaction.pose,startCrew(),away,'dorn');
  assert.deepEqual(first.report,{officerId:'dorn',skill:1,result:'insufficient-science'});
  assert.deepEqual(first.state.findings,[]);
  const nara=orderGroundOfficerMove(world,away,dorn,'venn',{x:5,y:2}).snapshot;
  const science=groundStationUse(world,away,nara,'venn','probe');
  assert.equal(science.pose.heading,'W');
  const next=investigateProbe(world,science.pose,startCrew(),first.state,'venn');
  assert.deepEqual(next.report,{officerId:'venn',skill:4,result:'success'});
  assert.deepEqual(next.state.findings,[PROBE_FINDING]);
  assert.throws(()=>investigateProbe(world,science.pose,startCrew(),next.state,'venn'),/already investigated/);
});

test('out-of-range, impostor, non-station, duplicate and corrupt commands fail closed', () => {
  const start=initial();
  for(const [officer,station] of [
    ['venn','probe'],['mira','probe'],['dorn','probe'],
    ['unknown','probe'],['venn','no-such-object'],['venn','beam-out'],
  ]) assert.throws(()=>groundStationUse(world,away,start,officer,station));
  const near=orderGroundOfficerMove(world,away,start,'dorn',{x:4,y:3}).snapshot;
  assert.throws(()=>groundStationUse(world,away,near,'dorn','sensor-vault'),/not adjacent/);
  assert.throws(()=>groundStationUse(world,away,{...near,commands:[{officerId:'dorn',x:4,y:2}]},'dorn','probe'));
  const selected=groundStationUse(world,away,near,'dorn','probe').pose;
  assert.throws(()=>investigateProbe(world,selected,startCrew(),away,'rhee'),/not deployed/);
});


test('a real squad officer at the perimeter uplink authorizes optional tactical contact',()=>{
  const start=initial();
  assert.throws(()=>groundStationUse(world,away,start,'mira','perimeter-uplink'),
    /not adjacent/);
  const moved=orderGroundOfficerMove(world,away,start,'mira',{x:7,y:6}).snapshot;
  const before=JSON.stringify(moved);
  const action=groundStationUse(world,away,moved,'mira','perimeter-uplink');
  assert.deepEqual(action.pose,
    {version:1,area:'surface',x:7,y:6,heading:'N',pending:null});
  assert.deepEqual(action.event,
    {type:'station',stationId:'perimeter-uplink',action:'secure-perimeter',
     label:'Baliza de seguridad del perímetro'});
  assert.equal(JSON.stringify(moved),before,'using the baliza must not teleport or mutate the squad');
  const restored=deserializeGroundSquadPositions(world,away,
    serializeGroundSquadPositions(world,away,moved));
  assert.deepEqual(groundStationUse(world,away,restored,'mira','perimeter-uplink'),
    action,'F5 must reproduce the exact same physical authorization');
  assert.throws(()=>groundStationUse(world,away,restored,'venn','perimeter-uplink'),
    /not adjacent/,'a distant selected officer may not borrow Mira\'s position');
});
