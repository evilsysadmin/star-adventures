import * as THREE from 'three';
import {tileCatalog,type TerrainTileId,type EdgeTileId} from './tileCatalog';
import type {GroundVisualPlan,EdgeSide,TilePlacement} from './compileGroundVisualScene';
import {makeWorldTerrainTexture,TERRAIN_WORLD_WIDTH,TERRAIN_WORLD_HEIGHT}
 from './worldTerrainTexture';
import {addExteriorGeologicalTerraces,K47_EXTERIOR_TERRACES}
 from './exteriorGeologicalTerraces';
import {addIndustrialApron3D} from './IndustrialApron3D';

// ONE existing orthographic canvas. The visual compiler never owns picking.
// The terrain has world UVs rather than a repeated per-cell image: material
// boundaries blend with continuous deposits, cracks and industrial scuffing.
const edgePose:Record<EdgeSide,{dx:number;dz:number;rotation:number}>={
 north:{dx:0,dz:-.475,rotation:0},
 east:{dx:.475,dz:0,rotation:Math.PI/2},
 south:{dx:0,dz:.475,rotation:0},
 west:{dx:-.475,dz:0,rotation:Math.PI/2},
};
const catalogIds=Object.keys(tileCatalog) as Array<TerrainTileId|EdgeTileId>;
function batchedTerrainGeometry(placements:readonly TilePlacement[]){
 const pos:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const placement of placements){
  const {x,y:z}=placement.cell;
  const n=pos.length/3;
  for(const [px,pz] of [
    [x-.5,z-.5],[x-.5,z+.5],[x+.5,z+.5],[x+.5,z-.5],
  ]){
   pos.push(px,.048,pz);
   uv.push((px+.5)/TERRAIN_WORLD_WIDTH,
     1-(pz+.5)/TERRAIN_WORLD_HEIGHT);
  }
  indices.push(n,n+1,n+2,n,n+2,n+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',
  new THREE.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

// An authored reusable 8-sided fractured basalt outcrop. All instances sit
// on REAL blocked, already explored scene.walls, never walkable ground.
function rockGeometry(){
 const pos:number[]=[],indices:number[]=[];
 const n=8;
 for(const [j,r,h] of [[0,.46,.035],[1,.50,.31],[2,.39,.77]]){
  for(let i=0;i<n;i++){
   const a=i*Math.PI*2/n;
   const noise=.92+(((i*3+j*5)%7)/7)*.18;
   pos.push(Math.cos(a)*r*noise,h+((i+j*3)%4)*.025,
    Math.sin(a)*r*noise);
  }
 }
 for(let ring=0;ring<2;ring++){
  for(let i=0;i<n;i++){
   const a=ring*n+i,b=ring*n+(i+1)%n;
   indices.push(a,b+n,b,a,a+n,b+n);
  }
 }
 const summit=pos.length/3;
 pos.push(.065,.99,-.04);
 for(let i=0;i<n;i++)indices.push(2*n+i,summit,2*n+(i+1)%n);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setIndex(indices);
 geo.computeVertexNormals();
 return geo;
}
export function addGroundVisualScene3D(scene:THREE.Scene,plan:GroundVisualPlan){
 const root=new THREE.Group();
 root.name='modular-ground-visual-scene';
 // These broad original off-map rock bands give the colony a surrounding
 // landscape without drawing an unknown in-map terrain cell.
 const disposeTerraces=addExteriorGeologicalTerraces(root);
 const disposables:Array<{dispose:()=>void}>=[];
 const prefabDisposers:Array<()=>void>=[];
 const texture=makeWorldTerrainTexture();
 if(texture)disposables.push(texture);
 const edgeGeometry=new THREE.BoxGeometry(.98,.083,.07);
 disposables.push(edgeGeometry);
 const dummy=new THREE.Object3D();
 // Batch per semantic material: one mesh for up to dozens of real cells,
 // while all groups use identical WORLD-space UVs (no 1x1 checkerboard).
 for(const assetId of catalogIds){
  const definition=tileCatalog[assetId];
  const mat=new THREE.MeshStandardMaterial({
   ...definition.material,
   ...(definition.kind==='terrain'&&texture?{map:texture}:{}),
   side:THREE.FrontSide,
  });
  disposables.push(mat);
  if(definition.kind==='terrain'){
   const cells=plan.tiles.filter(p=>p.assetId===assetId);
   if(!cells.length)continue;
   const geometry=batchedTerrainGeometry(cells);
   disposables.push(geometry);
   const mesh=new THREE.Mesh(geometry,mat);
   mesh.name='modular-'+assetId;
   mesh.receiveShadow=true;
   mesh.castShadow=false;
   root.add(mesh);
  }else{
   const borders=plan.edges.filter(p=>p.assetId===assetId);
   if(!borders.length)continue;
   const mesh=new THREE.InstancedMesh(edgeGeometry,mat,borders.length);
   mesh.name='modular-'+assetId;
   mesh.castShadow=false;
   mesh.receiveShadow=true;
   borders.forEach((edge,index)=>{
    const pose=edgePose[edge.side];
    dummy.position.set(edge.cell.x+pose.dx,.092,edge.cell.y+pose.dz);
    dummy.rotation.set(0,pose.rotation,0);
    dummy.scale.set(1,1,1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;
   root.add(mesh);
  }
 }
 if(plan.rocks.length){
  const geometry=rockGeometry();disposables.push(geometry);
  for(const kind of ['rock.bedrock','rock.fractured'] as const){
   const rocks=plan.rocks.filter(p=>p.material===kind);
   if(!rocks.length)continue;
   const material=new THREE.MeshStandardMaterial({
    color:kind==='rock.bedrock'?0x64766d:0x847d67,
    metalness:.04,roughness:1,flatShading:true,
   });
   disposables.push(material);
   const mesh=new THREE.InstancedMesh(geometry,material,rocks.length);
   mesh.name='modular-'+kind;
   mesh.receiveShadow=true;
   mesh.castShadow=true;
   rocks.forEach((rock,index)=>{
    const scale=.78+rock.variation*.035;
    dummy.position.set(rock.cell.x,.005,rock.cell.y);
    dummy.rotation.set(0,rock.variation*.58,0);
    dummy.scale.set(scale,.72+rock.variation*.045,scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;
   root.add(mesh);
  }
 }
 // Original flush-floor 2x1 service prefab. No fake walkable geometry.
 if(plan.prefabs.length){
  const trench=new THREE.BoxGeometry(1.77,.022,.27);
  const rail=new THREE.BoxGeometry(1.8,.035,.025);
  const pad=new THREE.MeshStandardMaterial({
   color:0x203b42,metalness:.52,roughness:.77});
  const trim=new THREE.MeshStandardMaterial({
   color:0xb4a47f,metalness:.52,roughness:.69});
  disposables.push(trench,rail,pad,trim);
  for(const placement of plan.prefabs){
   if(placement.assetId==='prefab.industrial-apron-3x2'){
    prefabDisposers.push(addIndustrialApron3D(root,
     placement.anchor.x,placement.anchor.y));
    continue;
   }
   const group=new THREE.Group();
   group.name='modular-'+placement.assetId;
   group.position.set(placement.anchor.x+.5,0,placement.anchor.y);
   const inset=new THREE.Mesh(trench,pad);
   inset.position.y=.066;group.add(inset);
   for(const side of [-1,1]){
    const rim=new THREE.Mesh(rail,trim);
    rim.position.set(0,.081,side*.163);
    rim.castShadow=false;group.add(rim);
   }
   root.add(group);
  }
 }
 root.userData.tileCount=plan.tiles.length;
 root.userData.edgeCount=plan.edges.length;
 root.userData.rockCount=plan.rocks.length;
 root.userData.exteriorTerraceCount=K47_EXTERIOR_TERRACES.length;
 root.userData.prefabCount=plan.prefabs.length;
 scene.add(root);
 return ()=>{
  scene.remove(root);
  disposeTerraces();
  for(const dispose of prefabDisposers)dispose();
  for(const resource of disposables)resource.dispose();
 };
}
