import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import world from '../../../content/scenes/meridian.json';
import artManifest from '../../../content/scenes/k47-environment-art.json';
import {
  eligibleAuthoredSlots,validateEmbeddedGlb,assertModelWithinFootprint,
  type ArtManifest,type ArtSlot,
} from '../k47EnvironmentAssets';

// This is a real, optional authored asset loader, NOT a new gameplay renderer.
// R2 publishes immutable, SHA-256-proven, self-contained glTF .glb models.
// No asset is rendered if its actual blocked footprint is still in the fog,
// its bytes are incorrect, or its geometry would leak into walkable terrain.
// The existing SVG and PBR floor remain available during failures.
export type K47ArtResult={
  loadedIds:string[];
  failedIds:string[];
  dispose:()=>void;
};
const runtimeManifest=artManifest as unknown as ArtManifest;
const runtimeWorld=world.scenes.surface;
const loader=new GLTFLoader();

function disposeGroup(group:THREE.Object3D){
  const materials=new Set<THREE.Material>();
  const geometries=new Set<THREE.BufferGeometry>();
  const textures=new Set<THREE.Texture>();
  group.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    geometries.add(node.geometry);
    const entries=Array.isArray(node.material)?node.material:[node.material];
    for(const material of entries)if(material)materials.add(material);
  });
  for(const material of materials)
    for(const candidate of Object.values(material as unknown as Record<string,unknown>))
      if(candidate instanceof THREE.Texture)textures.add(candidate);
  for(const material of materials)material.dispose();
  for(const geometry of geometries)geometry.dispose();
  for(const texture of textures)texture.dispose();
}
function parseGLB(data:ArrayBuffer){
  return new Promise<THREE.Object3D>((resolve,reject)=>{
    loader.parse(data,'',gltf=>resolve(gltf.scene),reject);
  });
}
async function fetchVerifiedGLB(slot:ArtSlot,signal:AbortSignal){
  const asset=slot.asset;
  if(!asset)throw new Error('Unpublished art has no GLB');
  const response=await fetch(asset.url,{mode:'cors',cache:'force-cache',signal});
  if(!response.ok||response.type==='opaque')throw new Error('K47 art CDN returned an error');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==asset.bytes)
    throw new Error('K47 art CDN returned the wrong byte count');
  validateEmbeddedGlb(bytes);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  const digest=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==asset.sha256)throw new Error('K47 art CDN checksum mismatch');
  if(signal.aborted)throw new DOMException('Art load aborted','AbortError');
  const model=await parseGLB(bytes);
  if(signal.aborted){
    disposeGroup(model);
    throw new DOMException('Art load aborted','AbortError');
  }
  model.position.set(...slot.anchor);
  model.updateMatrixWorld(true);
  try{
    const bounds=new THREE.Box3().setFromObject(model);
    if(bounds.isEmpty())throw new Error('K47 art has no geometry');
    assertModelWithinFootprint(slot,bounds);
  }catch(error){
    disposeGroup(model);throw error;
  }
  model.name='K47-authored-'+slot.id;
  model.traverse(node=>{
    if(node instanceof THREE.Mesh){
      node.castShadow=true;node.receiveShadow=true;
    }
  });
  return model;
}

export async function addK47AuthoredEnvironment(
  scene:THREE.Scene,
  explored:ReadonlySet<string>,
  signal:AbortSignal,
):Promise<K47ArtResult>{
  const slots=eligibleAuthoredSlots(runtimeManifest,runtimeWorld,explored);
  const models:THREE.Object3D[]=[];
  const failedIds:string[]=[];
  for(const slot of slots){
    if(signal.aborted)break;
    try{
      const model=await fetchVerifiedGLB(slot,signal);
      if(signal.aborted){
        disposeGroup(model);break;
      }
      scene.add(model);models.push(model);
    }catch{
      if(signal.aborted)break;
      // A missing CDN object or invalid model MUST NOT hide working SVG or
      // alter fog/movement. No partially parsed geometry enters the scene.
      failedIds.push(slot.id);
    }
  }
  return {
    loadedIds:models.map(model=>model.name.slice('K47-authored-'.length)),
    failedIds,
    dispose(){
      for(const model of models){scene.remove(model);disposeGroup(model);}
    },
  };
}
export const K47_AUTHORED_SLOT_COUNT=runtimeManifest.slots.length;
export const K47_PUBLISHED_SLOT_COUNT=runtimeManifest.slots.filter(x=>x.status==='published').length;
