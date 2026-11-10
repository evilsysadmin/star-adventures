import * as THREE from 'three';

// Distant environment, not a hidden second map. Both sculpted cliff ribbons
// are OUTSIDE the canonical 18×12 board (x < 0 or x > 17), so the scenery
// cannot imply an undiscovered path, wall, mission objective or cover tile.
// The same orthographic camera/pointer contract still belongs to SVG.
export const K47_CANYON_SURROUND='k47-ambient-canyon-v1';
const POINTS=25;
type CliffSide='west'|'east';

function cliffGeometry(side:CliffSide){
 const positions:number[]=[],colors:number[]=[];
 const rng=(index:number,salt:number)=>{
   const v=Math.sin((index+1)*127.17+(salt+1)*37.91)*43758.5453;
   return v-Math.floor(v);
 };
 const push=(a:number[],b:number[],c:number[],level:number,facet:number)=>{
   const c0=new THREE.Color(['#9a8570','#746d62','#c1a182','#554e4b','#a78c76'][facet%5]);
   c0.multiplyScalar(level);
   for(const p of [a,b,c]){
     positions.push(p[0],p[1],p[2]);
     colors.push(c0.r,c0.g,c0.b);
   }
 };
 // Three vertical strata with angular, weather-cut outlines. They are
 // irregular faceted rock, not rectangular wall slabs or extra floor tiles.
 const rings:Array<Array<number[]>>=[[],[],[],[]];
 for(let i=0;i<=POINTS;i++){
   const t=i/POINTS;
   const z=1+t*11;
   const west=side==='west';
   const outerX=west?-4.5:21.2;
   const innerX=west?-1.15:18.25;
   const ridgeline=2.8+1.1*Math.sin(t*9.5)+.42*(rng(i,0)-.5);
   const steps=[
     [outerX,.08],
     [outerX+(innerX-outerX)*.34,ridgeline],
     [outerX+(innerX-outerX)*.75,ridgeline*.67],
     [innerX,-.42],
   ];
   for(let layer=0;layer<4;layer++){
     const [x,y]=steps[layer];
     rings[layer].push([
       x+(rng(i,layer+8)-.5)*.43,
       y+(rng(i,layer+5)-.5)*.26,
       z+(rng(i,layer+17)-.5)*.28,
     ]);
   }
 }
 for(let layer=0;layer<3;layer++){
   for(let i=0;i<POINTS;i++){
     const a=rings[layer][i],b=rings[layer][i+1],
       c=rings[layer+1][i+1],d=rings[layer+1][i];
     const level=layer===0?.73:layer===1?1.03:.84;
     push(a,b,c,level,layer+i*3);
     push(a,c,d,level*.94,layer+i*3+1);
   }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();
 return geo;
}

export function addK47CanyonSurround(scene:THREE.Scene){
 const group=new THREE.Group();
 group.name=K47_CANYON_SURROUND;
 scene.add(group);
 const material=new THREE.MeshStandardMaterial({
   vertexColors:true,metalness:0,roughness:1,flatShading:true,
   side:THREE.DoubleSide,emissive:0x514035,emissiveIntensity:.28,
 });
 const geometries:THREE.BufferGeometry[]=[];
 for(const side of ['west','east'] as const){
   const geo=cliffGeometry(side);
   geometries.push(geo);
   const mesh=new THREE.Mesh(geo,material);
   mesh.name='non-playable-'+side+'-cliff';
   mesh.castShadow=false;
   mesh.receiveShadow=false;
   group.add(mesh);
 }
 // Low warm practical lighting reveals stratification without making the
 // distant cliffs a brighter focus than the playable scientific campus.
 const practical=new THREE.PointLight(0xe7a477,1.8,12,2);
 practical.position.set(17,3,7);group.add(practical);
 return {dispose:()=>{
   scene.remove(group);
   geometries.forEach(geo=>geo.dispose());
   material.dispose();
 }};
}
