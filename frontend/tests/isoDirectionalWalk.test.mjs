import test from 'node:test';
import assert from 'node:assert/strict';
import {WALK4_DIRECTIONS,walk4Direction,walk4Uv,validWalk4Dimensions} from '../src/isoDirectionalWalk.ts';
test('four orthogonal world headings select distinct authored views',()=>{
 for(const [from,to,direction] of [
  ['3:3','3:2','north'],['3:3','4:3','east'],
  ['3:3','3:4','south'],['3:3','2:3','west'],
  ['3:3','3:3',null],['3:3','4:4',null],['bad','3:4',null],
  ['-1:3','3:4',null]
 ])assert.equal(walk4Direction(from,to),direction);
});
test('all 24 UV cells select exactly one view and one animation frame',()=>{
 assert.equal(new Set(WALK4_DIRECTIONS).size,4);
 for(const [row,direction] of WALK4_DIRECTIONS.entries()){
  for(let frame=0;frame<6;frame++){
   const uv=walk4Uv(frame,direction);
   assert.equal(uv.x,frame/6);
   assert.equal(uv.y,1-(row+1)/4);
   assert.equal(uv.repeatX,1/6);
   assert.equal(uv.repeatY,1/4);
  }
  assert.deepEqual(walk4Uv(6,direction),walk4Uv(0,direction));
 }
 assert.throws(()=>walk4Uv(0,'diagonal'),RangeError);
 assert.throws(()=>walk4Uv(1.2,'north'),RangeError);
});
test('malformed or too-small CDN atlases fall back to V1',()=>{
 assert.equal(validWalk4Dimensions(1536,1536),true);
 for(const [w,h] of [[765,1024],[1535,1536],[1024,1024],[0,1536],[1536,255],[null,1536]])
  assert.equal(validWalk4Dimensions(w,h),false);
});
