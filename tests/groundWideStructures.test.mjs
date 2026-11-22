import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeGroundExpansion} from '../src/groundWideLayout.mjs';
import {buildWideTerrainKit} from '../src/groundWideTerrainKit.mjs';
import {buildWideConnectedStructures} from '../src/groundWideStructures.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const original=read('../content/scenes/meridian.json');
const plan=read('../content/scenes/k47-wide-plan.json');
const world=composeGroundExpansion(original,plan);
const scene=world.scenes.surface;
const barriers=buildWideTerrainKit(scene,plan.sectors).barriers;
const join=(cells)=>cells.map(c=>c.key).join(';');
const structures=(subset=barriers)=>buildWideConnectedStructures(subset,scene.width,scene.height);

test('actual geological and industrial silhouettes join 3+ genuinely solid adjacent cells',()=>{
 const groups=structures();
 const at=(style,coords)=>groups.find(s=>s.style===style&&join(s.cells)===coords);
 assert.ok(at('rock','20,3;21,3;22,3;23,3'),
   'upper ridge must become one continuous rock outcrop');
 assert.ok(at('freight','11,14;12,14;13,14;14,14;15,14'),
   'the loading yard must read as one freight compound');
 assert.ok(at('lab','25,10;25,11;25,12;25,13;25,14'),
   'lab north-west corner joins the full physical five-cell side facade');
 assert.ok(at('lab','29,10;29,11;29,12;29,13;29,14'),
   'lab north-east corner joins its full physical five-cell facade');
 assert.ok(groups.some(s=>s.style==='lab'&&s.length>=5&&s.axis==='x'),
   'the lower lab fence forms a continuous corridor');
 assert.ok(groups.every(s=>s.length>=3&&s.length<=7));
 assert.ok(groups.some(s=>s.axis==='x')&&groups.some(s=>s.axis==='y'));
});

test('all macro structures belong exactly to canonical blocked wall cells, never UI or logic',()=>{
 const before=JSON.stringify(scene),covered=new Set();
 const realWalls=new Set(scene.walls.map(w=>w.x+','+w.y));
 for(const s of structures()){
   assert.equal(s.length,s.cells.length);
   assert.equal(s.id,`${s.style}-${s.start.x}-${s.start.y}-${s.axis}`);
   for(let i=0;i<s.cells.length;i++){
     const c=s.cells[i];
     assert.ok(realWalls.has(c.key),'no decorative invisible collision at '+c.key);
     assert.ok(!covered.has(c.key),'a canonical wall cannot be represented twice');
     assert.ok(c.x>=18||c.y>=12,'do not re-author existing GLB structures');
     assert.ok(c.x>0&&c.x<31&&c.y>0&&c.y<19,
       'no huge scenery painted across world perimeter');
     if(i){
       const previous=s.cells[i-1];
       assert.equal(Math.abs(c.x-previous.x)+Math.abs(c.y-previous.y),1,
         'continuous structure must occupy physically adjacent cells');
     }
     covered.add(c.key);
   }
 }
 assert.ok(covered.size>=15,'should replace a meaningful number of tiny wall blocks');
 assert.equal(JSON.stringify(scene),before);
 assert.equal(scene.width*scene.height,640);
 assert.equal(new Set(barriers.map(w=>w.key)).size,223);
 assert.equal(scene.width*scene.height-scene.walls.length-scene.objects.length,412);
});

test('fog safely shortens connected walls: unknown gap cannot visually bridge into remote terrain',()=>{
 const stripe=barriers.filter(w=>w.wall==='rock'&&w.y===3&&w.x>=20&&w.x<=23);
 assert.equal(stripe.length,4);
 assert.equal(structures(stripe.slice(0,2)).length,0);
 const first=structures(stripe.slice(0,3));
 assert.equal(first.length,1);
 assert.equal(first[0].length,3);
 assert.deepEqual(first[0].cells.map(c=>c.key),['20,3','21,3','22,3']);
 const disconnected=structures(stripe.filter(w=>w.x!==21));
 assert.equal(disconnected.length,0);
 assert.ok(!first[0].cells.some(c=>c.key==='23,3'),
   'a fourth undiscovered blocked cell must not be rendered');
 assert.deepEqual(structures([...stripe].reverse()),structures(stripe),
   'recon order must not change the geometry of visible structures');
});

test('canonical walls keep their original 223 visual owners when merged or not merged',()=>{
 const all=structures();
 const grouped=new Set(all.flatMap(s=>s.cells.map(c=>c.key)));
 const singles=new Set(barriers.filter(b=>!grouped.has(b.key)).map(b=>b.key));
 const originalKeys=new Set(barriers.map(b=>b.key));
 assert.equal(grouped.size+singles.size,originalKeys.size);
 assert.deepEqual(new Set([...grouped,...singles]),originalKeys);
 assert.ok([...singles].some(k=>k.startsWith('0,')),
   'the world border continues to draw its legacy individual walls');
});

test('invalid, out of world or duplicate cells fail closed',()=>{
 assert.throws(()=>buildWideConnectedStructures(null,32,20),/Invalid/);
 assert.throws(()=>buildWideConnectedStructures([],101,20),/Invalid/);
 assert.throws(()=>buildWideConnectedStructures([...barriers,barriers[0]],32,20),/duplicate/);
 assert.throws(()=>buildWideConnectedStructures([{x:99,y:9,key:'99,9',wall:'rock'}],32,20),/Invalid/);
 assert.throws(()=>buildWideConnectedStructures([{x:10,y:4,key:'10,5',wall:'rock'}],32,20),/Invalid/);
});
