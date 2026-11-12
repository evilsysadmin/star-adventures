import * as THREE from 'three';

// Original, deterministic non-playable geology around the K-47 surface.
// It occupies ONLY OUTSIDE the canonical 18x12 grid; no mission coordinates,
// fog state, walkable mesh or picking surface is created here.
export const OUTER_GEOMETRY_VERSION='k47-exterior-strata-v1';
export const CANONICAL_GRID={width:18,height:12} as const;
type Strip={id:string;x0:number;x1:number;z0:number;z1:number;nx:number;nz:number;seed:number};
const strips:readonly Strip[]=[
 {id:'northern-canyon',x0:2,x1:20.9,z0:-7.7,z1:-.65,nx:35,nz:17,seed:31},
 {id:'east-escarpment',x0:17.65,x1:27.5,z0:-2.1,z1:16,nx:22,nz:32,seed:47},
 {id:'southern-ravine',x0:-1.4,x1:20.4,z0:11.65,z1:20.9,nx:37,nz:18,seed:73},
 {id:'west-rock-shelf',x0:-9.8,x1:-.65,z0:-1.5,z1:16.1,nx:19,nz:31,seed:89},
] as const;
export const isOutsideK47=(x:number,z:number)=>
 x<=-.55||z<=-.55||x>=CANONICAL_GRID.width-.45||
 z>=CANONICAL_GRID.height-.45;
const fract=(n:number)=>n-Math.floor(n);
const rand=(a:number,b:number,seed:number)=>
 fract(Math.sin(a*127.17+b*311.43+seed*41.69)*43758.5453);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const noise=(x:number,z:number,s:number)=>{
 const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j;
 const smooth=(t:number)=>t*t*(3-2*t),uu=smooth(u),vv=smooth(v);
 return lerp(lerp(rand(i,j,s),rand(i+1,j,s),uu),
  lerp(rand(i,j+1,s),rand(i+1,j+1,s),uu),vv);
};
const terrainHeight=(x:number,z:number,seed:number)=>{
 const broad=noise(x*.43,z*.38,seed)-.5;
 const rubble=noise(x*2.0,z*2.1,seed+7)-.5;
 const ridges=Math.abs(Math.sin(x*.54+z*.29+seed*.06))*.33;
 // The entire out-of-world rim is low enough to avoid giant
 // foreground cliffs obscuring selectable officers.
 return -.92+broad*1.5+rubble*.58+ridges;
};
const materialPixels=()=>{
 const size=256,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const weather=noise(x/14,y/12,117)-.5;
  const fine=noise(x/2.7,y/3.1,31)-.5;
  const sediment=Math.sin(y*.23+x*.025)*8;
  const v=Math.max(65,Math.min(234,Math.round(165+weather*41+fine*18+sediment)));
  const i=(y*size+x)*4;
  pixels[i]=v;
  pixels[i+1]=Math.max(0,v-2);
  pixels[i+2]=Math.max(0,v-6);
  pixels[i+3]=255;
 }
 return pixels;
};
function rockyMesh(strip:Strip){
 const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
 const n=(strip.nx+1)*(strip.nz+1);
 for(let j=0;j<=strip.nz;j++)for(let i=0;i<=strip.nx;i++){
  const x=lerp(strip.x0,strip.x1,i/strip.nx);
  const z=lerp(strip.z0,strip.z1,j/strip.nz);
  if(!isOutsideK47(x,z))
   throw new Error('External geological mesh crosses canonical gameplay grid');
  const h=terrainHeight(x,z,strip.seed);
  positions.push(x,h,z);uv.push(x*.16,z*.16);
  const strata=.68+.18*(noise(x*.61,z*.52,strip.seed+19));
  const dust=Math.max(0,h+.45)*.075;
  colors.push(strata+dust,strata+.025,strata+.035);
 }
 for(let j=0;j<strip.nz;j++)for(let i=0;i<strip.nx;i++){
  const a=j*(strip.nx+1)+i,b=a+1,c=a+strip.nx+1,d=c+1;
  if((i+j)%2){indices.push(a,c,b,b,c,d);}
  else {indices.push(a,c,d,a,d,b);}
 }
 const mesh=new THREE.BufferGeometry();
 mesh.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 mesh.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 mesh.setIndex(indices);mesh.computeVertexNormals();
 mesh.userData={vertexCount:n,nonPlayable:true};
 return mesh;
}
export function addK47ExteriorGeology3D(scene:THREE.Scene){
 const root=new THREE.Group();root.name=OUTER_GEOMETRY_VERSION;
 const disposable:Array<{dispose:()=>void}>=[];
 const texture=new THREE.DataTexture(materialPixels(),256,256,THREE.RGBAFormat);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 disposable.push(texture);
 const rockMat=new THREE.MeshStandardMaterial({
  color:0x667e80,vertexColors:true,map:texture,metalness:.05,
  roughness:1,side:THREE.DoubleSide,
 });
 const shaleMat=new THREE.MeshStandardMaterial({
  color:0x526969,metalness:.03,roughness:1,flatShading:true
 });
 disposable.push(rockMat,shaleMat);
 let totalVertices=0;
 for(const strip of strips){
  const geometry=rockyMesh(strip);disposable.push(geometry);
  const mesh=new THREE.Mesh(geometry,rockMat);
  mesh.name='outer-terrain-'+strip.id;
  mesh.castShadow=false;mesh.receiveShadow=true;
  root.add(mesh);totalVertices+=geometry.getAttribute('position').count;
 }
 // Reusable fractured-rock silhouettes, placed with deterministic randomness
 // wholly beyond the world's bounds; no fake doors, stairs or walkable ledges.
 const shardGeometry=new THREE.DodecahedronGeometry(1,0);
 disposable.push(shardGeometry);
 const shards=new THREE.InstancedMesh(shardGeometry,shaleMat,240);
 shards.name='outer-scattered-rocks';shards.castShadow=false;
 const dummy=new THREE.Object3D();
 for(let i=0;i<240;i++){
  const strip=strips[i%strips.length],seed=strip.seed;
  const x=lerp(strip.x0+.8,strip.x1-.8,rand(i,7,seed));
  const z=lerp(strip.z0+.8,strip.z1-.8,rand(i,13,seed));
  const size=.10+rand(i,29,seed)*.24;
  if(!isOutsideK47(x,z)||!isOutsideK47(x+size,z+size)||
      !isOutsideK47(x-size,z-size))
   throw new Error('Exterior rock lies within playable K-47 coordinates');
  dummy.position.set(x,terrainHeight(x,z,seed)+size*.26,z);
  dummy.rotation.set(rand(i,17,seed)*.35,rand(i,19,seed)*Math.PI*2,rand(i,23,seed)*.4);
  dummy.scale.set(size*(.6+rand(i,3,seed)),size*(.4+rand(i,5,seed)),size);
  dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);
 }
 shards.instanceMatrix.needsUpdate=true;
 root.add(shards);
 root.userData={nonPlayable:true,terrainStrips:strips.length,
  terrainVertices:totalVertices,rockInstances:240};
 scene.add(root);
 return ()=>{
  scene.remove(root);
  for(const item of disposable)item.dispose();
 };
}
