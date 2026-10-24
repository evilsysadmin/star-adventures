import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, createMission, missionPath, applyMissionAction } from '../src/isoScenarioCampaign.ts';
import { replayScenarioCommands } from '../src/isoScenarioCheckpoint.ts';
import {
  TRAINING_RECORD_VERSION, MAX_TRAINING_RECORD_BYTES,
  emptyTrainingArchive, addTrainingResult, trainingResult,
  serializeTrainingArchive, deserializeTrainingArchive,
} from '../src/isoTrainingRecords.ts';

function solve(id){
 const def=SCENARIOS[id],commands=[];
 let state=createMission(id);
 const apply=cmd=>{ if(state.ap===0&&cmd.type!=='end-turn')apply({type:'end-turn'});
  state=applyMissionAction(state,cmd);commands.push(cmd); };
 const distance=(a,b)=>a.split(':').map(Number).reduce((d,n,i)=>d+Math.abs(n-Number(b.split(':')[i])),0);
 const go=(officer,destination,reach)=>{
  const candidates=[];
  for(let x=0;x<def.size;x++)for(let y=0;y<def.size;y++){
   const tile=x+':'+y;
   if(distance(tile,destination)>reach)continue;
   const path=missionPath(state,officer,tile);
   if(path)candidates.push(path);
  }
  candidates.sort((a,b)=>a.length-b.length);
  assert.ok(candidates.length);
  const last=candidates[0].at(-1);
  for(let path=missionPath(state,officer,last);path.length>1;path=missionPath(state,officer,last))
   apply({type:'move',officer,cell:path[Math.min(5,path.length-1)]});
 };
 go('science',def.sensor,2);apply({type:'scan',officer:'science'});
 if(def.console){go('security',def.console,1);apply({type:'operate',officer:'security'});}
 if(def.survivor){go('medic',def.survivor,1);apply({type:'rescue',officer:'medic'});}
 go('science',def.extraction,0);apply({type:'extract',officer:'science'});
 return replayScenarioCommands(id,commands);
}
test('all three distinct authored missions earn only factual completed training outcomes',()=>{
 let archive=emptyTrainingArchive();
 for(const id of ['relay','derelict','evacuation']){
  const history=solve(id);
  archive=addTrainingResult(archive,history);
  const result=trainingResult({scenarioId:id,actions:history.actions});
  assert.equal(result.extracted,true);
  assert.equal(result.scanned,true);
  assert.equal(result.operated,!!SCENARIOS[id].console);
  assert.equal(result.rescued,!!SCENARIOS[id].survivor);
  assert.equal(result.rounds,history.state.round);
  assert.equal(result.orders,history.actions.filter(x=>x.type!=='end-turn').length);
  assert.equal(result.moves,history.actions.filter(x=>x.type==='move').length);
 }
 assert.equal(archive.version,TRAINING_RECORD_VERSION);
 assert.deepEqual(archive.runs.map(run=>run.scenarioId),['relay','derelict','evacuation']);
 assert.deepEqual(deserializeTrainingArchive(serializeTrainingArchive(archive)),archive);
 assert.ok(!serializeTrainingArchive(archive).includes('"completed"'));
});
test('replaying a worse or identical completed attempt never overwrites a personal best',()=>{
 const fast=solve('relay');
 const archive=addTrainingResult(emptyTrainingArchive(),fast);
 const slowerCommands=[{type:'end-turn'},...fast.actions];
 const slower=replayScenarioCommands('relay',slowerCommands);
 assert.equal(slower.state.completed,true);
 assert.deepEqual(addTrainingResult(archive,slower),archive);
 assert.deepEqual(addTrainingResult(archive,fast),archive);
 const reversed=addTrainingResult(emptyTrainingArchive(),slower);
 const faster=addTrainingResult(reversed,fast);
 assert.equal(trainingResult(faster.runs[0]).rounds,fast.state.round);
 assert.deepEqual(faster,archive);
});
test('tampered states, uncompleted attempts and forged wins are never awarded',()=>{
 const unfinished=replayScenarioCommands('relay',[]);
 assert.throws(()=>addTrainingResult(emptyTrainingArchive(),unfinished));
 const finished=solve('evacuation');
 assert.throws(()=>addTrainingResult(emptyTrainingArchive(),{...finished,state:{...finished.state,round:1}}));
 assert.throws(()=>addTrainingResult(emptyTrainingArchive(),{...finished,state:{...finished.state,rescued:false}}));
 assert.throws(()=>addTrainingResult(emptyTrainingArchive(),{
  scenarioId:'evacuation',actions:[],state:{...finished.state,completed:true}
 }));
 assert.throws(()=>trainingResult({scenarioId:'relay',actions:[]}));
});
test('invalid archives are rejected before any result can be applied',()=>{
 const valid=JSON.parse(serializeTrainingArchive(addTrainingResult(emptyTrainingArchive(),solve('relay'))));
 for(const forged of [
  {...valid,version:2}, {...valid,bonus:'credit'},
  {...valid,runs:[...valid.runs,...valid.runs]},
  {...valid,runs:[{scenarioId:'relay',actions:[]}]},
  {...valid,runs:[{scenarioId:'relay',actions:[{type:'extract',officer:'science'}]}]},
  {...valid,runs:[{scenarioId:'__proto__',actions:[]}]},
  {...valid,runs:[{scenarioId:'relay',actions:valid.runs[0].actions,orders:0}]},
  {...valid,runs:'bad'}, null, [],
 ])assert.throws(()=>deserializeTrainingArchive(JSON.stringify(forged)));
 assert.throws(()=>deserializeTrainingArchive('{'));
 assert.throws(()=>deserializeTrainingArchive('z'.repeat(MAX_TRAINING_RECORD_BYTES+1)));
});
