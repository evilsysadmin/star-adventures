import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeGroundExpansion} from '../src/groundWideLayout.mjs';
import {
 buildWideTerrainKit,WIDE_TERRAIN_FAMILIES,
} from '../src/groundWideTerrainKit.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const base=read('../content/scenes/meridian.json');
const plan=read('../content/scenes/k47-wide-plan.json');
const world=composeGroundExpansion(base,plan);
const scene=world.scenes.surface;
const key=p=>p.x+','+p.y;

test('exactly 640 floor ownerships, six distinct authored styles, zero new obstacles',()=>{
 const before=JSON.stringify(world);
 const kit=buildWideTerrainKit(scene,plan.sectors);
 assert.equal(kit.tiles.length,640);
 assert.equal(new Set(kit.tiles.map(key)).size,640);
 assert.equal(kit.barriers.length,223);
 assert.equal(new Set(kit.barriers.map(key)).size,223);
 assert.equal(new Set(kit.tiles.filter(t=>t.blocked).map(key)).size,228);
 assert.deepEqual(new Set(kit.tiles.map(x=>x.sectorId)),
  new Set(plan.sectors.map(s=>s.id)));
 assert.deepEqual(new Set(kit.tiles.map(x=>x.family)),
  new Set(Object.values(WIDE_TERRAIN_FAMILIES).map(x=>x.id)));
 assert.deepEqual(new Set(kit.barriers.map(x=>x.wall)),
  new Set(['service','rock','freight','lab']));
 const canonicalWall=new Set(scene.walls.map(key));
 assert.deepEqual(new Set(kit.barriers.map(key)),canonicalWall,
  'visual walls must match EXACT authoritative blocked cells');
 const canonicalBlocking=new Set([...scene.walls,...scene.objects].map(key));
 assert.deepEqual(new Set(kit.tiles.filter(t=>t.blocked).map(key)),canonicalBlocking);
 assert.equal(JSON.stringify(world),before,'terrain must not rewrite real rules or stations');
});

test('north/south and lab floor+walls have different themed styles, not noise on one generic tile',()=>{
 const kit=buildWideTerrainKit(scene,plan.sectors);
 const tile=(x,y)=>kit.tiles.find(t=>t.x===x&&t.y===y);
 const barrier=(x,y)=>kit.barriers.find(t=>t.x===x&&t.y===y);
 for(const [x,y,family] of [
  [4,5,'landing-deck'],[11,5,'service-steel'],
  [24,5,'ridge-shale'],[18,15,'freight-concrete'],
  [27,13,'lab-ceramic'],[5,16,'weathered-steppe'],
 ])assert.equal(tile(x,y).family,family, x+','+y);
 assert.equal(barrier(21,3).wall,'rock');
 assert.equal(barrier(11,14).wall,'freight');
 assert.equal(barrier(25,12).wall,'lab');
 assert.equal(tile(27,10).blocked,false,'north lab doorway remains real');
 assert.equal(tile(27,15).blocked,false,'south lab doorway remains real');
});

test('terrain generation is repeatable without hidden runtime random or save state',()=>{
 const first=buildWideTerrainKit(scene,plan.sectors);
 assert.deepEqual(buildWideTerrainKit(structuredClone(scene),
  structuredClone(plan.sectors)),first);
 assert.equal(first.tiles.filter(t=>t.family==='ridge-shale')
   .some(t=>t.variant>0),true);
 assert.ok(first.tiles.every(t=>Number.isSafeInteger(t.variant)&&
   Number.isSafeInteger(t.grain)));
 assert.ok(first.barriers.every(w=>w.variant>=0&&w.variant<4));
});

test('invalid layouts or missing family definitions fail closed',()=>{
 const run=(s=scene,z=plan.sectors)=>()=>buildWideTerrainKit(s,z);
 assert.throws(run({...scene,width:101}),/world dimensions/);
 assert.throws(run(scene,plan.sectors.slice(1)),/six sector/);
 assert.throws(run(scene,plan.sectors.map(s=>({...s,id:'landing'}))),/authored sector/);
 assert.throws(run({...scene,walls:[...scene.walls,{x:0,y:0}]}),/duplicate physical wall/);
 assert.throws(run({...scene,objects:[...scene.objects,{x:31,y:0}]}),/overlapping real station/);
});
