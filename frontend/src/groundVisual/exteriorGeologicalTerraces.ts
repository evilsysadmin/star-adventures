import * as THREE from 'three';

// Reusable rocky terrain-band prefab, always OUTSIDE the canonical 18x12
// gameplay footprint. It frames the colony like a real excavation in a
// hostile landscape without revealing UNKNOWN in-map tiles, inventing paths,
// or interfering with the authoritative fog, unit input or collisions.
type Edge='west'|'north'|'south';
type Terrace={edge:Edge;start:number;length:number;depth:number};
export const K47_EXTERIOR_TERRACES:readonly Terrace[]=[
 {edge:'west',start:1.1,length:8.9,depth:2.65},
 {edge:'north',start:.7,length:10.7,depth:2.8},
 {edge:'south',start:.7,length:10.7,depth:2.45},
];
const interpolate=(a:number,b:number,t:number)=>a+(b-a)*t;
function geometryForTerrace({edge,start,length,depth}:Terrace){
 const across=6,along=26;
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const low=new THREE.Color('#243c3d');
 const mid=new THREE.Color('#5b7065');
 const high=new THREE.Color('#8d8872');
 const color=new THREE.Color();
 const height=(u:number,t:number)=>{
  // No uniform wall: two broad broken shelves, uneven strata, and
  // small smooth geological rises rather than repeated 1x1 columns.
  const shelf=u<.23?.04+u*.7:u<.68?.17+(u-.23)*1.1:.67+(u-.68)*1.65;
  const weather=Math.sin(t*13.4+u*5.8)*.10+
    Math.sin(t*29.9-u*8.1)*.045+Math.cos(t*8.7+u*10)*.09;
  return Math.max(.025,shelf+weather*u);
 };
 for(let j=0;j<=along;j++){
  const t=j/along;
  for(let i=0;i<=across;i++){
   const u=i/across;
   const distance=depth*u;
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
