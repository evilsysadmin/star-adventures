import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  validateAuthoredSlots,eligibleAuthoredSlots,
  validateEmbeddedGlb,verifyPublishedGLBBytes,assertModelWithinFootprint,
} from '../src/k47EnvironmentAssets.ts';

const root=new URL('../../',import.meta.url);
const world=JSON.parse(readFileSync(new URL('content/scenes/meridian.json',root)))
  .scenes.surface;
const manifest=JSON.parse(readFileSync(
  new URL('content/scenes/k47-environment-art.json',root)));
const clone=()=>structuredClone(manifest);
function published(){
  const copy=clone();
  const slot=copy.slots[0];
  const sha256='a'.repeat(64);
  slot.status='published';
  slot.asset={
    url:'https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-'+sha256.slice(0,16)+'.glb',
    sha256,bytes:1024,license:'original',
    source:'ShadowOps K-47 authored PBR environment kit',
  };
  return copy;
}
function smallGLB(custom={}){
  const json={asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0}}]}],...custom};
  const encoded=Buffer.from(JSON.stringify(json));
  const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,0x20);
  encoded.copy(padded);
  const glb=Buffer.alloc(20+padded.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);
  glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);
  glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);
  return glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
}

test('all candidate art slots are real blocked, non-overlapping cells with no CDN request',()=>{
  assert.equal(validateAuthoredSlots(manifest,world).length,3);
  assert.deepEqual(eligibleAuthoredSlots(manifest,world,
    new Set(world.walls.map(x=>x.x+','+x.y))),[]);
  assert.deepEqual(manifest.slots.map(x=>x.status),
    ['unpublished','unpublished','unpublished']);
});
test('publication needs every exact blocked tile explored',()=>{
  const m=published();
  const discovered=new Set(['3,7','4,7','5,7','6,7']);
  assert.deepEqual(eligibleAuthoredSlots(m,world,discovered),[]);
  discovered.add('7,7');
  assert.deepEqual(eligibleAuthoredSlots(m,world,discovered).map(x=>x.id),
    ['south-industrial-shell']);
});
test('reject model slots on walkable or invented terrain',()=>{
  for(const wrong of [[5,4],[-1,7],[18,7]]){
    const m=clone();m.slots[0].footprint=[wrong];
    assert.throws(()=>validateAuthoredSlots(m,world),/footprint/);
  }
  const m=clone();
  m.slots[1].footprint=[[3,7]];
  assert.throws(()=>validateAuthoredSlots(m,world),/unique real blocked/);
});
test('unpublished assets are never fetched, and duplicate ids fail',()=>{
  const m=clone();m.slots[0].asset=published().slots[0].asset;
  assert.throws(()=>validateAuthoredSlots(m,world),/unpublished/);
  const m2=clone();m2.slots[1].id=m2.slots[0].id;
  assert.throws(()=>validateAuthoredSlots(m2,world),/duplicate/);
});
test('only immutable content-addressed R2 GLBs with license/provenance pass',()=>{
  assert.doesNotThrow(()=>validateAuthoredSlots(published(),world));
  for(const url of [
    'https://evil.example/art.glb',
    'http://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-aaaaaaaaaaaaaaaa.glb',
    'https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-aaaaaaaaaaaaaaaa.glb?x=1',
    'https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-bbbbbbbbbbbbbbbb.glb',
  ]){
    const m=published();m.slots[0].asset.url=url;
    assert.throws(()=>validateAuthoredSlots(m,world),/origin|content-addressed/);
  }
  const m=published();m.slots[0].asset.license='unknown';
  assert.throws(()=>validateAuthoredSlots(m,world),/license/);
});
test('GLB parser rejects invalid headers, external textures, buffers and extensions',()=>{
  assert.doesNotThrow(()=>validateEmbeddedGlb(smallGLB()));
  const bad=smallGLB();new DataView(bad).setUint32(0,0,true);
  assert.throws(()=>validateEmbeddedGlb(bad),/header/);
  assert.throws(()=>validateEmbeddedGlb(smallGLB({
    buffers:[{uri:'https://evil.example/binary.bin'}],
  })),/external buffers/);
  assert.throws(()=>validateEmbeddedGlb(smallGLB({
    images:[{uri:'https://evil.example/texture.png'}],
  })),/external textures/);
  assert.throws(()=>validateEmbeddedGlb(smallGLB({
    extensionsRequired:['KHR_draco_mesh_compression'],
  })),/extensions/);
});
test('3D bounds may occupy only the known blocked footprint, not free tiles',()=>{
  const slot=published().slots[0];
  const valid={min:{x:2.51,y:0,z:6.51},max:{x:7.49,y:4.2,z:7.49}};
  assert.doesNotThrow(()=>assertModelWithinFootprint(slot,valid));
  assert.throws(()=>assertModelWithinFootprint(slot,{
    min:{x:2.49,y:0,z:5.1},max:{x:7.49,y:4.2,z:7.49},
  }),/playable\/hidden/);
  assert.throws(()=>assertModelWithinFootprint(slot,{
    min:{x:2.51,y:0,z:6.51},max:{x:7.49,y:7,z:7.49},
  }),/taller/);
});

test('real SHA-256 verifies exact embedded GLB bytes and rejects mutation',async()=>{
  const model=smallGLB();
  const sha256=createHash('sha256').update(Buffer.from(model)).digest('hex');
  const m=published();m.slots[0].asset.sha256=sha256;
  m.slots[0].asset.bytes=model.byteLength;
  m.slots[0].asset.url=
    'https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/south-industrial-shell-'+sha256.slice(0,16)+'.glb';
  assert.doesNotThrow(()=>validateAuthoredSlots(m,world));
  await assert.doesNotReject(verifyPublishedGLBBytes(m.slots[0],model));
  const wrong=new Uint8Array(model.slice(0));
  wrong[wrong.length-1]^=1;
  await assert.rejects(verifyPublishedGLBBytes(m.slots[0],wrong.buffer),/SHA-256/);
  const truncated=model.slice(0,model.byteLength-1);
  await assert.rejects(verifyPublishedGLBBytes(m.slots[0],truncated),/byte count/);
  const unpub=clone().slots[0];
  await assert.rejects(verifyPublishedGLBBytes(unpub,model),/unpublished/);
});
