// Original, deterministic world-scale texture detail for reusable K-47 tiles.
// Pure pixels: no Three, RNG state, image requests or gameplay dependencies.
// Each semantic material family has ONE texture shared across all variants.
// The renderer assigns world-space UVs so stains never restart per grid cell.
export const SURFACE_SIZE=256;
export type SurfaceFamily='concrete'|'steel'|'mineral'|'dust';
export const surfaceFamilies:readonly SurfaceFamily[]=
 ['concrete','steel','mineral','dust'] as const;
const seeds:Record<SurfaceFamily,number>={
 concrete:0x41c620a1,steel:0x4c8a2190,mineral:0x54d10389,dust:0x298a012f,
};
const clamp=(value:number)=>Math.max(0,Math.min(255,Math.round(value)));

export function makeGroundSurfacePixels(family:SurfaceFamily):Uint8Array{
 const bytes=new Uint8Array(SURFACE_SIZE*SURFACE_SIZE*4);
 let seed=seeds[family];
 const phase=(seed%997)/997*Math.PI*2;
 for(let y=0;y<SURFACE_SIZE;y++)for(let x=0;x<SURFACE_SIZE;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  // Four broad, asymmetric fields cover MANY tiles. Fine noise only gives
  // grain; it never draws an obvious one-square repeated border.
  const grain=((seed>>>25)-64)*.21;
  const broad=7*Math.sin(x*.029+y*.012+phase)+
   6*Math.sin(x*.011-y*.041+phase*.7)+
   5*Math.cos(x*.056-y*.025+phase*1.3);
  const sweep=Math.sin(y*.052+x*.017+Math.sin(x*.022+phase)*1.7);
  let wear=0;
  if(family==='steel'){
   // Brushing and a few long oxidized fabrication sweeps.
   wear=3*Math.sin(y*.44+x*.012)+
    (sweep>.87?-9:0);
  }else if(family==='concrete'){
   wear=(sweep>.91?-10:0)+
    4*Math.sin(x*.07+Math.sin(y*.018)*2);
  }else if(family==='mineral'){
   wear=5*Math.sin(x*.086-y*.043+phase)+
    (sweep<-.92?-8:0);
  }else{
   wear=8*Math.sin(x*.020+y*.017+phase)+
    4*Math.cos(y*.062-x*.012);
  }
  const v=clamp(218+grain+broad+wear);
  const index=(y*SURFACE_SIZE+x)*4;
  bytes[index]=v;
  bytes[index+1]=clamp(v+(family==='dust'?3:1));
  bytes[index+2]=clamp(v+(family==='steel'?3:0));
  bytes[index+3]=255;
 }
 return bytes;
}
