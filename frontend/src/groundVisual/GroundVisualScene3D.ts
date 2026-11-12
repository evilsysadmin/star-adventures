import * as THREE from 'three';
import {tileCatalog,type VisualTileId} from './tileCatalog';
import type {GroundVisualPlan,EdgeSide} from './compileGroundVisualScene';
import {SURFACE_SIZE,WORLD_TILE_PERIOD,makeGroundSurfacePixels,makeGroundNormalPixels,type SurfaceFamily} from './groundSurfacePatterns';

// One scene graph, ONE existing WebGL canvas. Never create a second renderer,
// camera, picking surface or render loop for modular terrain. Reuse materials
// and batch tile families in contiguous world-UV meshes. Edge rails remain
// InstancedMesh. Tile geometry never changes the grid or picking.
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
 const normalTextures=new Map<SurfaceFamily,THREE.DataTexture>();
 const textureFor=(family:SurfaceFamily)=>{
  const cached=surfaceTextures.get(family);
  if(cached)return cached;
  const texture=new THREE.DataTexture(
   makeGroundSurfacePixels(family),SURFACE_SIZE,SURFACE_SIZE,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;
  texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  surfaceTextures.set(family,texture);
  disposable.push(texture);
  return texture;
 };
 const normalFor=(family:SurfaceFamily)=>{
  const cached=normalTextures.get(family);
  if(cached)return cached;
  const texture=new THREE.DataTexture(
   makeGroundNormalPixels(family),SURFACE_SIZE,SURFACE_SIZE,THREE.RGBAFormat);
  texture.colorSpace=THREE.NoColorSpace;
  texture.wrapS=THREE.RepeatWrapping;
  texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  normalTextures.set(family,texture);disposable.push(texture);
  return texture;
 };
 // A one-meter revealed square contributes two triangles with UVs anchored
 // to canonical WORLD coordinates. The same atlas crosses many tiles without
 // obvious repeated little patches; unvisited/blocked cells create no mesh.
 const floorGeometry=(placements:GroundVisualPlan['tiles'])=>{
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  placements.forEach(placement=>{
   const x=placement.cell.x,z=placement.cell.y;
   const base=positions.length/3;
   for(const [px,pz] of [[x-.5,z-.5],[x-.5,z+.5],
     [x+.5,z+.5],[x+.5,z-.5]]){
    positions.push(px,.042,pz);
    uv.push(px/WORLD_TILE_PERIOD,pz/WORLD_TILE_PERIOD);
   }
   indices.push(base,base+1,base+2,base,base+2,base+3);
  });
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geom.setIndex(indices);geom.computeVertexNormals();
  disposable.push(geom);
  return geom;
 };
 const useLegacyTiles=import.meta.env?.DEV&&typeof window!=='undefined'&&
  (window as typeof window & {__k47LegacyTiles?:boolean}).__k47LegacyTiles===true;
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
   normalMap:definition.kind==='terrain'&&!useLegacyTiles?normalFor(definition.surface):null,
   normalScale:new THREE.Vector2(.45,.45),
   side:THREE.DoubleSide,
  });
  disposable.push(material);
  // The normal production path uses one world-UV buffer per material.
  // A development-only legacy comparison keeps the previous instancing,
  // so visual screenshots can use identical camera, route and fog.
  const worldSurface=definition.kind==='terrain'&&!useLegacyTiles;
  const mesh=worldSurface
   ?new THREE.Mesh(floorGeometry(plan.tiles.filter(p=>p.assetId===assetId)),material)
   :new THREE.InstancedMesh(
      definition.kind==='terrain'?floor:border,material,placements.length);
  mesh.name='modular-'+assetId;
  mesh.receiveShadow=true;
  mesh.castShadow=false;
  if(mesh instanceof THREE.InstancedMesh){
  placements.forEach((placement,index)=>{
   if(placement.kind==='tile'){
    dummy.position.set(placement.cell.x,.042,placement.cell.y);
    dummy.rotation.set(0,placement.rotation*Math.PI/2,0);
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
  }
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
