import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SCENARIOS, createMission, validateScenario, validateMission,
 missionPath, applyMissionAction,
} from '../src/isoScenarioCampaign.ts';

function go(state,officer,destination,reach){
 const def=SCENARIOS[state.scenarioId];
 const distance=(a,b)=>a.split(':').map(Number).reduce(
  (sum,value,index)=>sum+Math.abs(value-Number(b.split(':')[index])),0);
 const candidates=[];
 for(let x=0;x<def.size;x++)for(let y=0;y<def.size;y++){
  const at=`${x}:${y}`;
  if(distance(at,destination)>reach)continue;
  const path=missionPath(state,officer,at);
  if(path)candidates.push(path);
 }
 candidates.sort((a,b)=>a.length-b.length);
 if(!candidates.length)throw Error(`No authored route for ${officer} to ${destination}`);
 let route=candidates[0];
 while(route.length>1){
  if(state.ap===0)state=applyMissionAction(state,{type:'end-turn'});
  const stop=route[Math.min(5,route.length-1)];
  state=applyMissionAction(state,{type:'move',officer,cell:stop});
  route=missionPath(state,officer,candidates[0].at(-1));
  assert.ok(route,'the remainder must be reachable after each move');
 }
 return state;
}
function action(state,command){
 return applyMissionAction(state.ap?state:applyMissionAction(state,{type:'end-turn'}),command);
}
for(const id of ['relay','derelict','evacuation']){
 test(`${id} objectives are fully reachable and completion is an actual state transition`,()=>{
  const scenario=SCENARIOS[id];validateScenario(scenario);
  let state=createMission(id);validateMission(state);
  assert.equal(state.round,1);assert.equal(state.ap,3);
  state=go(state,'science',scenario.sensor,2);
  state=action(state,{type:'scan',officer:'science'});
  assert.equal(state.scanned,true);
  if(scenario.console){
   state=go(state,'security',scenario.console,1);
   state=action(state,{type:'operate',officer:'security'});
   assert.equal(state.consoleOnline,true);
  }
  if(scenario.survivor){
   state=go(state,'medic',scenario.survivor,1);
   state=action(state,{type:'rescue',officer:'medic'});
   assert.equal(state.rescued,true);
  }
  state=go(state,'science',scenario.extraction,0);
  state=action(state,{type:'extract',officer:'science'});
  assert.equal(state.completed,true);
  assert.match(state.events.at(-1),/Extracción confirmada/);
  assert.throws(()=>applyMissionAction(state,{type:'end-turn'}),RangeError);
  assert.ok(state.events.length>5);
 });
}
test('orders cost real action points, honor roles and prevent teleporting through cover',()=>{
 const state=createMission('relay');
 assert.throws(()=>applyMissionAction(state,{type:'scan',officer:'science'}),RangeError);
 assert.throws(()=>applyMissionAction(state,{type:'operate',officer:'security'}),RangeError);
 assert.throws(()=>applyMissionAction(state,{type:'move',officer:'science',cell:'4:1'}),RangeError);
 assert.throws(()=>applyMissionAction(state,{type:'move',officer:'science',cell:'1:1'}),RangeError);
 assert.throws(()=>applyMissionAction(state,{type:'move',officer:'science',cell:'9:9'}),RangeError);
 let next=applyMissionAction(state,{type:'move',officer:'science',cell:'2:1'});
 assert.equal(state.locations.science,'1:1'); // no in-place mutation
 assert.equal(next.locations.science,'2:1');
 next=applyMissionAction(next,{type:'move',officer:'science',cell:'3:1'});
 next=applyMissionAction(next,{type:'move',officer:'science',cell:'3:2'});
 assert.equal(next.ap,0);
 assert.throws(()=>applyMissionAction(next,{type:'scan',officer:'science'}),RangeError);
 const round2=applyMissionAction(next,{type:'end-turn'});
 assert.equal(round2.round,2);assert.equal(round2.ap,3);assert.equal(next.ap,0);
});
test('invalid, overlapping or forged mission state and commands fail closed',()=>{
 const state=createMission('relay');
 assert.throws(()=>validateMission({...state,locations:{...state.locations,science:state.locations.medic}}),TypeError);
 assert.throws(()=>validateMission({...state,ap:-1}),TypeError);
 assert.throws(()=>validateMission({...state,completed:true}),TypeError);
 assert.throws(()=>validateMission({...state,rescued:true}),TypeError);
 assert.throws(()=>createMission('missing'),RangeError);
 assert.equal(missionPath(state,'science','12:12'),null);
 assert.equal(missionPath(state,'science','1:4'),null);
});
