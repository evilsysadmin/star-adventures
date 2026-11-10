// Trust boundary for authored, published 3D art. This module is intentionally
// independent of React, Three and browser APIs: the actual tactical map owns
// every walkable cell, objective and explored/visible flag.
export type ArtCell = readonly [number,number];
export type ArtSlot = {
  id:string;
  footprint:ArtCell[];
  anchor:readonly [number,number,number];
  status:'unpublished'|'published';
  asset:null|{
    url:string;sha256:string;bytes:number;
    license:'original'|'CC0';
    source:string;
  };
};
export type ArtManifest = {
  schemaVersion:1;
  scene:'meridian.surface';
  slots:ArtSlot[];
};
export type AuthoredWorld = {
  width:number;height:number;
  walls:Array<{x:number;y:number}>;
};
const ASSET_BASE='https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/';
const hash=/^[0-9a-f]{64}$/;
const assetName=/^[a-z0-9-]+-([0-9a-f]{16})\.glb$/;
const MAX_MODEL_BYTES=4*1024*1024;
const MAX_MODEL_SLOTS=12;

function assert(condition:unknown,message:string):asserts condition{
  if(!condition)throw new Error('K47 art contract: '+message);
}
const cellKey=(x:number,y:number)=>x+','+y;

export function validateAuthoredSlots(manifest:ArtManifest,world:AuthoredWorld){
  assert(manifest.schemaVersion===1&&manifest.scene==='meridian.surface',
    'unknown schema or scene');
  assert(Array.isArray(manifest.slots)&&manifest.slots.length<=MAX_MODEL_SLOTS,
    'model budget exceeded');
  const blockers=new Set(world.walls.map(cell=>cellKey(cell.x,cell.y)));
  const ids=new Set<string>();
  const usedCells=new Set<string>();
  for(const slot of manifest.slots){
    assert(/^[a-z][a-z0-9-]{2,63}$/.test(slot.id)&&!ids.has(slot.id),
      'duplicate/unsafe slot id');
    ids.add(slot.id);
    assert(slot.footprint.length>=1&&slot.footprint.length<=12,
      'footprint is empty or oversized: '+slot.id);
    const own=new Set<string>();
    for(const cell of slot.footprint){
      assert(Array.isArray(cell)&&cell.length===2 &&
        cell.every(Number.isInteger), 'invalid footprint cell');
      const [x,y]=cell;
      assert(x>=0&&x<world.width&&y>=0&&y<world.height,
        'footprint exceeds canonical world');
      const key=cellKey(x,y);
      assert(blockers.has(key)&&!usedCells.has(key)&&!own.has(key),
        'art footprint must be a unique real blocked cell: '+key);
      own.add(key);usedCells.add(key);
    }
    const [x,y,z]=slot.anchor;
    assert(slot.anchor.length===3&&slot.anchor.every(Number.isFinite),
      'invalid anchor');
    const xs=slot.footprint.map(c=>c[0]),zs=slot.footprint.map(c=>c[1]);
    assert(x>=Math.min(...xs)-.5&&x<=Math.max(...xs)+.5&&
      z>=Math.min(...zs)-.5&&z<=Math.max(...zs)+.5&&
      y>=-.15&&y<=1,'asset origin off real blocked footprint');
    assert(slot.status==='unpublished'||slot.status==='published',
      'unexpected art status');
    if(slot.status==='unpublished'){
      assert(slot.asset===null,'unpublished art may not fetch');
      continue;
    }
    const asset=slot.asset;
    assert(!!asset&&hash.test(asset.sha256),'missing immutable checksum');
    assert(Number.isInteger(asset.bytes)&&asset.bytes>=32&&
      asset.bytes<=MAX_MODEL_BYTES,'GLB byte budget exceeded');
    assert(asset.license==='original'||asset.license==='CC0',
      'asset requires an original/CC0 license');
    assert(asset.source.length>=5&&asset.source.length<=512,
      'missing provenance');
    assert(asset.url.startsWith(ASSET_BASE),'untrusted asset origin');
    const rest=asset.url.slice(ASSET_BASE.length);
    const match=assetName.exec(rest);
    assert(!!match&&match[1]===asset.sha256.slice(0,16),
      'asset URL must be content-addressed .glb with no query');
  }
  return manifest.slots;
}

