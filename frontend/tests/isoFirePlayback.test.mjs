import test from 'node:test';
import assert from 'node:assert/strict';
import { isoFireFrame } from '../src/isoFirePlayback.ts';
import { FIRE_ATLAS } from '../src/tacticalAnimation.ts';

test('one authored fire burst advances through all six frames exactly once',()=>{
 assert.equal(FIRE_ATLAS.frames,6);
 assert.equal(FIRE_ATLAS.fps,9);
 const expected=[0,1,2,3,4,5];
 assert.deepEqual(expected.map(i=>isoFireFrame(i*1000/9+.01)),expected);
 assert.equal(isoFireFrame(6*1000/9-0.01),5);
 assert.equal(isoFireFrame(6*1000/9),null);
 assert.equal(isoFireFrame(4_000),null);
});

test('paused and reduced-motion burst remains on authored first frame until completion',()=>{
 for(const at of [0,50,180,350,665])
  assert.equal(isoFireFrame(at,false),0);
 assert.equal(isoFireFrame(800,false),null);
});

test('invalid values fail closed rather than retriggering animated frames',()=>{
 for(const value of [Infinity,-Infinity,NaN])assert.equal(isoFireFrame(value),null);
 assert.equal(isoFireFrame(-10),0);
 assert.equal(isoFireFrame(0),0);
});
