import test from 'node:test';
import assert from 'node:assert/strict';
import {
 BOARD_SIZE, cells, cellCenter, projectCell, pickCell, assertBoardSize,
} from '../src/tacticalGrid.ts';
import { createIsoCamera } from '../src/tacticalIsoCamera.ts';
import { createIsoDetailCamera } from '../src/tacticalIsoFocus.ts';

test('unchanged default 8×8 board remains the exact same identity and projection contract',()=>{
 assert.equal(BOARD_SIZE,8);
 assert.equal(cells().length,64);
 assert.deepEqual(cells(),cells(8));
 const oldCenter=cellCenter({col:0,row:0});
 assert.deepEqual(oldCenter.toArray(),cellCenter({col:0,row:0},8).toArray());
});

for(const size of [8,10,12]){
 for(const width of [360,390,430,1280]){
  test(`iso ${size}×${size}: ${size*size}/${size*size} real raycasts @ ${width}px with CSS offset`,()=>{
   const rect={left:117,top:289,width:width-30,height:width===1280?520:420};
   const cam=createIsoCamera(rect.width/rect.height,size);
   const board=cells(size);
   assert.equal(board.length,size*size);
   assert.equal(new Set(board.map(c=>c.id)).size,board.length);
   for(const c of board){
    const p=projectCell(c,cam,rect,size);
    assert.ok(p.x>rect.left&&p.x<rect.left+rect.width,`${c.id} x out of view`);
    assert.ok(p.y>rect.top&&p.y<rect.top+rect.height,`${c.id} y out of view`);
    assert.equal(pickCell(p.x,p.y,cam,rect,size)?.id,c.id);
   }
   // The center of a cell is unchanged by higher DPR: CSS rect, never hardware pixels.
   for(const c of [board[0],board[size-1],board[board.length-1]]){
    const p=projectCell(c,cam,rect,size);
    assert.equal(pickCell(p.x,p.y,cam,rect,size)?.id,c.id);
   }
  });
 }
 test(`detail focus on every cell of ${size}×${size} remains pickable`,()=>{
   const rect={left:51,top:200,width:340,height:480};
   for(const c of cells(size)){
     const cam=createIsoDetailCamera(rect.width/rect.height,c,1.65,size);
     const p=projectCell(c,cam,rect,size);
     assert.ok(p.x>rect.left&&p.x<rect.left+rect.width,c.id);
     assert.ok(p.y>rect.top&&p.y<rect.top+rect.height,c.id);
     assert.equal(pickCell(p.x,p.y,cam,rect,size)?.id,c.id);
   }
 });
}

test('invalid board sizes and unsupported detail coordinates fail clearly',()=>{
 for(const size of [0,7,9,11,13,Infinity,NaN,-1]){
  assert.throws(()=>assertBoardSize(size),RangeError);
  assert.throws(()=>createIsoCamera(1,size),RangeError);
  assert.throws(()=>createIsoDetailCamera(1,{col:0,row:0},1.65,size),RangeError);
 }
 assert.throws(()=>createIsoDetailCamera(1,{col:12,row:0},1.65,12),RangeError);
 assert.throws(()=>createIsoDetailCamera(1,{col:0,row:10},1.65,10),RangeError);
});
