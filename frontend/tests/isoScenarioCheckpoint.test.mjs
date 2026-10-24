import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, createMission, missionPath, applyMissionAction } from '../src/isoScenarioCampaign.ts';
import {
  SCENARIO_CHECKPOINT_VERSION, MAX_SCENARIO_COMMANDS, MAX_SCENARIO_CHECKPOINT_BYTES,
  replayScenarioCommands, serializeScenarioCheckpoint, deserializeScenarioCheckpoint,
} from '../src/isoScenarioCheckpoint.ts';

function solve(id) {
  const def = SCENARIOS[id], actions = [];
  let state = createMission(id);
  const act = command => {
    if (!state.ap && command.type !== 'end-turn') act({type:'end-turn'});
    state = applyMissionAction(state, command);
    actions.push(command);
  };
  const distance = (a,b) => a.split(':').map(Number)
    .reduce((sum,n,i) => sum + Math.abs(n - Number(b.split(':')[i])), 0);
  const go = (officer, target, reach) => {
    const candidates = [];
    for (let x=0;x<def.size;x++) for(let y=0;y<def.size;y++) {
      const tile = x + ':' + y, route = missionPath(state,officer,tile);
      if (distance(tile,target)<=reach && route) candidates.push(route);
    }
    candidates.sort((a,b)=>a.length-b.length);
    assert.ok(candidates.length, 'objective must be reachable');
    const end = candidates[0].at(-1);
    let route = missionPath(state,officer,end);
    while(route.length>1) {
      const cell=route[Math.min(5,route.length-1)];
      act({type:'move',officer,cell});
      route=missionPath(state,officer,end);
      assert.ok(route);
    }
  };
  go('science',def.sensor,2);act({type:'scan',officer:'science'});
  if(def.console){go('security',def.console,1);act({type:'operate',officer:'security'});}
  if(def.survivor){go('medic',def.survivor,1);act({type:'rescue',officer:'medic'});}
  go('science',def.extraction,0);act({type:'extract',officer:'science'});
  return {state,actions};
}
for (const id of ['relay','derelict','evacuation']) {
  test(id + ': a real completed scenario is recovered exactly from legal command history',()=>{
    const {state,actions}=solve(id);
    assert.equal(state.completed,true);
    const raw=serializeScenarioCheckpoint(id,actions);
    const result=deserializeScenarioCheckpoint(raw);
    assert.equal(JSON.parse(raw).version,SCENARIO_CHECKPOINT_VERSION);
    assert.deepEqual(result.state,state);
    assert.deepEqual(result.actions,actions);
    assert.equal(result.state.events.length,actions.length);
    assert.deepEqual(replayScenarioCommands(id,actions).state,state);
  });
}
test('partial progress and round/AP persist without modifying the original history',()=>{
  const original=[{type:'move',officer:'science',cell:'2:1'},{type:'end-turn'}];
  const serialized=serializeScenarioCheckpoint('relay',original);
  const recovered=deserializeScenarioCheckpoint(serialized);
  assert.equal(recovered.state.round,2);
  assert.equal(recovered.state.ap,3);
  assert.equal(recovered.state.locations.science,'2:1');
  assert.equal(recovered.state.scanned,false);
  recovered.actions[0].cell='3:1'; // parsed commands are copied, never the caller's originals
  assert.equal(original[0].cell,'2:1');
});
test('reject tampered victories, fabricated positions, unknown schema and unknown objects',()=>{
  const valid=JSON.parse(serializeScenarioCheckpoint('relay',[]));
  for(const value of [
    {...valid,version:2},
    {...valid,scenarioId:'__proto__'},
    {...valid,state:{completed:true}},
    {...valid,actions:[{type:'extract',officer:'science'}]},
    {...valid,actions:[{type:'move',officer:'science',cell:'9:9'}]},
    {...valid,actions:[{type:'move',officer:'medic',cell:'1:1'}]},
    {...valid,actions:[{type:'end-turn',ap:3}]},
    {...valid,actions:[{type:'scan',officer:'medic'}]},
    {...valid,actions:[{type:'rescue',officer:'medic'}]},
    {...valid,actions:[{type:'end-turn',toString:'no'}]},
    {...valid,actions:[{type:'UNKNOWN'}]},
    {...valid,actions:'invalid'},
    [],
    null,
  ]) assert.throws(()=>deserializeScenarioCheckpoint(JSON.stringify(value)));
  for(const raw of ['{','', 'null', 'x'.repeat(MAX_SCENARIO_CHECKPOINT_BYTES+1)])
    assert.throws(()=>deserializeScenarioCheckpoint(raw));
});
test('bounded command history fails closed, including a replay after mission completion',()=>{
  const commands=Array.from({length:MAX_SCENARIO_COMMANDS+1},()=>({type:'end-turn'}));
  assert.throws(()=>serializeScenarioCheckpoint('relay',commands));
  assert.throws(()=>deserializeScenarioCheckpoint(JSON.stringify({
    version:1,scenarioId:'relay',actions:commands,
  })));
  const {actions}=solve('evacuation');
  assert.throws(()=>replayScenarioCommands('evacuation',[...actions,{type:'end-turn'}]));
});
