import test from 'node:test';
import assert from 'node:assert/strict';
import {isoSpriteSideFromCells,mirroredAtlasUv} from '../src/isoActorFacing.ts';
test('all orthogonal world headings map to actual projected left/right motion',()=>{
 for(const [from,to,expected] of [
  ['3:3','4:3','right'],['3:3','3:2','right'],
  ['3:3','2:3','left'],['3:3','3:4','left'],
  ['3:3','4:4',null],['3:3','2:2',null],['3:3','3:3',null],
 ])assert.equal(isoSpriteSideFromCells(from,to),expected);
});
test('mirrors each authored frame without sampling the next',()=>{
 for(let frame=0;frame<6;frame++){
  const a=mirroredAtlasUv(frame,false),b=mirroredAtlasUv(frame,true);
  assert.equal(a.x+1/3,b.x);
  assert.equal(a.y,b.y);
  assert.equal(a.repeatX,1/3);
  assert.equal(b.repeatX,-1/3);
 }
 assert.throws(()=>mirroredAtlasUv(0,true,0,2),RangeError);
});
