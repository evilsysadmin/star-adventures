import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileGroundVisualScene,groundCellId} from
 '../src/groundVisual/compileGroundVisualScene';
import {tileCatalog} from '../src/groundVisual/tileCatalog';
import {prefabCatalog} from '../src/groundVisual/prefabCatalog';
import * as THREE from 'three';
import {addExteriorGeologicalTerraces,K47_EXTERIOR_TERRACES}
 from '../src/groundVisual/exteriorGeologicalTerraces';

// Playwright executes tests in Node ESM (no bare JSON import). Read the
// actual authored fixture instead of copying walls/stations into the test.
const surface=(JSON.parse(readFileSync(
 fileURLToPath(new URL('../../content/scenes/meridian.json',import.meta.url)),
 'utf8')) as {scenes:{surface:{
  width:number;height:number;walls:Array<{x:number;y:number}>;
  objects:Array<{x:number;y:number}>
 }}}).scenes.surface;
const region={x:3,y:4,width:4,height:3};
const prefab={id:'prefab.recessed-service-trench-2x1' as const,anchor:{x:3,y:5}};
const key=(p:{x:number;y:number})=>groundCellId(p.x,p.y);
const blocked=new Set([...surface.walls,...surface.objects].map(key));
const input=(explored:ReadonlySet<string>)=>({
 width:surface.width,height:surface.height,
 walls:surface.walls,objects:surface.objects,explored,
});
const allKnown=new Set(Array.from({length:surface.height},(_,y)=>
 Array.from({length:surface.width},(_,x)=>groundCellId(x,y))).flat());

test('compiler reuses real K-47 map, never creates phantom walkability or mission cells',()=>{
 const before=JSON.stringify(surface);
 const plan=compileGroundVisualScene(input(allKnown),region,prefab);
 expect(plan.tiles.length).toBeGreaterThanOrEqual(8);
 expect(plan.tiles.length).toBeLessThanOrEqual(12);
 expect(new Set(plan.tiles.map(x=>x.cellId)).size).toBe(plan.tiles.length);
 expect(plan.prefabs).toHaveLength(1);
 expect(plan.prefabs[0].footprint).toEqual(['3,5','4,5']);
 for(const placement of plan.tiles){
  expect(placement.kind).toBe('tile');
  expect(placement.assetId in tileCatalog).toBe(true);
  expect(placement.cellId).toBe(key(placement.cell));
  expect(placement.cell.x).toBeGreaterThanOrEqual(3);
  expect(placement.cell.x).toBeLessThanOrEqual(6);
  expect(placement.cell.y).toBeGreaterThanOrEqual(4);
  expect(placement.cell.y).toBeLessThanOrEqual(6);
  expect(blocked.has(placement.cellId)).toBe(false);
 }
 for(const edge of plan.edges){
  expect(blocked.has(edge.cellId)).toBe(false);
  expect(blocked.has(edge.blockedNeighbor)).toBe(true);
  expect(edge.assetId in tileCatalog).toBe(true);
 }
 for(const cell of plan.prefabs.flatMap(p=>p.footprint))
  expect(blocked.has(cell)).toBe(false);
 expect(JSON.stringify(surface)).toBe(before);
});

test('unknown wall, unknown floor, invalid region and invalid prefab fail closed',()=>{
 const known=new Set(['3,4','4,4','3,5','4,5','5,4','5,5']);
 const plan=compileGroundVisualScene(input(known),region,prefab);
 expect(plan.tiles.map(p=>p.cellId).sort()).toEqual([...known].sort());
 expect(plan.edges).toHaveLength(0); // all adjacent blockers remain unknown
 expect(plan.prefabs[0].footprint).toEqual(['3,5','4,5']);
 const partial=compileGroundVisualScene(input(new Set(['3,5'])),region,prefab);
 expect(partial.tiles.map(p=>p.cellId)).toEqual(['3,5']);
 expect(partial.prefabs).toHaveLength(0);
 const wallsKnown=new Set([...known,'6,4','4,6']);
 const edged=compileGroundVisualScene(input(wallsKnown),region,prefab);
 expect(edged.edges.some(x=>x.blockedNeighbor==='6,4')).toBe(true);
 expect(edged.edges.some(x=>x.blockedNeighbor==='4,6')).toBe(true);
 expect(edged.tiles.some(x=>blocked.has(x.cellId))).toBe(false);
 const invalid=compileGroundVisualScene(input(allKnown),
  {x:-1,y:4,width:4,height:3},prefab);
 expect(invalid).toEqual({tiles:[],edges:[],rocks:[],prefabs:[]});
 const occupiedPrefab=compileGroundVisualScene(input(allKnown),
  {x:3,y:5,width:4,height:3},{
   id:'prefab.recessed-service-trench-2x1',anchor:{x:3,y:7},
  });
 expect(occupiedPrefab.prefabs).toHaveLength(0);
});

