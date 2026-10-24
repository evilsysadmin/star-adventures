import test from 'node:test';
import assert from 'node:assert/strict';
import { cells, projectCell, pickCell, cellCenter } from '../src/tacticalGrid.ts';
import { createIsoCamera } from '../src/tacticalIsoCamera.ts';
import { createIsoDetailCamera, ISO_DETAIL_ZOOM } from '../src/tacticalIsoFocus.ts';

test('focus is opt-in; base camera and 64/64 ids remain completely unchanged',()=>{
  const rect={left:103,top:211,width:338,height:350};
  const before=createIsoCamera(rect.width/rect.height);
  const after=createIsoCamera(rect.width/rect.height);
  for(const cell of cells()){
    assert.deepEqual(projectCell(cell,before,rect),projectCell(cell,after,rect));
    const p=projectCell(cell,after,rect);
    assert.equal(pickCell(p.x,p.y,after,rect)?.id,cell.id);
  }
});

for(const [w,h] of [[320,440],[350,460],[390,480],[1150,500]]){
  test(`detail camera centers chosen tiles without breaking grid ray selection at ${w}×${h}`,()=>{
    const rect={left:147,top:253,width:w,height:h};
    const detail=createIsoDetailCamera(w/h,{col:3,row:3});
    assert.equal(detail.zoom,ISO_DETAIL_ZOOM);
    const original=createIsoCamera(w/h);
    const chosen={col:3,row:3,id:'3:3'};
    const p=projectCell(chosen,detail,rect);
    assert.ok(p.x>rect.left&&p.x<rect.left+w,'focus must remain visible');
    assert.ok(p.y>rect.top&&p.y<rect.top+h,'focus must remain visible');
    assert.equal(pickCell(p.x,p.y,detail,rect)?.id,chosen.id);
    const near=['3:3','4:3','2:3','3:2','3:4'];
    for(const id of near){
      const [col,row]=id.split(':').map(Number);
      const at=projectCell({col,row,id},detail,rect);
      assert.ok(at.x>rect.left&&at.x<rect.left+w,id+' cropped x');
      assert.ok(at.y>rect.top&&at.y<rect.top+h,id+' cropped y');
      assert.equal(pickCell(at.x,at.y,detail,rect)?.id,id);
    }
    assert.ok(Math.abs(detail.position.distanceTo(original.position)-cellCenter(chosen).length())<1e-9);
  });
}

test('focus pan toward corners remains addressable after every recenter',()=>{
  const rect={left:20,top:50,width:326,height:470};
  for(const cell of cells()){
    const cam=createIsoDetailCamera(rect.width/rect.height,cell);
    const at=projectCell(cell,cam,rect);
    assert.ok(at.x>rect.left&&at.x<rect.left+rect.width,cell.id+' x clipped');
    assert.ok(at.y>rect.top&&at.y<rect.top+rect.height,cell.id+' y clipped');
    assert.equal(pickCell(at.x,at.y,cam,rect)?.id,cell.id);
  }
});

test('detail never accepts invalid zoom or focus, including nonintegral cells',()=>{
  for(const z of [0,.99,2.1,Infinity,NaN])
    assert.throws(()=>createIsoDetailCamera(1,{col:3,row:3},z),RangeError);
  for(const p of [{col:-1,row:0},{col:8,row:0},{col:1.5,row:1},{col:3,row:NaN}])
    assert.throws(()=>createIsoDetailCamera(1,p),RangeError);
});
