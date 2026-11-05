import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startCrew} from '../src/crew.mjs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {startGroundSquadPositions, orderGroundOfficerMove,
  serializeGroundSquadPositions, deserializeGroundSquadPositions} from '../src/groundSquadPositions.mjs';
import {groundStationUse} from '../src/groundSquadInteractions.mjs';
import {startMandate, publicMandateReport,
  serializeMandateCheckpoint, deserializeMandateCheckpoint} from '../src/dualMandate.mjs';
import {performMedicalEvacuation, EVACUATION_INCIDENT} from '../src/medicalEvacuation.mjs';

const world=JSON.parse(readFileSync(new URL('../content/scenes/meridian.json',import.meta.url),'utf8'));
const definition=JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json',import.meta.url),'utf8'));
const away=startAwayTeam();
const crew=startCrew();
const initial=()=>startGroundSquadPositions(world,
  {version:1,area:'surface',x:4,y:5,heading:'N',pending:null},away);

test('weak selected adjacent tactical officer cannot borrow distant medic skill or forge rescue',()=>{
  const start=initial();
  const snapshot=orderGroundOfficerMove(world,away,start,'dorn',{x:5,y:4}).snapshot;
  const {pose,event}=groundStationUse(world,away,snapshot,'dorn','relief-point');
  assert.deepEqual(pose,{version:1,area:'surface',x:5,y:4,heading:'E',pending:null});
  assert.deepEqual(event,{type:'station',stationId:'relief-point',action:'assist-evacuees',
    label:'Puesto de socorro del puesto científico'});
  const mandate=startMandate(definition);
  const outcome=performMedicalEvacuation(definition,mandate,world,pose,crew,away,'dorn');
  assert.deepEqual(outcome.report,{result:'insufficient-medical',officerId:'dorn',skill:1});
  assert.equal(outcome.state,mandate);
  assert.deepEqual(mandate.incidents,[]);
  assert.deepEqual(start.commands,[]);
  assert.deepEqual(snapshot.commands,[{officerId:'dorn',x:5,y:4}]);
  assert.throws(()=>performMedicalEvacuation(definition,mandate,world,pose,crew,away,'rhee'),
    /deployed officer/);
});

test('actual adjacent medic completes and persists public and private rescue evidence once',()=>{
  let snapshot=orderGroundOfficerMove(world,away,initial(),'dorn',{x:5,y:4}).snapshot;
  snapshot=orderGroundOfficerMove(world,away,snapshot,'mira',{x:6,y:5}).snapshot;
  const journal=serializeGroundSquadPositions(world,away,snapshot);
  const restored=deserializeGroundSquadPositions(world,away,journal);
  const {pose,event}=groundStationUse(world,away,restored,'mira','relief-point');
  assert.equal(event.action,'assist-evacuees');
  assert.equal(pose.heading,'N');
  const initialMandate=startMandate(definition);
  const outcome=performMedicalEvacuation(definition,initialMandate,world,pose,crew,away,'mira');
  assert.deepEqual(outcome.report,{result:'evacuated',officerId:'mira',skill:4});
  assert.equal(outcome.state.orders.evacuate,'completed');
  assert.deepEqual(outcome.state.incidents.find(item=>item.id===EVACUATION_INCIDENT)?.witnesses,
    ['mira']);
  const saved=serializeMandateCheckpoint(definition,outcome.state);
  const restoredMandate=deserializeMandateCheckpoint(definition,saved);
  assert.equal(publicMandateReport(definition,restoredMandate).orders.find(item=>item.id==='evacuate').status,
    'completed');
  assert.throws(()=>performMedicalEvacuation(definition,restoredMandate,world,pose,crew,away,'mira'),
    /already resolved/);
  assert.deepEqual(initialMandate.incidents,[]);
});

test('unadjacent operators and nonmedical stations never emit rescue evidence',()=>{
  const mandate=startMandate(definition);
  assert.throws(()=>groundStationUse(world,away,initial(),'mira','relief-point'),/not adjacent/);
  assert.throws(()=>groundStationUse(world,away,initial(),'unknown','relief-point'));
  const moved=orderGroundOfficerMove(world,away,initial(),'dorn',{x:5,y:4}).snapshot;
  assert.throws(()=>groundStationUse(world,away,moved,'dorn','beam-out'));
  const distant={version:1,area:'surface',x:4,y:5,heading:'N',pending:null};
  assert.throws(()=>performMedicalEvacuation(definition,mandate,world,distant,crew,away,'dorn'));
  assert.deepEqual(mandate.actions,[]);
});
