import {expect,test} from '@playwright/test';
import * as THREE from 'three';
import {
 addGroundVisualScene3D,createWorldAlignedTerrainGeometry,GROUND_ATLAS_SPAN,
} from '../src/groundVisual/GroundVisualScene3D';
import {
 SURFACE_SIZE,makeGroundSurfacePixels,surfaceFamilies,
} from '../src/groundVisual/groundSurfacePatterns';

const tile=(x:number,y:number)=>({cell:{x,y}});

test('adjacent original tiles share precise world-space UV boundaries',()=>{
 const geometry=createWorldAlignedTerrainGeometry([tile(3,4),tile(4,4)]);
 const positions=geometry.getAttribute('position') as THREE.BufferAttribute;
 const uv=geometry.getAttribute('uv') as THREE.BufferAttribute;
 expect(positions.count).toBe(8);
 expect(geometry.getIndex()?.count).toBe(12);
 expect(uv.getX(2)).toBe(uv.getX(4));
 expect(uv.getX(3)).toBe(uv.getX(5));
 expect(uv.getY(2)).toBe(uv.getY(5));
 expect(uv.getY(3)).toBe(uv.getY(4));
 expect(uv.getX(0)).toBe(3/GROUND_ATLAS_SPAN);
 expect(uv.getX(6)).toBe(5/GROUND_ATLAS_SPAN);
 expect(positions.getY(0)).toBeCloseTo(.042);
 expect(positions.getY(7)).toBeCloseTo(.042);
 geometry.dispose();
});

test('fog expansion never slides texture on an already known tile',()=>{
 const known=createWorldAlignedTerrainGeometry([tile(3,4)]);
 const expanded=createWorldAlignedTerrainGeometry([tile(2,4),tile(3,4)]);
 const oldUV=known.getAttribute('uv') as THREE.BufferAttribute;
 const expandedUV=expanded.getAttribute('uv') as THREE.BufferAttribute;
 for(let corner=0;corner<4;corner++){
  expect(expandedUV.getX(4+corner)).toBe(oldUV.getX(corner));
  expect(expandedUV.getY(4+corner)).toBe(oldUV.getY(corner));
 }
 known.dispose();
 expanded.dispose();
});

test('semantic families reuse one real texture and batch flat terrain by material',()=>{
 const scene=new THREE.Scene();
 const dispose=addGroundVisualScene3D(scene,{
  tiles:[
   {kind:'tile',cell:{x:3,y:4},cellId:'3,4',
    assetId:'floor.concrete',rotation:0},
   {kind:'tile',cell:{x:4,y:4},cellId:'4,4',
    assetId:'floor.concrete-worn',rotation:1},
  ],
  edges:[],prefabs:[],
 });
 const root=scene.getObjectByName('modular-ground-visual-scene') as THREE.Group;
 expect(root).toBeTruthy();
 expect(root.userData.tileCount).toBe(2);
 expect(root.children).toHaveLength(2);
 const first=root.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 const second=root.children[1] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 expect(first.isMesh).toBe(true);
 expect(second.isMesh).toBe(true);
 expect(first).not.toBeInstanceOf(THREE.InstancedMesh);
 expect(second).not.toBeInstanceOf(THREE.InstancedMesh);
 expect(first.material.map).toBe(second.material.map);
 expect(first.geometry.getAttribute('uv').count).toBe(4);
 dispose();
 expect(scene.children).toHaveLength(0);
});

test('large-scale textures stay deterministic, original and opaque',()=>{
 for(const family of surfaceFamilies){
  const a=makeGroundSurfacePixels(family);
  const b=makeGroundSurfacePixels(family);
  expect(a).toEqual(b);
  expect(a).toHaveLength(SURFACE_SIZE*SURFACE_SIZE*4);
  let opaque=true;
  for(let index=3;index<a.length;index+=4){
   if(a[index]!==255){opaque=false;break;}
  }
  expect(opaque).toBe(true);
  // Not a single flat paint color or a 64px pattern copied four times.
  expect(a.slice(0,256)).not.toEqual(a.slice(256*64*4,256*64*4+256));
 }
});