test('compiler is deterministic regardless of source ordering and catalog has reusable pieces',()=>{
 const worldA=input(allKnown);
 const worldB={...worldA,
  walls:[...worldA.walls].reverse(),
  objects:[...worldA.objects].reverse(),
  explored:new Set([...allKnown].reverse()),
 };
 const one=compileGroundVisualScene(worldA,region,prefab);
 const two=compileGroundVisualScene(worldB,region,prefab);
 expect(two).toEqual(one);
 expect(Object.keys(tileCatalog)).toHaveLength(13);
 expect(prefabCatalog['prefab.recessed-service-trench-2x1']).toMatchObject({
  width:2,depth:1,clearance:'flush-floor',
 });
});

test('wide industrial and geological terrain uses only KNOWN canonical cells',()=>{
 const wide={x:0,y:0,width:12,height:10};
 const plan=compileGroundVisualScene(input(allKnown),wide,prefab);
 expect(plan.tiles.length).toBeGreaterThan(40);
 expect(plan.tiles.length).toBeLessThan(120);
 expect(plan.rocks.length).toBeGreaterThan(0);
 expect(plan.tiles.some(p=>p.assetId==='floor.rock-bedded'||
  p.assetId==='floor.rock-scree')).toBe(true);
 expect(plan.tiles.some(p=>p.assetId==='floor.metal')).toBe(true);
 expect(plan.edges.some(p=>p.assetId==='edge.platform-lip')).toBe(true);
 expect(new Set(plan.tiles.map(p=>p.cellId)).size).toBe(plan.tiles.length);
 for(const rock of plan.rocks){
  expect(surface.walls.some(p=>key(p)===rock.cellId)).toBe(true);
  expect(blocked.has(rock.cellId)).toBe(true);
  expect(plan.tiles.some(tile=>tile.cellId===rock.cellId)).toBe(false);
  expect(rock.material.startsWith('rock.')).toBe(true);
 }
 for(const edge of plan.edges){
  expect(allKnown.has(edge.cellId)).toBe(true);
  expect(allKnown.has(edge.blockedNeighbor)).toBe(true);
 }
 // Reuse real saves/exploration state as the only discovery authority.
 const onlyStart=new Set(['4,4','5,4','5,5','6,5','7,4','4,5']);
 const fog=compileGroundVisualScene(input(onlyStart),wide,prefab);
 expect(fog.tiles.map(p=>p.cellId).sort()).toEqual([...onlyStart].sort());
 expect(fog.rocks).toHaveLength(0);
 expect(fog.edges).toHaveLength(0);
 expect(fog.prefabs).toHaveLength(0);
 expect(compileGroundVisualScene(input(allKnown),wide,prefab))
  .toEqual(plan);
});

test('authored exterior rock bands remain strictly beyond the game footprint',()=>{
 expect(K47_EXTERIOR_TERRACES.map(x=>x.edge)).toEqual([
  'west','north','south',
 ]);
 const parent=new THREE.Group();
 const cleanup=addExteriorGeologicalTerraces(parent);
 expect(parent.children).toHaveLength(3);
 let triangles=0;
 for(const child of parent.children){
  expect(child).toBeInstanceOf(THREE.Mesh);
  const mesh=child as THREE.Mesh;
  expect(mesh.name).toMatch(/^modular-exterior-terrace-/);
  const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const idx=mesh.geometry.getIndex();
  expect(pos.count).toBeGreaterThan(100);
  expect(idx?.count).toBeGreaterThan(100);
  triangles+=(idx?.count||0)/3;
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
   expect(x<-.5||z<-.5||z>11.5).toBe(true);
   expect(y).toBeGreaterThan(0);
  }
 }
 expect(triangles).toBeGreaterThan(500);
 cleanup();
 expect(parent.children).toHaveLength(0);
});
