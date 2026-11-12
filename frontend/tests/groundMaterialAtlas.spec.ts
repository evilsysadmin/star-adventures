import {test,expect} from '@playwright/test';
import * as THREE from 'three';
import {SURFACE_SIZE,WORLD_TILE_PERIOD,surfaceFamilies,makeGroundSurfacePixels,makeGroundNormalPixels} from '../src/groundVisual/groundSurfacePatterns';
import {addGroundVisualScene3D} from '../src/groundVisual/GroundVisualScene3D';
import type {GroundVisualPlan} from '../src/groundVisual/compileGroundVisualScene';
test('deterministic 256px original material and normal maps have varied opaque pixels',()=>{
 const all=surfaceFamilies.map(family=>{
  const a=makeGroundSurfacePixels(family),b=makeGroundSurfacePixels(family);
  const normal=makeGroundNormalPixels(family);
  expect(a).toEqual(b);expect(a.length).toBe(SURFACE_SIZE*SURFACE_SIZE*4);
  expect(normal.length).toBe(a.length);
  const values=new Set<number>();let nonFlat=0;
  for(let i=0;i<a.length;i+=4){
   expect(a[i+3]).toBe(255);expect(normal[i+3]).toBe(255);
   values.add(a[i]);if(normal[i]!==128||normal[i+1]!==128)nonFlat++;
  }
  expect(values.size).toBeGreaterThan(35);
  expect(nonFlat).toBeGreaterThan(SURFACE_SIZE*SURFACE_SIZE/4);
  return a;
 });
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)
  expect(all[i]).not.toEqual(all[j]);
});
test('world-aligned texture UVs cross tile seams and reuse all four families',()=>{
 const scene=new THREE.Scene();
 const ids=['floor.concrete','floor.concrete-worn','floor.metal','floor.metal-weathered','floor.rock-transition','floor.sand-dust'] as const;
 const plan:GroundVisualPlan={tiles:[
  {kind:'tile',assetId:'floor.concrete',cell:{x:3,y:4},cellId:'3,4',rotation:0},
  {kind:'tile',assetId:'floor.concrete',cell:{x:4,y:4},cellId:'4,4',rotation:0},
  ...ids.slice(1).map((assetId,i)=>({kind:'tile' as const,assetId,cell:{x:i+5,y:4},cellId:(i+5)+',4',rotation:0 as const}))
 ],edges:[],prefabs:[]};
 const dispose=addGroundVisualScene3D(scene,plan);
 const root=scene.getObjectByName('modular-ground-visual-scene') as THREE.Group;
 expect(root.children.length).toBe(6);
 expect(root.userData.tileCount).toBe(7);
 const concrete=root.getObjectByName('modular-floor.concrete') as THREE.Mesh;
 expect(concrete.isMesh).toBe(true);
 expect(concrete.isInstancedMesh).not.toBe(true);
 const u=concrete.geometry.getAttribute('uv');
 expect(u.count).toBe(8);
 expect(u.getX(2)).toBeCloseTo(3.5/WORLD_TILE_PERIOD);
 expect(u.getX(4)).toBeCloseTo(3.5/WORLD_TILE_PERIOD);
 expect(u.getY(2)).toBeCloseTo(u.getY(6));
 const maps=ids.map(id=>(root.getObjectByName('modular-'+id) as THREE.Mesh).material as THREE.MeshStandardMaterial);
 expect(maps[0].map).toBe(maps[1].map);
 expect(maps[2].map).toBe(maps[3].map);
 expect(new Set(maps.map(m=>m.map)).size).toBe(4);
 expect(maps[0].normalMap?.isDataTexture).toBe(true);
 expect(maps[0].map?.wrapS).toBe(THREE.RepeatWrapping);
 let disposals=0;
 maps[0].map?.addEventListener('dispose',()=>{disposals++});
 dispose();expect(scene.children).toHaveLength(0);expect(disposals).toBe(1);
});
