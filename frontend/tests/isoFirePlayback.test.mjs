import test from 'node:test';
import assert from 'node:assert/strict';
import { isoFireFrame, isoHitReactionAt, nextFireReviewFrame } from '../src/isoFirePlayback.ts';
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

test('manual review reaches each original frame once, then explicitly returns to idle',()=>{
 const seen=[0];
 let frame=0;
 while(true){
   const next=nextFireReviewFrame(frame);
   if(next===null)break;
   seen.push(next);
   frame=next;
 }
 assert.deepEqual(seen,[0,1,2,3,4,5]);
 assert.equal(nextFireReviewFrame(5),null);
});
test('manual review rejects invalid and out-of-order frame indices instead of wrapping',()=>{
 for(const frame of [-1,1.5,6,Infinity,NaN])assert.throws(()=>nextFireReviewFrame(frame),RangeError);
 assert.equal(nextFireReviewFrame(0),1);
});


test('accepted nonlethal hit flashes and recoils only after projectile arrival',()=>{
 const travel=isoHitReactionAt(639,1600,.4,false);
 assert.deepEqual(travel,{phase:'travel',flash:0,opacity:1,recoil:0});
 const impact=isoHitReactionAt(640,1600,.4,false);
 assert.equal(impact.phase,'impact');
 assert.equal(impact.flash,1);
 assert.equal(impact.opacity,1);
 const middle=isoHitReactionAt(1120,1600,.4,false);
 assert.equal(middle.phase,'impact');
 assert.ok(middle.recoil>.15);
 assert.equal(middle.opacity,1);
 assert.equal(isoHitReactionAt(1600,1600,.4,false).phase,'done');
});

test('lethal hit stays visible until impact then fades without changing damage',()=>{
 assert.equal(isoHitReactionAt(639,1600,.4,true).opacity,1);
 assert.equal(isoHitReactionAt(640,1600,.4,true).opacity,1);
 const late=isoHitReactionAt(1360,1600,.4,true);
 assert.equal(late.phase,'impact');
 assert.ok(late.opacity>0&&late.opacity<1);
 assert.deepEqual(isoHitReactionAt(1600,1600,.4,true),
  {phase:'done',flash:0,opacity:1,recoil:0});
 for(const invalid of [NaN,Infinity,-Infinity])
  assert.equal(isoHitReactionAt(invalid,1600,.4,true).phase,'done');
 assert.equal(isoHitReactionAt(500,0,.4,true).phase,'done');
 assert.equal(isoHitReactionAt(500,1600,1,true).phase,'done');
});
