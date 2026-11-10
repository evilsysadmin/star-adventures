import * as THREE from 'three';

// Distant environment, not a hidden second map. Both sculpted cliff ribbons
// are OUTSIDE the canonical 18×12 board (x < 0 or x > 17), so the scenery
// cannot imply an undiscovered path, wall, mission objective or cover tile.
// The same orthographic camera/pointer contract still belongs to SVG.
export const K47_CANYON_SURROUND='k47-ambient-canyon-v2';
// The 1280px QA capture caught a high tan wall crossing the top-left HUD.
// Keep the ambient landforms below one world-unit and outside the board.
export const K47_CANYON_MAX_HEIGHT=1.05;
const POINTS=36;
type CliffSide='west'|'east';

function cliffGeometry(side:CliffSide){
 const positions:number[]=[],colors:number[]=[];
 const rng=(index:number,salt:number)=>{
   const v=Math.sin((index+1)*127.17+(salt+1)*37.91)*43758.5453;
   return v-Math.floor(v);
 };
 const push=(a:number[],b:number[],c:number[],level:number,facet:number)=>{
   const c0=new THREE.Color(['#67766f','#505e5b','#718077','#384b4b','#596b63'][facet%5]);
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
   const outerX=west?-2.9:19.95;
   const innerX=west?-.65:17.65;
   const ridge=.68+.16*Math.sin(t*10)+.14*(rng(i,0)-.5);
   const steps=[
     [outerX,-.12],
     [outerX+(innerX-outerX)*.34,Math.min(K47_CANYON_MAX_HEIGHT,ridge)],
     [outerX+(innerX-outerX)*.76,ridge*.49],
     [innerX,-.36],
   ];
   for(let layer=0;layer<4;layer++){
     const [x,y]=steps[layer];
     rings[layer].push([
       x+(rng(i,layer+8)-.5)*.20,
       y+(rng(i,layer+5)-.5)*.08,
       z+(rng(i,layer+17)-.5)*.14,
     ]);
   }
 }
 for(let layer=0;layer<3;layer++){
   for(let i=0;i<POINTS;i++){
     const a=rings[layer][i],b=rings[layer][i+1],
       c=rings[layer+1][i+1],d=rings[layer+1][i];
     const level=layer===0?.80:layer===1?.91:.74;
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
   side:THREE.DoubleSide,emissive:0x46544c,emissiveIntensity:.33,
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
 // No extra spotlight. The existing court's lighting already gives the
 // canyon depth; an added warm point light washed out the rock to tan.
 return {dispose:()=>{
   scene.remove(group);
   geometries.forEach(geo=>geo.dispose());
   material.dispose();
 }};
}
