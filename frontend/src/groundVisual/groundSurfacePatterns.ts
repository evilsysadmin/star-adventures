// Original, deterministic micro-surface detail for the reusable K-47 tiles.
// Pure pixels: no Three, RNG state, image requests or gameplay dependencies.
// All variants retain one shared material/texture per semantic surface family.
export const SURFACE_SIZE=64;
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
 for(let y=0;y<SURFACE_SIZE;y++)for(let x=0;x<SURFACE_SIZE;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  // Soft value noise, not random bright squares or fake tiles/collision.
  const grain=(seed>>>27)-16;
  let relief=0;
  if(family==='steel'){
   // Faint directional brushing and restrained panel stamping.
   relief=(y%12===0?-5:0)+(x%23===0?3:0);
  }else if(family==='concrete'){
   relief=(x*7+y*13)%71===0?-11:0;
  }else if(family==='mineral'){
   relief=(seed&127)===0?-14:0;
  }else{
   // Broad, low-contrast dust drifts, no checkerboard grout.
   relief=Math.sin(x*.12+y*.08)*5;
  }
  const v=clamp(232+grain*.55+relief);
  const index=(y*SURFACE_SIZE+x)*4;
  bytes[index]=v;
  bytes[index+1]=clamp(v+(family==='dust'?3:1));
  bytes[index+2]=clamp(v+(family==='steel'?3:0));
  bytes[index+3]=255;
 }
 return bytes;
}
