import * as THREE from 'three';

// One deterministic, ORIGINAL world-space material across the entire
// environment, not an identical bitmap repeated on every logical tile.
// Identical UV mapping on every batched tile prevents checkerboard seams.
// This canvas is generated only when the one existing WebGL scene mounts.
export const TERRAIN_WORLD_WIDTH=18;
export const TERRAIN_WORLD_HEIGHT=12;
export function makeWorldTerrainTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=1536;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 let seed=0x47f1195;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/4294967296;};
 const w=canvas.width,h=canvas.height;
 ctx.fillStyle='#71867d';ctx.fillRect(0,0,w,h);
 // Geological colour wash, with broad deposits spanning 3-8 world tiles.
 const dusk=ctx.createLinearGradient(0,0,w,h);
 dusk.addColorStop(0,'rgba(38,61,62,.20)');
 dusk.addColorStop(.4,'rgba(155,135,100,.07)');
 dusk.addColorStop(1,'rgba(32,63,65,.28)');
 ctx.fillStyle=dusk;ctx.fillRect(0,0,w,h);
 for(let i=0;i<85;i++){
  const x=rand()*w,y=rand()*h;
  ctx.save();ctx.translate(x,y);ctx.rotate(rand()*Math.PI);
  ctx.scale(.8+rand()*1.6,.4+rand()*.65);
  ctx.beginPath();ctx.ellipse(0,0,35+rand()*145,13+rand()*72,
   0,0,Math.PI*2);
  ctx.fillStyle=i%3===0?'rgba(18,42,49,.11)':
   i%3===1?'rgba(220,196,149,.09)':'rgba(114,106,82,.14)';
  ctx.fill();ctx.restore();
 }
 // Fine composite aggregate, no visible 1x1 boundaries.
 for(let i=0;i<12500;i++){
  const x=rand()*w,y=rand()*h,size=.45+rand()*3.5;
  ctx.fillStyle=i%3===0?'rgba(17,33,42,.085)':
    i%3===1?'rgba(245,224,179,.105)':'rgba(111,102,77,.1)';
  ctx.fillRect(x,y,size,.5+rand()*2);
 }
 // Sparse long scoring / weathering strokes crossing multiple tiles.
 for(let i=0;i<72;i++){
  const x=rand()*w,y=rand()*h;
  const len=24+rand()*230;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.quadraticCurveTo(x+len*.48,y-13+rand()*26,
   x+len,y-26+rand()*52);
  ctx.strokeStyle=i%4===0?'rgba(234,195,126,.18)':
   'rgba(21,39,45,.21)';
  ctx.lineWidth=.6+rand()*3;ctx.stroke();
 }
 // A small number of large construction joints carry across many cells;
 // they are intentionally NOT placed at tile boundaries.
 for(const y of [.19,.42,.68,.86]){
  const offset=(rand()-.5)*.03;
  ctx.beginPath();ctx.moveTo(110,(y+offset)*h);
  ctx.bezierCurveTo(w*.27,(y+.01)*h,w*.66,(y-.016)*h,w-90,(y+offset*.5)*h);
  ctx.strokeStyle='rgba(25,45,50,.22)';ctx.lineWidth=2.7;ctx.stroke();
  ctx.beginPath();ctx.moveTo(110,(y+offset)*h+3.4);
  ctx.bezierCurveTo(w*.27,(y+.01)*h+3.4,
   w*.66,(y-.016)*h+3.4,w-90,(y+offset*.5)*h+3.4);
  ctx.strokeStyle='rgba(189,176,142,.15)';
  ctx.lineWidth=1.4;ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.ClampToEdgeWrapping;
 texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.anisotropy=4;
 return texture;
}
