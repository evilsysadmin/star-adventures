import test from 'node:test';
import assert from 'node:assert/strict';
import {createRealtimeFrameClock} from '../src/realtimeFrameClock.ts';

test('frame clock accumulates small intervals and limits authoritative updates',()=>{
 const clock=createRealtimeFrameClock();
 assert.equal(clock.step(0),null);
 assert.equal(clock.step(16),null);
 assert.equal(clock.step(32),null);
 assert.equal(clock.step(40),40);
 assert.equal(clock.step(79),null);
 assert.equal(clock.step(80),40);
 assert.equal(clock.step(250),80,'slow frames cannot trigger unbounded catchup');
 assert.equal(clock.step(266),null);
});
test('visibility reset drops all hidden time even without a background frame',()=>{
 const clock=createRealtimeFrameClock();
 assert.equal(clock.step(100),null);
 assert.equal(clock.step(150),50);
 clock.reset();
 assert.equal(clock.step(60_000),null);
 assert.equal(clock.step(60_016),null);
 assert.equal(clock.step(60_040),40);
});
test('invalid or backward timestamps never advance simulation',()=>{
 const clock=createRealtimeFrameClock();
 assert.equal(clock.step(NaN),null);
 assert.equal(clock.step(100),null);
 assert.equal(clock.step(Infinity),null);
 assert.equal(clock.step(90),null);
 assert.equal(clock.step(130),40);
});
