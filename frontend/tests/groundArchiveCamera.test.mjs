import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three';
import {makeGroundArchiveCamera,ARCHIVE_RENDER_HEIGHT,ARCHIVE_RENDER_WIDTH} from '../src/groundArchiveCamera.ts';

test('3D ground plane projects to exact canonical isometric SVG tile centers',()=>{
  const camera=makeGroundArchiveCamera();
  const samples=[[0,0],[0,3],[2,2],[4,5],[8,6],[12,9],[1,8],[12,0]];
  for(const [x,z] of samples){
    const p=new Vector3(x,0,z).project(camera);
    const px=(p.x+1)*ARCHIVE_RENDER_WIDTH/2;
    const py=(1-p.y)*ARCHIVE_RENDER_HEIGHT/2;
    assert.ok(Math.abs(px-(440+(x-z)*40))<.001,
      'x mismatch for '+x+','+z+': '+px);
    assert.ok(Math.abs(py-(52+(x+z)*20))<.001,
      'y mismatch for '+x+','+z+': '+py);
  }
});

test('height changes rendering only; cells keep their unchanged x/z anchor',()=>{
  const camera=makeGroundArchiveCamera();
  const floor=new Vector3(0,0,4).project(camera);
  const roof=new Vector3(0,2.5,4).project(camera);
  assert.ok(Math.abs(floor.x-roof.x)<1e-8);
  assert.ok(roof.y>floor.y);
  assert.ok(Math.abs((roof.y-floor.y)*ARCHIVE_RENDER_HEIGHT/2-
    2.5*20*Math.sqrt(6))<.01);
});