export function eligibleAuthoredSlots(
  manifest:ArtManifest,world:AuthoredWorld,explored:ReadonlySet<string>,
){
  return validateAuthoredSlots(manifest,world).filter(slot=>
    slot.status==='published'&&slot.footprint.every(([x,y])=>
      explored.has(cellKey(x,y))));
}

// Run this structural check BEFORE invoking any glTFLoader functionality.
// We only support self-contained GLB 2.0 files: external references and
// meshopt/Draco dependencies must not make extra unreviewed network requests.
export function validateEmbeddedGlb(bytes:ArrayBuffer):void{
  assert(bytes.byteLength>=32&&bytes.byteLength<=MAX_MODEL_BYTES,
    'GLB is empty or oversized');
  const view=new DataView(bytes);
  assert(view.getUint32(0,true)===0x46546c67 &&
    view.getUint32(4,true)===2&&
    view.getUint32(8,true)===bytes.byteLength,'invalid GLB header');
  const jsonLength=view.getUint32(12,true);
  assert(view.getUint32(16,true)===0x4e4f534a &&
    jsonLength>=2&&jsonLength%4===0&&20+jsonLength<=bytes.byteLength,
    'missing JSON chunk');
  let json:Record<string,unknown>;
  try{
    json=JSON.parse(new TextDecoder().decode(
      new Uint8Array(bytes,20,jsonLength)).trim());
  }catch{
    throw new Error('K47 art contract: invalid JSON chunk');
  }
  assert((json.asset as {version?:string}|undefined)?.version==='2.0',
    'GLB must use glTF 2.0');
  const buffers=json.buffers as Array<{uri?:string}>|undefined;
  const images=json.images as Array<{uri?:string;bufferView?:number}>|undefined;
  const extensions=json.extensionsRequired as string[]|undefined;
  assert(Array.isArray(json.meshes)&&json.meshes.length>0,
    'a published model must contain a mesh');
  assert(!buffers||buffers.every(buffer=>buffer.uri===undefined),
    'external buffers are forbidden');
  assert(!images||images.every(img=>img.uri===undefined&&
    Number.isInteger(img.bufferView)),
    'external textures are forbidden; embed images in GLB');
  assert(!extensions||extensions.length===0,
    'unsupported required extensions');
}

export async function verifyPublishedGLBBytes(slot:ArtSlot,bytes:ArrayBuffer){
  const asset=slot.asset;
  assert(slot.status==='published'&&!!asset,'cannot verify unpublished asset');
  assert(bytes.byteLength===asset.bytes,'GLB byte count does not match manifest');
  validateEmbeddedGlb(bytes);
  const digestBytes=await crypto.subtle.digest('SHA-256',bytes);
  const digest=Array.from(new Uint8Array(digestBytes),
    byte=>byte.toString(16).padStart(2,'0')).join('');
  assert(digest===asset.sha256,'GLB SHA-256 does not match manifest');
}

export function assertModelWithinFootprint(
  slot:ArtSlot,bounds:{min:{x:number;y:number;z:number};
    max:{x:number;y:number;z:number}},
){
  const xs=slot.footprint.map(c=>c[0]),zs=slot.footprint.map(c=>c[1]);
  const lowX=Math.min(...xs)-.5,highX=Math.max(...xs)+.5;
  const lowZ=Math.min(...zs)-.5,highZ=Math.max(...zs)+.5;
  const epsilon=.06;
  assert([bounds.min.x,bounds.min.y,bounds.min.z,
    bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite),
    'model has invalid bounds');
  assert(bounds.min.x>=lowX-epsilon&&bounds.max.x<=highX+epsilon&&
    bounds.min.z>=lowZ-epsilon&&bounds.max.z<=highZ+epsilon,
    'authored model would occupy playable/hidden ground');
  assert(bounds.min.y>=-.4&&bounds.max.y<=5,
    'art is taller/deeper than the approved scene envelope');
}
