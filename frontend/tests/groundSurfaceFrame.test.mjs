import test from 'node:test';
import assert from 'node:assert/strict';
import {groundSurfaceFrame} from '../src/groundSurfaceFrame.ts';

test('18×12 overview contains every authored tile tip and covers no fake input region',()=>{
 const frame=groundSurfaceFrame(18,12);
 assert.deepEqual(frame,{left:-72,top:0,width:1280,height:640});
 const project=(x,y)=>({x:440+(x-y)*40,y:52+(x+y)*20});
 for(let y=0;y<12;y++)for(let x=0;x<18;x++){
   const p=project(x,y);
   assert.ok(p.x-40>=frame.left&&p.x+40<=frame.left+frame.width,
     'tile x outside frame '+x+','+y);
   assert.ok(p.y-20>=frame.top&&p.y+20<=frame.top+frame.height,
     'tile y outside frame '+x+','+y);
 }
});
test('invalid surface sizes fail rather than creating impossible camera frames',()=>{
 for(const [w,h] of [[0,5],[18,0],[1,1],[101,10],[18,1],[10.5,12],[18,Infinity]])
  assert.throws(()=>groundSurfaceFrame(w,h),RangeError);
});
