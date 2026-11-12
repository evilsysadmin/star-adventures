import * as THREE from 'three';
// Real, non-interactive architectural replacement on three blocked K-47 cells.
export const SCIENCE_CELLS=['2,2','3,2','4,2'] as const;
function wornMetal(seed:number){
 const result=new Uint8Array(128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=(seed>>>26)-32,streak=(x%37===0?-21:0)+(y%41===0?-9:0);
  const tone=Math.round(Math.max(120,Math.min(246,
   210+noise*.42+streak+8*Math.sin(x*.1+y*.05)+6*Math.cos(y*.14))));
  const k=(y*128+x)*4;
  result[k]=tone;result[k+1]=tone-5;result[k+2]=tone-9;result[k+3]=255;
 }
 return result;
}
export function addScienceWing3D(scene:THREE.Scene){
 const root=new THREE.Group();root.name='modular-k47-science-wing';
 const cube=new THREE.BoxGeometry(1,1,1);
 const cylinder=new THREE.CylinderGeometry(1,1,1,12);
 const resources:Array<{dispose:()=>void}>=[cube,cylinder];
 const map=(seed:number)=>{
  const value=new THREE.DataTexture(wornMetal(seed),128,128,THREE.RGBAFormat);
  value.colorSpace=THREE.SRGBColorSpace;
  value.generateMipmaps=true;value.minFilter=THREE.LinearMipmapLinearFilter;
  value.magFilter=THREE.LinearFilter;value.needsUpdate=true;
  resources.push(value);return value;
 };
 const mat={
  wall:new THREE.MeshStandardMaterial({color:0x8e9b8a,map:map(0x4c4703a1),metalness:.28,roughness:.9}),
  roof:new THREE.MeshStandardMaterial({color:0x647b78,map:map(0x726147ff),metalness:.49,roughness:.8}),
  rock:new THREE.MeshStandardMaterial({color:0x424b4c,metalness:.08,roughness:1}),
  frame:new THREE.MeshStandardMaterial({color:0x9aaba5,metalness:.65,roughness:.52}),
  brass:new THREE.MeshStandardMaterial({color:0xc7a772,metalness:.68,roughness:.49}),
  dark:new THREE.MeshStandardMaterial({color:0x243842,metalness:.35,roughness:.8}),
  glass:new THREE.MeshStandardMaterial({color:0x4b96a0,emissive:0x236d7a,emissiveIntensity:1.1,metalness:.18,roughness:.35}),
  lamp:new THREE.MeshStandardMaterial({color:0xffd6a0,emissive:0xe48e4d,emissiveIntensity:2.2,roughness:.38}),
 };
 resources.push(...Object.values(mat));
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,
   material:THREE.Material,round=false)=>{
  const rx=round?w:w/2,rz=round?w:d/2;
  if(x-rx<1.5||x+rx>4.5||z-rz<1.5||z+rz>2.5)
   throw new Error('Science wing outside blocked footprint: '+name);
  const mesh=new THREE.Mesh(round?cylinder:cube,material);
  mesh.name=name;mesh.position.set(x,y,z);
  mesh.scale.set(w,h,round?w:d);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 };
 // One connected mass with deep recesses and genuine long roofline.
 box('rock-plinth',3,.16,2,2.85,.32,.91,mat.rock);
 box('plinth-trim',3,.35,2,2.88,.085,.94,mat.brass);
 box('connected-research-hall',3,1.02,2,2.76,1.28,.82,mat.wall);
 box('front-recess',3,.99,2.426,2.67,1.07,.031,mat.dark);
 box('continuous-roof',3,1.76,2,2.90,.19,.95,mat.roof);
 box('roof-spine',3,1.94,1.82,2.66,.12,.26,mat.dark);
 box('south-eave',3,1.84,2.466,2.92,.11,.055,mat.brass);
 box('north-eave',3,1.84,1.534,2.92,.11,.055,mat.frame);
 box('east-gable',4.442,1.74,2,.045,.13,.94,mat.frame);
 box('west-gable',1.558,1.74,2,.045,.13,.94,mat.frame);
 box('roof-skylight-recess',2.72,1.95,1.85,1.15,.038,.18,mat.dark);
 box('roof-skylight',2.72,1.977,1.85,1.04,.014,.11,mat.glass);
 for(const x of [2,3,4]){
  // All bays are SEALED; the real stations retain their original commands.
  box('bay-deep-recess-'+x,x,1.015,2.454,.70,.86,.027,mat.dark);
  box('bay-pane-'+x,x,1.025,2.472,.57,.69,.020,x===3?mat.wall:mat.glass);
  box('bay-sill-'+x,x,.61,2.48,.75,.06,.025,mat.brass);
  box('bay-lintel-'+x,x,1.465,2.48,.79,.07,.024,mat.frame);
  box('bay-center-mullion-'+x,x,1.04,2.482,.047,.74,.016,mat.dark);
  for(const y of [.82,1.19])
   box('bay-transom-'+x+'-'+y,x,y,2.484,.62,.022,.014,mat.frame);
  box('bay-amber-light-'+x,x,1.58,2.47,.26,.065,.035,mat.lamp);
  if(x<4){
   box('structural-pier-'+x,x+.5,1.05,2.43,.115,1.28,.09,mat.frame);
   box('pier-service-rib-'+x,x+.5,1.06,2.484,.033,.99,.018,mat.brass);
  }
 }
 // Asymmetric machine clusters provide a real silhouette, instead of
 // a repeated small box on each tile.
 box('power-generator',2.22,2.08,2.11,.63,.36,.42,mat.dark);
 box('generator-weathered-cover',2.22,2.32,2.11,.51,.17,.32,mat.wall);
 for(const x of [2.05,2.22,2.39])
  box('generator-rib-'+x,x,2.412,2.11,.045,.025,.31,mat.brass);
 box('sensor-plant-mount',3.90,2.06,2.10,.65,.23,.55,mat.dark);
 box('sensor-plant-cover',3.90,2.22,2.10,.60,.12,.49,mat.roof);
 for(const z of [1.89,2.04,2.19])
  box('sensor-louver-'+z,3.90,2.295,z,.54,.048,.03,mat.frame);
 box('vent-stack-a',3.45,2.19,1.76,.08,.58,0,mat.frame,true);
 box('vent-stack-b',3.65,2.11,1.76,.065,.43,0,mat.brass,true);
 box('roof-data-conduit',3.16,1.95,2.26,.85,.07,.06,mat.brass);
 for(const z of [1.68,2.17,2.34])
  box('roof-seam-'+z,2.84,1.869,z,2.48,.018,.026,mat.dark);
 root.userData.blockedFootprint=SCIENCE_CELLS.join(' ');
 root.userData.meshCount=root.children.length;
 scene.add(root);
 return ()=>{scene.remove(root);for(const resource of resources)resource.dispose();};
}
