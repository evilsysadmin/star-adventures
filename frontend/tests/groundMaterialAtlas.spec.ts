import {expect,test} from '@playwright/test';
import * as THREE from 'three';
import {tileCatalog} from '../src/groundVisual/tileCatalog';
import {SURFACE_SIZE,makeGroundSurfacePixels,surfaceFamilies} from
 '../src/groundVisual/groundSurfacePatterns';
import {addGroundVisualScene3D} from '../src/groundVisual/GroundVisualScene3D';
import type {GroundVisualPlan} from '../src/groundVisual/compileGroundVisualScene';

test('semantic micro-surfaces are deterministic, opaque and visibly distinct',()=>{
 const patterns=surfaceFamilies.map(family=>{
  const first=makeGroundSurfacePixels(family);
  const second=makeGroundSurfacePixels(family);
  expect(first).toEqual(second);
  expect(first).toHaveLength(SURFACE_SIZE*SURFACE_SIZE*4);
  const gray:number[]=[];
  for(let i=0;i<first.length;i+=4){
   expect(first[i+3]).toBe(255);
   gray.push(first[i]);
  }
  expect(new Set(gray).size).toBeGreaterThan(9);
  expect(Math.min(...gray)).toBeGreaterThanOrEqual(191);
  return [...first];
 });
 for(let i=0;i<patterns.length;i++)
  for(let j=i+1;j<patterns.length;j++)
   expect(patterns[i]).not.toEqual(patterns[j]);
 expect(Object.values(tileCatalog).filter(x=>x.kind==='terrain')).toHaveLength(6);
 expect(Object.values(tileCatalog).filter(x=>x.kind==='edge')).toHaveLength(2);
});

test('shared surface families preserve instance batching and dispose once',()=>{
 const scene=new THREE.Scene();
 const assets=['floor.concrete','floor.concrete-worn','floor.metal',
  'floor.metal-weathered','floor.rock-transition','floor.sand-dust'] as const;
 const plan:GroundVisualPlan={
  tiles:assets.map((assetId,index)=>({
   kind:'tile' as const,assetId,cell:{x:index,y:4},
   cellId:index+',4',rotation:0 as const,
  })),
  edges:[],prefabs:[],
 };
 const cleanup=addGroundVisualScene3D(scene,plan);
 const root=scene.getObjectByName('modular-ground-visual-scene') as THREE.Group;
 expect(root.userData.tileCount).toBe(6);
 expect(root.userData.edgeCount).toBe(0);
 expect(root.children).toHaveLength(6);
 const surfaces=assets.map(assetId=>{
  const mesh=root.getObjectByName('modular-'+assetId) as THREE.InstancedMesh;
  expect(mesh.count).toBe(1);
  const mat=mesh.material as THREE.MeshStandardMaterial;
  expect(mat.map).not.toBeNull();
  expect(mat.map?.isDataTexture).toBe(true);
  return mat.map!;
 });
 expect(surfaces[0]).toBe(surfaces[1]);
 expect(surfaces[2]).toBe(surfaces[3]);
 expect(new Set(surfaces).size).toBe(4);
 let disposals=0;
 surfaces[2].addEventListener('dispose',()=>{disposals++;});
 cleanup();
 expect(scene.children).toHaveLength(0);
 expect(disposals).toBe(1);
});
