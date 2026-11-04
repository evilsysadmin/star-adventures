import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTacticalContact, validateContactScenario } from '../src/tacticalContact.mjs';

const fixture = () => ({
 board:{columns:8,rows:5}, blocked:['3:0'], contactRadius:1,
 officers:[{id:'science',cell:'0:1',facing:'N',health:3},{id:'medic',cell:'0:3',facing:'W',health:2}],
 hostiles:[{id:'guard-b',cell:'5:1',facing:'W',health:2},{id:'guard-a',cell:'4:2',facing:'N',health:1}],
});
const move=(officer,...path)=>({type:'move',officer,path});

test('movement is free until first contact; exact positions, health and facing carry forward',()=>{
 const scenario=fixture(), original=structuredClone(scenario);
 const commands=[move('science','1:1','2:1'),move('medic','1:3'),move('science','3:1','4:1','5:1')];
 // The suffix collides with a hostile and is rejected even if contact would happen first.
 assert.throws(()=>replayTacticalContact(scenario,commands),/Invalid movement path/);
 commands[2]=move('science','3:1','4:1','4:0');
 const state=replayTacticalContact(scenario,commands);
 assert.equal(state.phase,'combat');
 assert.equal(state.officers[0].cell,'4:1');
 assert.equal(state.officers[0].facing,'E');
 assert.equal(state.officers[1].cell,'1:3');
 assert.equal(state.officers[1].health,2);
 assert.deepEqual(state.contacts,[{officer:'science',hostile:'guard-a'},{officer:'science',hostile:'guard-b'}]);
 assert.equal(state.events.at(-1).type,'contact');
 assert.deepEqual(replayTacticalContact(scenario,commands),state);
 assert.deepEqual(scenario,original);
 assert.throws(()=>replayTacticalContact(scenario,[...commands,move('medic','2:3')]),/already started/);
});

test('no-contact routes and separately reissued orders preserve all intermediate positions',()=>{
 const scenario=fixture();
 const result=replayTacticalContact(scenario,[move('science','1:1','2:1'),move('science','2:2'),move('medic','1:3')]);
 assert.equal(result.phase,'free');
 assert.deepEqual(result.events.map(e=>e.to),['1:1','2:1','2:2','1:3']);
 assert.equal(result.officers[0].facing,'S');
});

test('initial contact starts combat and malformed or obstructed routes fail closed',()=>{
 const scenario=fixture();
 scenario.hostiles[0].cell='1:1';
 assert.equal(replayTacticalContact(scenario,[]).phase,'combat');
 assert.throws(()=>replayTacticalContact(scenario,[move('medic','1:3')]),/already started/);
 for (const path of [['1:1','3:1'],['0:3'],['3:0'],['01:1'],['8:1']])
  assert.throws(()=>replayTacticalContact(fixture(),[move('science',...path)]));
 assert.throws(()=>replayTacticalContact(fixture(),[{...move('science','1:1'),extra:true}]));
 const bad=fixture();bad.hostiles[0].cell='0:1';
 assert.throws(()=>validateContactScenario(bad),/Occupied/);
});
