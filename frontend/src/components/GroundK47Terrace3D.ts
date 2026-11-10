import * as THREE from 'three';
import world from '../../../content/scenes/meridian.json';

// One authored K-47 industrial terrace, NOT a generated gameplay map.
// Only the canonical, blocked south retaining-wall cells can own buildings.
// This replaces the old little SVG wall boxes when the one-shot WebGL render
// succeeds; all route, fog and unit authority remains in the original SVG.
const blocked=new Set(world.scenes.surface.walls.map(p=>p.x+','+p.y));
const modules=[3,4,5,6,7] as const;
const valid=world.scenes.surface.width===18&&world.scenes.surface.height===12&&
 modules.every(x=>blocked.has(x+',7'));

export const K47_TERRACE_KIT='k47-industrial-terrace-v1';

function weatheredMetal(){
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 let seed=47207;
 const random=()=>{
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   return seed/4294967296;
 };
 ctx.fillStyle='#858b80';ctx.fillRect(0,0,256,256);
 // Large repeated plate seams and asymmetrical wear across every panel.
 for(let i=0;i<8;i++){
   const y=i*33+2;
   ctx.fillStyle='rgba(18,34,38,.35)';ctx.fillRect(0,y,256,3);
   ctx.fillStyle='rgba(208,180,139,.23)';ctx.fillRect(0,y+4,256,1);
 }
 for(let i=0;i<1500;i++){
   const x=random()*256,y=random()*256;
   ctx.fillStyle=random()>.49?'rgba(26,41,44,.22)':'rgba(204,182,138,.24)';
   ctx.fillRect(x,y,1+random()*11,1+random()*4);
 }
 for(let i=0;i<95;i++){
   const x=random()*256,y=random()*256;
   ctx.fillStyle='rgba(110,60,40,.21)';
   ctx.fillRect(x,y,1+random()*4,6+random()*38);
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=4;
 return texture;
}
export function addK47Terrace(scene:THREE.Scene,knownColumns:ReadonlySet<number>){
 const group=new THREE.Group();group.name=K47_TERRACE_KIT;scene.add(group);
 const resources:Array<{dispose:()=>void}>=[];
 const geometry=(g:THREE.BufferGeometry)=>{resources.push(g);return g;};
 const material=(m:THREE.Material)=>{resources.push(m);return m;};
 const texture=weatheredMetal();
 if(texture)resources.push(texture);
 const steel=material(new THREE.MeshStandardMaterial({
   color:0xbbb3a1,metalness:.58,roughness:.73,...(texture?{map:texture}:{})
 }));
 const roof=material(new THREE.MeshStandardMaterial({color:0x545a57,metalness:.72,roughness:.53}));
 const dark=material(new THREE.MeshStandardMaterial({color:0x24363b,metalness:.62,roughness:.68}));
 const bronze=material(new THREE.MeshStandardMaterial({color:0xa77a55,metalness:.69,roughness:.55}));
 const amber=material(new THREE.MeshStandardMaterial({
   color:0xffc78a,emissive:0xffa257,emissiveIntensity:1.2,roughness:.25
 }));
 const glass=material(new THREE.MeshStandardMaterial({
   color:0x5e9c9e,emissive:0x22616a,emissiveIntensity:.78,
   metalness:.45,roughness:.17
 }));
 // The geological skirt is not a dark load-bearing polygon; world-space
 // vertex tones must remain legible under the one-shot WebGL shadow map.
 // Using a basic facet material also avoids a near-black canyon when the
 // directional light falls behind the exposed lower retaining face.
 const rock=material(new THREE.MeshBasicMaterial({
   vertexColors:true,side:THREE.DoubleSide
 }));
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{
   const mesh=new THREE.Mesh(geometry(new THREE.BoxGeometry(w,h,d)),mat);
   mesh.name=name;mesh.position.set(x,y,z);
   mesh.castShadow=true;mesh.receiveShadow=true;
   group.add(mesh);return mesh;
 };
 const rod=(name:string,x:number,y:number,z:number,r:number,h:number,mat:THREE.Material)=>{
   const mesh=new THREE.Mesh(geometry(new THREE.CylinderGeometry(r,r,h,8)),mat);
   mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;
   group.add(mesh);return mesh;
 };
 const glow=(x:number,y:number,z:number)=>{
   const light=new THREE.PointLight(0xffb575,3.7,3,2);
   light.position.set(x,y,z);group.add(light);
 };
 const known=modules.filter(x=>valid&&knownColumns.has(x));

 // Stratified rock has multiple sculpted faces and a substantially lower
 // foundation than the main courtyard. It is NOT a traversable cliff or a
 // new elevation in the game: all columns sit under existing blocked cells.
 const rockLayer=(x:number,level:number)=>{
   const top=-.04-level*.27,bottom=top-.32;
   const shade=(level%3)*.07;
   const vertices=[
     [x-.51,top,6.52],[x+.51,top+.06,6.52],
     [x+.53,bottom-.08,6.62],[x-.52,bottom+.04,6.66],
     [x-.56,top-.12,7.51],[x+.52,top-.11,7.52],
     [x+.47,bottom-.24,7.54],[x-.47,bottom-.17,7.58]
   ];
   const faces=[
     [0,1,2],[0,2,3],[1,5,6],[1,6,2],
     [5,4,7],[5,7,6],[4,0,3],[4,3,7],
     [0,4,5],[0,5,1],[3,2,6],[3,6,7],
   ];
   const pos:number[]=[],colors:number[]=[];
   faces.forEach(([a,b,c],i)=>{
     for(const index of [a,b,c]){
       const [vx,vy,vz]=vertices[index];
       pos.push(vx,vy,vz);
       const palette=[0x6a6357,0x84705d,0x443f3c,0x947c66,0x3e4c4e];
       const color=new THREE.Color(palette[(i+level*2+Math.round(x))%palette.length]);
       color.multiplyScalar(.85+shade);
       colors.push(color.r,color.g,color.b);
     }
   });
   const meshGeometry=geometry(new THREE.BufferGeometry());
   meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   meshGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   meshGeometry.computeVertexNormals();
   const mesh=new THREE.Mesh(meshGeometry,rock);
   mesh.name='known-rock-foundation-'+x+'-'+level;
   // The undercroft is a lit geological retaining edge, not a black pit:
   // heavy shadows here made the first real Chromium render unreadable.
   mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
 };
 for(const x of known){
   for(let level=0;level<2;level++)rockLayer(x,level);
   // One substantial founded structure per blocked cell; modulated
   // heights/roof forms make an industrial silhouette, not a solid slab.
   box('base-'+x,x,.14,7,.96,.32,.96,dark);
   box('shell-'+x,x,.68,7,.9,.83,.85,steel);
   box('parapet-'+x,x,1.14,7,.98,.15,.96,roof);
   const height=x===5?1.32:1.23;
   box('roof-ridge-'+x,x,height,7,.87,.09,.78,bronze);
   box('roof-fascia-'+x,x,1.11,7.48,.93,.11,.08,dark);
   // Windows live on a real blocked facade, never on the playable floor.
   for(const offset of [-.29,0,.29]){
     box('window-frame-'+x+'-'+offset,x+offset,.76,7.439,.23,.35,.075,dark);
     box('lit-window-'+x+'-'+offset,x+offset,.77,7.482,.17,.25,.02,glass);
     box('window-sill-'+x+'-'+offset,x+offset,.57,7.51,.24,.045,.06,bronze);
   }
   box('service-rib-'+x,x-.48,.62,7.45,.07,.92,.09,roof);
   box('service-rib-east-'+x,x+.48,.62,7.45,.07,.92,.09,roof);
   box('rust-band-'+x,x,.38,7.49,.87,.065,.035,bronze);
   // Utilities are fixed to roofs/frontage; no apparent doorway is made.
   rod('roof-vent-'+x,x+.22,1.43,6.91,.08,.35,dark);
   box('roof-air-handler-'+x,x-.20,1.32,6.94,.35,.2,.33,steel);
   if(x===3||x===6){
     rod('light-mast-'+x,x-.35,1.67,7.36,.028,.82,steel);
     box('floodlight-'+x,x-.35,2.06,7.39,.2,.10,.19,bronze);
     box('floodlight-glass-'+x,x-.35,2.06,7.50,.14,.07,.02,amber);
     glow(x-.35,1.96,7.5);
   }
   // Give selected bays a recognisable industrial profile.
   if(x===5){
     rod('exhaust-stack',x+.23,1.67,6.82,.12,.62,roof);
     rod('exhaust-cap',x+.23,2.02,6.82,.16,.065,bronze);
   }
 }
 // The pipe and guardrail systems join exactly two *known* blocked bays.
 // An unknown neighbouring cell never creates a bridge revealing its shape.
 for(const x of known){
   if(!knownColumns.has(x+1)||!blocked.has((x+1)+',7'))continue;
   box('continuous-copper-conduit-'+x,x+.5,.37,7.54,1.01,.075,.075,bronze);
   box('continuous-water-pipe-'+x,x+.5,.27,7.52,1.01,.055,.055,dark);
   box('roof-guardrail-'+x,x+.5,1.40,7.40,1.0,.036,.036,steel);
   box('roof-lower-rail-'+x,x+.5,1.26,7.40,1.0,.027,.027,bronze);
   rod('guardrail-post-'+x,x+.5,1.31,7.40,.028,.34,steel);
 }
 return {
   cells:known,
   meshCount:group.children.filter(child=>child instanceof THREE.Mesh).length,
   dispose:()=>{scene.remove(group);resources.forEach(resource=>resource.dispose());}
 };
}
