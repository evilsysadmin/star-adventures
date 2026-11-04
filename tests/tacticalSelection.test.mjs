import test from 'node:test';
import assert from 'node:assert/strict';
import { isSelectionDrag, selectOfficer, selectOfficerRectangle } from '../src/tacticalSelection.mjs';

const roster = [
 {id:'science',x:20,y:30,visible:true},
 {id:'security',x:40,y:50,visible:true},
 {id:'medic',x:30,y:40,visible:false},
];
test('single click replaces, additive click toggles and empty ground clears',()=>{
 assert.deepEqual(selectOfficer(roster,['security'],'science'),['science']);
 assert.deepEqual(selectOfficer(roster,['security'],'science',true),['science','security']);
 assert.deepEqual(selectOfficer(roster,['science','security'],'science',true),['security']);
 assert.deepEqual(selectOfficer(roster,['science'],null),[]);
 assert.deepEqual(selectOfficer(roster,['science'],null,true),['science']);
 assert.throws(()=>selectOfficer(roster,[],'medic'));
});
test('rectangle selects visible centers in either direction, with optional additive selection',()=>{
 const start={x:20,y:30},end={x:40,y:50};
 assert.deepEqual(selectOfficerRectangle(roster,[],start,end),['science','security']);
 assert.deepEqual(selectOfficerRectangle(roster,[],end,start),['science','security']);
 assert.deepEqual(selectOfficerRectangle(roster,['security'],{x:15,y:25},{x:25,y:35},true),['science','security']);
 assert.deepEqual(selectOfficerRectangle(roster,['science'],{x:100,y:100},{x:110,y:110}),[]);
});
test('drag threshold and invalid coordinates cannot silently select',()=>{
 assert.equal(isSelectionDrag({x:0,y:0},{x:8,y:0}),false);
 assert.equal(isSelectionDrag({x:0,y:0},{x:8.01,y:0}),true);
 assert.throws(()=>isSelectionDrag({x:NaN,y:0},{x:1,y:1}));
 assert.throws(()=>selectOfficerRectangle(roster,['unknown'],{x:0,y:0},{x:1,y:1}));
 assert.throws(()=>selectOfficerRectangle([...roster,roster[0]],[],{x:0,y:0},{x:1,y:1}));
});

test('additive selection drops officers that are no longer visible',()=>{
 assert.deepEqual(selectOfficer(roster,['medic','security'],null,true),['security']);
 assert.deepEqual(selectOfficer(roster,['medic'],'science',true),['science']);
 assert.deepEqual(selectOfficerRectangle(roster,['medic','security'],{x:15,y:25},{x:25,y:35},true),['science','security']);
});
