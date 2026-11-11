import * as THREE from 'three';
import {tileCatalog,type VisualTileId} from './tileCatalog';
import type {GroundVisualPlan,EdgeSide} from './compileGroundVisualScene';
import {SURFACE_SIZE,makeGroundSurfacePixels,type SurfaceFamily} from './groundSurfacePatterns';

// One scene graph, ONE existing WebGL canvas. Never create a second renderer,
// camera, picking surface or render loop for modular terrain. Reuse materials
// and batch by tile ID with InstancedMesh (flat slabs, not 1x1 cubes).
const edgePose:Record<EdgeSide,{dx:number;dz:number;rotation:number}>={
 north:{dx:0,dz:-.455,rotation:0},
 east:{dx:.455,dz:0,rotation:Math.PI/2},
 south:{dx:0,dz:.455,rotation:0},
 west:{dx:-.455,dz:0,rotation:Math.PI/2},
};
const tileIds=(Object.keys(tileCatalog) as VisualTileId[]);
export function addGroundVisualScene3D(scene:THREE.Scene,plan:GroundVisualPlan){
 const root=new THREE.Group();
 root.name='modular-ground-visual-scene';
 const disposable:Array<{dispose:()=>void}>=[];
 const surfaceTextures=new Map<SurfaceFamily,THREE.DataTexture>();
 const textureFor=(family:SurfaceFamily)=>{
  const cached=surfaceTextures.get(family);
  if(cached)return cached;
  const texture=new THREE.DataTexture(
   makeGroundSurfacePixels(family),SURFACE_SIZE,SURFACE_SIZE,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  surfaceTextures.set(family,texture);
  disposable.push(texture);
  return texture;
 };
 const floor=new THREE.PlaneGeometry(1,1);
 floor.rotateX(-Math.PI/2);
 const border=new THREE.BoxGeometry(.92,.025,.055);
 disposable.push(floor,border);
 const dummy=new THREE.Object3D();
 for(const assetId of tileIds){
  const definition=tileCatalog[assetId];
  const placements=definition.kind==='terrain'
   ?plan.tiles.filter(x=>x.assetId===assetId)
   :plan.edges.filter(x=>x.assetId===assetId);
  if(!placements.length)continue;
  const material=new THREE.MeshStandardMaterial({
   ...definition.material,
   // Four original lightweight textures shared by all tile variants.
   // Instance counts, topology, fog and the existing pick layer stay identical.
   map:definition.kind==='terrain'?textureFor(definition.surface):null,
   side:THREE.FrontSide,
  });
  disposable.push(material);
  const mesh=new THREE.InstancedMesh(
   definition.kind==='terrain'?floor:border,material,placements.length);
  mesh.name='modular-'+assetId;
  mesh.receiveShadow=true;
  mesh.castShadow=false;
  placements.forEach((placement,index)=>{
   if(placement.kind==='tile'){
    dummy.position.set(placement.cell.x,.042,placement.cell.y);
    dummy.rotation.set(0,0,0);
   }else{
    const pose=edgePose[placement.side];
    dummy.position.set(
     placement.cell.x+pose.dx,.062,placement.cell.y+pose.dz);
    dummy.rotation.set(0,pose.rotation,0);
   }
   dummy.scale.set(1,1,1);
   dummy.updateMatrix();
   mesh.setMatrixAt(index,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  root.add(mesh);
 }
 // Reusable 2x1 prefabs are specified by footprint, not inferred from
 // geometry. This is a flush-floor service insert, not an invisible wall.
 if(plan.prefabs.length){
  const trench=new THREE.BoxGeometry(1.77,.022,.27);
  const rail=new THREE.BoxGeometry(1.8,.035,.025);
  const pad=new THREE.MeshStandardMaterial({
   color:0x203b42,metalness:.52,roughness:.77});
  const trim=new THREE.MeshStandardMaterial({
   color:0xb4a47f,metalness:.52,roughness:.69});
  disposable.push(trench,rail,pad,trim);
  for(const placement of plan.prefabs){
   const group=new THREE.Group();
   group.name='modular-'+placement.assetId;
   group.position.set(placement.anchor.x+.5,0,placement.anchor.y);
   const inset=new THREE.Mesh(trench,pad);
   inset.position.y=.056;
   group.add(inset);
   for(const side of [-1,1]){
    const rim=new THREE.Mesh(rail,trim);
    rim.position.set(0,.071,side*.163);
    rim.castShadow=false;
    group.add(rim);
   }
   root.add(group);
  }
 }
 root.userData.tileCount=plan.tiles.length;
 root.userData.edgeCount=plan.edges.length;
 root.userData.prefabCount=plan.prefabs.length;
 scene.add(root);
 return ()=>{
  scene.remove(root);
  for(const resource of disposable)resource.dispose();
 };
}
