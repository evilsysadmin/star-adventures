// Reusable original multi-cell industrial apron. The art is ONE continuous
// screen-projected fabrication clipped to the ACTUAL explored, unblocked
// walkable squares supplied by the caller. It is not a fake new terrain map,
// interaction layer, mission target, doorway or opaque fog bypass.
type Cell={readonly x:number;readonly y:number};
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Props=Vision&{cells:ReadonlyArray<Cell>};
type Point={x:number;y:number};
const key=(x:number,y:number)=>x+','+y;
const iso=(x:number,y:number):Point=>({x:440+(x-y)*40,y:52+(x+y)*20});
const poly=(points:readonly Point[])=>
 points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')+'Z';
const tile=(cell:Cell)=>{
 const c=iso(cell.x,cell.y);
 return poly([{x:c.x,y:c.y-20},{x:c.x+40,y:c.y},
   {x:c.x,y:c.y+20},{x:c.x-40,y:c.y}]);
};
const xz=(x:number,y:number)=>iso(x,y);

// Long slabs and steel service ducts are scaled in *world* units, never
// restarted at each single diamond. A reusable run can be clipped to any
// approved contiguous exposed landing zone.
const primaryPlate=poly([
 xz(1.75,3.15),xz(7.38,3.15),xz(7.38,4.8),xz(1.75,4.8),
]);
const outerPlate=poly([
 xz(2.15,4.78),xz(7.62,4.78),xz(7.62,6.62),xz(2.15,6.62),
]);
const serviceBay=poly([
 xz(5.65,4.78),xz(7.7,4.78),xz(7.7,6.25),xz(5.65,6.25),
]);
const runStart=xz(3.0,6.06),runEnd=xz(7.15,3.55);
const secondStart=xz(3.0,5.7),secondEnd=xz(7.15,3.19);
const line=(a:Point,b:Point)=>'M'+a.x+' '+a.y+'L'+b.x+' '+b.y;
const ends=[xz(3.0,6.06),xz(7.15,3.55)];

function ApronPaint(){
 return <g data-testid="ground-industrial-apron-paint" pointerEvents="none">
  {/* A wide metal launch/cargo apron, not 20 separately stamped tiles.
      Each plate is masked to real free cells, so it cannot invent ground. */}
  <path d={primaryPlate} fill="url(#k47-court-macro-plate)"
    stroke="#d0bea0" strokeWidth="3.2"/>
  <path d={outerPlate} fill="url(#k47-court-deep-steel)"
    stroke="#a7ad96" strokeWidth="2.6"/>
  <path d={serviceBay} fill="#162e38"
    stroke="#a3b0a0" strokeWidth="3.4"/>
  <path d={serviceBay} fill="url(#k47-court-macro-wear)" opacity=".42"/>
  {/* Recessed broad machine-channel and twin flush copper conduits.
      A line is paint, never a new movement route or collision geometry. */}
  <path d={line(runStart,runEnd)}
    stroke="#102833" strokeWidth="29" strokeLinecap="square" fill="none"/>
  <path d={line(runStart,runEnd)}
    stroke="#3c5f65" strokeWidth="22" strokeLinecap="square" fill="none"/>
  <path d={line(runStart,runEnd)}
    stroke="#acb69b" strokeWidth="2.6" fill="none"
    strokeDasharray="22 16" opacity=".7"/>
  <path d={line(secondStart,secondEnd)}
    stroke="#132f39" strokeWidth="9" fill="none"/>
  <path d={line(secondStart,secondEnd)}
    stroke="#d1aa70" strokeWidth="3.6" fill="none" opacity=".88"/>
  {/* Two integrated inspection plates, aligned with the same yard rather
      than posing as new station objects or raised obstacles. */}
  {[xz(6.3,5.46),xz(4.2,3.46)].map((center,i)=>
   <g key={i}>
    <ellipse cx={center.x} cy={center.y}
      rx="38" ry="18" fill="#18343c" stroke="#97aaa0" strokeWidth="2.1"/>
    <ellipse cx={center.x} cy={center.y}
      rx="29" ry="12" fill="#47605b" stroke="#c4b08a" strokeWidth="1.6"/>
    <path d={'M'+(center.x-20)+' '+center.y+'L'+(center.x+20)+' '+center.y}
      stroke="#183942" strokeWidth="4.5" strokeDasharray="7 5"/>
    <path d={'M'+(center.x-16)+' '+(center.y-6)+'L'+(center.x+16)+' '+(center.y+6)}
      stroke="#9cbaa9" strokeWidth="1.5"/>
   </g>)}
  {/* A handful of large fabrication seams; no per-square checkerboard. */}
  {[3.85,5.15,6.45].map((x,i)=>{
   const a=xz(x,3.32),b=xz(x,6.37);
   return <g key={i}>
    <path d={line(a,b)} stroke="#172f36" strokeWidth="5.4"
      fill="none" opacity=".43"/>
    <path d={line(a,b)} stroke="#9aab9a" strokeWidth="1"
      fill="none" opacity=".60"/>
   </g>;
  })}
  {/* Landing approach safety markings, low and entirely flush. */}
  {ends.map((c,i)=><g key={i}>
   <ellipse cx={c.x} cy={c.y} rx="17" ry="8"
     fill="url(#k47-court-amber-pool)"/>
   <path d={'M'+(c.x-20)+' '+(c.y-7)+'l12 6 9 -4M'+
     (c.x+1)+' '+(c.y+5)+'l11 -4 8 5'}
     stroke="#e2bc7e" strokeWidth="2.8" fill="none"/>
  </g>)}
 </g>;
}

