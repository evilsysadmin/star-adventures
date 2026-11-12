// Deterministic, world-aligned reusable K-47 industrial surface atlas.
// Four shared material families; high-frequency grit plus slow wear extending
// over four meters (tiles) instead of restarting at each 1x1 grid cell.
// Original pixels, no network, no browser, no real mission/gameplay data.
export const SURFACE_SIZE=256;
export const WORLD_TILE_PERIOD=4;
export type SurfaceFamily='concrete'|'steel'|'mineral'|'dust';
export const surfaceFamilies:readonly SurfaceFamily[]=
 ['concrete','steel','mineral','dust'] as const;
const seeds:Record<SurfaceFamily,number>={
 concrete:0x41c620a1,steel:0x4c8a2190,mineral:0x54d10389,dust:0x298a012f,
};
const clamp=(value:number)=>Math.max(0,Math.min(255,Math.round(value)));
const hash=(x:number,y:number,seed:number)=>{
 let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+seed)>>>0;
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
};
const smooth=(t:number)=>t*t*(3-2*t);
// A repeatable, tileable noise field: period is a factor of SURFACE_SIZE.
// This also makes the NORMAL texture continuous at the wrap boundary.
const noise=(x:number,y:number,octave:number,seed:number)=>{
 const px=(x*octave)/SURFACE_SIZE,py=(y*octave)/SURFACE_SIZE;
 const ix=Math.floor(px),iy=Math.floor(py);
 const u=smooth(px-ix),v=smooth(py-iy);
 const point=(dx:number,dy:number)=>
  hash((ix+dx)%octave,(iy+dy)%octave,seed);
 const a=point(0,0)*(1-u)+point(1,0)*u;
 const b=point(0,1)*(1-u)+point(1,1)*u;
 return (a+(b-a)*v)-.5;
};
const shade=(family:SurfaceFamily,x:number,y:number)=>{
 const seed=seeds[family];
 const broad=noise(x,y,4,seed)*43;
 const pitting=noise(x,y,16,seed+37)*19;
 const fine=noise(x,y,64,seed+97)*9;
 const streak=Math.sin(y*2*Math.PI*8/SURFACE_SIZE+x*.025)*2.7;
 // Weathered metal is brushed longitudinally; old concrete has broad
 // dusty areas, mineral patches have fractured seams, sand drifts softly.
 if(family==='steel'){
  const scratch=Math.abs(noise(x,y,64,seed+23))>.28?-22:0;
  const brushed=Math.sin(y*2*Math.PI*52/SURFACE_SIZE)*4;
  return 203+broad*.72+pitting*.6+fine+brushed+scratch;
 }
 if(family==='concrete'){
  const hairline=Math.abs(Math.sin(x*2*Math.PI*3/SURFACE_SIZE+
    noise(x,y,16,seed+9)*.4))<.012?-27:0;
  return 202+broad+pitting+fine+streak+hairline;
 }
 if(family==='mineral'){
  const fracture=Math.abs(noise(x,y,16,seed+7))<.018?-28:0;
  return 192+broad*1.3+pitting*1.45+fine+fracture;
 }
 return 209+broad*.92+pitting*.58+fine*.4+
  Math.cos((x+y*.6)*2*Math.PI*3/SURFACE_SIZE)*5;
};
export function makeGroundSurfacePixels(family:SurfaceFamily):Uint8Array{
 const result=new Uint8Array(SURFACE_SIZE*SURFACE_SIZE*4);
 for(let y=0;y<SURFACE_SIZE;y++)for(let x=0;x<SURFACE_SIZE;x++){
  const base=shade(family,x,y);
  const index=(y*SURFACE_SIZE+x)*4;
  result[index]=clamp(base+(family==='dust'?6:1));
  result[index+1]=clamp(base+(family==='steel'?5:2));
  result[index+2]=clamp(base+(family==='mineral'?-5:0));
  result[index+3]=255;
 }
 return result;
}
export function makeGroundNormalPixels(family:SurfaceFamily):Uint8Array{
 const base=makeGroundSurfacePixels(family);
 const normal=new Uint8Array(base.length);
 const sample=(x:number,y:number)=>base[4*
  (((y+SURFACE_SIZE)%SURFACE_SIZE)*SURFACE_SIZE+
    ((x+SURFACE_SIZE)%SURFACE_SIZE))];
 for(let y=0;y<SURFACE_SIZE;y++)for(let x=0;x<SURFACE_SIZE;x++){
  const dx=(sample(x+1,y)-sample(x-1,y))*.013;
  const dy=(sample(x,y+1)-sample(x,y-1))*.013;
  const length=Math.hypot(dx,dy,1);
  const index=(y*SURFACE_SIZE+x)*4;
  normal[index]=clamp(127.5*(1-dx/length));
  normal[index+1]=clamp(127.5*(1-dy/length));
  normal[index+2]=clamp(127.5*(1+1/length));
  normal[index+3]=255;
 }
 return normal;
}
