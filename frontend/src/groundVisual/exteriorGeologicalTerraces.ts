import * as THREE from 'three';

// Reusable rocky terrain-band prefab, always OUTSIDE the canonical 18x12
// gameplay footprint. It frames the colony like a real excavation in a
// hostile landscape without revealing UNKNOWN in-map tiles, inventing paths,
// or interfering with the authoritative fog, unit input or collisions.
type Edge='west'|'north'|'south';
type Terrace={edge:Edge;start:number;length:number;depth:number};
export const K47_EXTERIOR_TERRACES:readonly Terrace[]=[
 {edge:'west',start:2.1,length:5.7,depth:1.3},
 {edge:'north',start:1.8,length:8.1,depth:1.45},
 {edge:'south',start:1.8,length:8.1,depth:1.3},
];
function geometryForTerrace({edge,start,length,depth}:Terrace){
 const across=6,along=26;
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const low=new THREE.Color('#1d3338');
 const mid=new THREE.Color('#3d5551');
 const high=new THREE.Color('#6f7568');
 const color=new THREE.Color();
 const height=(u:number,t:number)=>{
  // Low broken terrain behind the colony, not a monumental wall of
  // smooth green rock swallowing the scene. Shallow strata vary over
  // multiple tiles while the original planet gradient stays visible.
  const shelf=.018+u*.16+Math.max(0,u-.5)*.22;
  const weather=Math.sin(t*15.1+u*5.3)*.052+
    Math.sin(t*31.3-u*8.5)*.021+Math.cos(t*8.7+u*9.3)*.032;
  return Math.max(.01,shelf+weather*u);
 };
 for(let j=0;j<=along;j++){
  const t=j/along;
  for(let i=0;i<=across;i++){
   const u=i/across;
   // Ragged rear edge removes the former straight cut-out rectangle.
   const taper=.88+.12*Math.cos((t-.5)*Math.PI);
   const distance=depth*u*taper;
   let x:number,z:number;
   if(edge==='west'){x=-.56-distance;z=start+length*t;}
   else if(edge==='north'){x=start+length*t;z=-.56-distance;}
   else{x=start+length*t;z=11.55+distance;}
   const y=height(u,t);
   positions.push(x,y,z);
   color.copy(low).lerp(mid,Math.min(1,u*1.5));
   if(u>.58)color.lerp(high,(u-.58)*.52);
   const band=Math.sin(t*19.4+u*13.1)*.055+
      Math.cos(t*7.9-u*21.3)*.035;
   color.offsetHSL(0,0,band);
   colors.push(color.r,color.g,color.b);
  }
 }
 const stride=across+1;
 for(let j=0;j<along;j++){
  for(let i=0;i<across;i++){
   const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
   indices.push(a,c,b,b,c,d);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);
 geo.computeVertexNormals();
 return geo;
}
export function addExteriorGeologicalTerraces(parent:THREE.Group){
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,flatShading:true,roughness:1,metalness:.015,
  side:THREE.DoubleSide,
 });
 const meshes:THREE.Mesh[]=[];
 for(const descriptor of K47_EXTERIOR_TERRACES){
  const geom=geometryForTerrace(descriptor);
  const mesh=new THREE.Mesh(geom,material);
  mesh.name='modular-exterior-terrace-'+descriptor.edge;
  mesh.castShadow=false;mesh.receiveShadow=true;
  parent.add(mesh);meshes.push(mesh);
 }
 return ()=>{
  for(const mesh of meshes){parent.remove(mesh);mesh.geometry.dispose();}
  material.dispose();
 };
}