export function GroundIndustrialApron({cells,explored,visible}:Props){
 const known=cells.filter(cell=>explored.has(key(cell.x,cell.y)));
 const live=known.filter(cell=>visible.has(key(cell.x,cell.y)));
 const remembered=known.filter(cell=>!visible.has(key(cell.x,cell.y)));
 return <g data-testid="ground-industrial-apron"
   data-known-cell-ids={known.map(c=>key(c.x,c.y)).join(' ')}
   pointerEvents="none" aria-hidden="true">
   <defs>
    <linearGradient id="k47-court-macro-plate"
      gradientUnits="userSpaceOnUse"
      x1="265" y1="175" x2="750" y2="460">
      <stop stopColor="#a7ada0"/>
      <stop offset=".38" stopColor="#788f83"/>
      <stop offset="1" stopColor="#3b5860"/>
    </linearGradient>
    <linearGradient id="k47-court-deep-steel"
      gradientUnits="userSpaceOnUse"
      x1="270" y1="215" x2="780" y2="435">
      <stop stopColor="#607d7a"/>
      <stop offset=".44" stopColor="#405c61"/>
      <stop offset="1" stopColor="#233f4c"/>
    </linearGradient>
    <pattern id="k47-court-macro-wear" width="93" height="69"
      patternUnits="userSpaceOnUse">
      <path d="M4 11l32 7 12 -4M21 59l19 -4M60 47l18 4"
        stroke="#182c35" strokeWidth="2.7" opacity=".34" fill="none"/>
      <path d="M8 34l21 -6M59 8l11 3" stroke="#e5c599"
        strokeWidth="1.8" opacity=".2" fill="none"/>
    </pattern>
    <radialGradient id="k47-court-amber-pool">
      <stop stopColor="#f7ca8a" stopOpacity=".32"/>
      <stop offset="1" stopColor="#f7ca8a" stopOpacity="0"/>
    </radialGradient>
    <clipPath id="k47-apron-visible-clip" clipPathUnits="userSpaceOnUse">
      {live.map(cell=><path key={key(cell.x,cell.y)} d={tile(cell)}/>)}
    </clipPath>
    <clipPath id="k47-apron-remembered-clip" clipPathUnits="userSpaceOnUse">
      {remembered.map(cell=><path key={key(cell.x,cell.y)} d={tile(cell)}/>)}
    </clipPath>
   </defs>
   <g data-fog="visible" clipPath="url(#k47-apron-visible-clip)">
     <ApronPaint/>
   </g>
   <g data-fog="remembered" opacity=".30"
     clipPath="url(#k47-apron-remembered-clip)">
     <ApronPaint/>
   </g>
 </g>;
}
