import test from 'node:test';
import assert from 'node:assert/strict';
import {groundRealtimeGroupFrame} from '../src/groundRealtimeGroupFrame.mjs';

test('selected continuous squad stays close and centered with only necessary zoom',()=>{
 const group=[
  {x:440,y:232},{x:440,y:252},{x:640,y:312},
 ];
 const mobile=groundRealtimeGroupFrame(group,.52,480,true);
 assert.deepEqual(mobile.center,{x:540,y:272});
 assert.ok(mobile.height>480&&mobile.height<=620);
 assert.equal(mobile.fits,true);
 const worldWidth=mobile.height*.52;
 assert.ok(440>=mobile.center.x-worldWidth/2+36-1);
 assert.ok(640<=mobile.center.x+worldWidth/2-36+1);
 assert.equal(groundRealtimeGroupFrame(group,1.8,390).height,390,
  'desktop should never zoom out unnecessarily');
});

test('moving and retargeted officer positions are followed as real positions, not route endpoints',()=>{
 const moving=groundRealtimeGroupFrame([{x:490,y:260},{x:440,y:232}],.52,480,true);
 const arrived=groundRealtimeGroupFrame([{x:680,y:320},{x:440,y:232}],.52,480,true);
 assert.equal(moving.center.x,465);
 assert.equal(arrived.center.x,560);
 assert.ok(arrived.height>=moving.height);
 assert.equal(arrived.fits,true);
});

test('widely dispersed group is honestly marked too wide rather than becoming unreadably small',()=>{
 const out=groundRealtimeGroupFrame([{x:100,y:120},{x:1020,y:500}],.52,480,true);
 assert.equal(out.height,620);
 assert.equal(out.fits,false);
 assert.deepEqual(out.center,{x:560,y:310});
});

test('invalid or forged selected camera input fails closed without mutating original positions',()=>{
 const group=[{x:450,y:200},{x:560,y:260}];
 const original=JSON.stringify(group);
 assert.throws(()=>groundRealtimeGroupFrame([group[0]],.5,480,true),/Invalid/);
 assert.throws(()=>groundRealtimeGroupFrame(group,0,480,true),/Invalid/);
 assert.throws(()=>groundRealtimeGroupFrame([{x:Infinity,y:2},group[1]],.5,480,true),/Invalid/);
 assert.equal(JSON.stringify(group),original);
});


test('only the large K-47 trial may explicitly widen the portrait follow envelope',()=>{
 const spread=[{x:440,y:232},{x:680,y:372},{x:440,y:272}];
 const defaultFrame=groundRealtimeGroupFrame(spread,.46,500,true);
 assert.equal(defaultFrame.height,620);
 assert.equal(defaultFrame.fits,false);
 const wideFrame=groundRealtimeGroupFrame(spread,.46,500,true,900);
 assert.ok(wideFrame.height>620&&wideFrame.height<=900);
 assert.equal(wideFrame.fits,true);
 assert.deepEqual(wideFrame.center,defaultFrame.center);
 assert.throws(()=>groundRealtimeGroupFrame(spread,.46,500,true,Infinity),/Invalid/);
});
