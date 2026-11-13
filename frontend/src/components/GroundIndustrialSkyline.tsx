import type {SouthWingSpan} from '../groundSouthIndustrialSpans';

// The hangar's lower WebGL hall is painted underneath SVG floor dressing.
// A taller *WebGL* model is therefore obscured by later SVG layers.
// This original, passive architectural upper stage shares the south wall's
// exact explored blocked footprint but paints in the existing architecture
// SVG layer, ABOVE floor dressing and BELOW squad/mission overlays.
// Nothing in this module can create a selectable tile, a new wall or a door.
type Point={x:number;y:number};
type Props={
 spans:ReadonlyArray<SouthWingSpan>;
 visible:ReadonlySet<string>;
};
const at=(x:number,y:number):Point=>({x:440+(x-y)*40,y:52+(x+y)*20});
const p=(x:number,y:number):Point=>({x,y});
const up=(v:Point,h:number)=>p(v.x,v.y-h);
const mix=(a:Point,b:Point,t:number):Point=>
 p(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const polygon=(list:ReadonlyArray<Point>)=>
 list.map((v,i)=>(i?'L':'M')+v.x.toFixed(2)+' '+v.y.toFixed(2)).join(' ')+'Z';
const path=(list:ReadonlyArray<Point>)=>
 list.map((v,i)=>(i?'L':'M')+v.x.toFixed(2)+' '+v.y.toFixed(2)).join(' ');

function VisibleIndustrialGallery({span}:{
 span:SouthWingSpan;
}){
 // This slab sits directly on the original real run of blocked cells.
 // The original 51px lower roof is preserved; nothing projects across a
 // playable tile on the physical x/z plane.
 const start=at(span.start,7),end=at(span.end,7);
 const rise=51,upperRise=58;
 const a=p(start.x,start.y-20-rise);
 const b=p(end.x+40,end.y-rise);
 const c=p(end.x,end.y+20-rise);
 const d=p(start.x-40,start.y-rise);
 const A=up(a,upperRise+11),B=up(b,upperRise+11);
 const C=up(c,upperRise),D=up(d,upperRise);
 const front=(t:number,drop=0)=>up(mix(D,C,t),-drop);
 const roofBack=(t:number)=>mix(A,B,t);
 const roofFront=(t:number)=>mix(D,C,t);
 const face=(u:number,v:number,top:number,bottom:number)=>
  polygon([front(u,top),front(v,top),front(v,bottom),front(u,bottom)]);
 const count=span.end-span.start+1;
 return <g data-testid={'ground-industrial-skyline-'+span.start+'-to-'+span.end}
   data-architectural-form="connected-glazed-research-industrial-gallery"
   data-footprint={span.cells.join(' ')}
   pointerEvents="none" aria-hidden="true">
   {/* Strong end return and one continuous panelled upper front. */}
   <path d={polygon([B,C,c,b])}
     fill="#182f39" stroke="#98a69a" strokeWidth="2.2"/>
   <path d={polygon([D,C,c,d])}
     fill="url(#k47-upper-industrial-front)"
     stroke="#1b343e" strokeWidth="3.1"/>
   <path d={face(.015,.985,8,47)} fill="#172d39"
     stroke="#b5b8a0" strokeWidth="2.4"/>
   {/* Shared upper observation glazing: each of the large windows is
       one panel within a connected building, not one tiny house per cell. */}
   {Array.from({length:count*2},(_,i)=>{
     const u=(i+.15)/(count*2),v=(i+.88)/(count*2);
     return <g key={i} data-testid="ground-industrial-skyline-window">
       <path d={face(u,v,13,39)}
         fill="url(#k47-upper-industrial-glass)"
         stroke="#9fbcb0" strokeWidth="1.9"/>
       <path d={path([front(u,20),front(v,20)])}
         stroke="#b1e2d1" strokeOpacity=".68"
         strokeWidth="1.6" fill="none"/>
       <path d={path([front((u+v)/2,13),front((u+v)/2,39)])}
         stroke="#143644" strokeWidth="2.5" fill="none"/>
       <path d={face(u,v,40,44)} fill="#be9c6f"/>
     </g>;
   })}
   {/* Continuous structural fascia, base rivets and warm recessed lamps
       preserve plausible scale at a 390px follow viewport. */}
   <path d={face(0,1,48,55)}
     fill="#1c313a" stroke="#d0af7b" strokeWidth="1.6"/>
   <path d={path([front(0,49),front(1,49)])}
     stroke="#d3b48d" strokeWidth="3.2" fill="none"/>
   {Array.from({length:count+1},(_,i)=>{
     const t=i/count,pt=front(t,53);
     return <g key={i}>
       <path d={path([front(t,7),front(t,48)])}
         stroke="#334d54" strokeWidth="4.3" fill="none"/>
       <path d={path([front(t,7),front(t,45)])}
         stroke="#94a79c" strokeWidth="1.1" fill="none"/>
       <ellipse cx={pt.x} cy={pt.y} rx="11" ry="7"
         fill="url(#k47-upper-industrial-glow)"/>
       <circle cx={pt.x} cy={pt.y} r="2.7" fill="#ffcb8d"/>
     </g>;
   })}
   {/* A stepped, chamfered roof physically attached to the upper façade;
       no second imaginary floor, no tall floating sign. */}
   <path d={polygon([A,B,C,D])}
     fill="url(#k47-upper-industrial-roof)"
     stroke="#bac4af" strokeWidth="3.1"/>
   <path d={polygon([
     mix(A,D,.16),mix(B,C,.16),mix(B,C,.30),mix(A,D,.30),
   ])} fill="#223d47" opacity=".72"/>
   <path d={path([A,B])}
     stroke="#1c3440" strokeWidth="7.8" fill="none"/>
   <path d={path([D,C])}
     stroke="#efd0a0" strokeWidth="3.6" fill="none"/>
   {Array.from({length:count*2+1},(_,i)=>{
     const t=i/(count*2),from=mix(roofBack(t),roofFront(t),.25);
     const to=mix(roofBack(t),roofFront(t),.78);
     return <path key={i} d={path([from,to])} fill="none"
       stroke={i%2?'#9caf9f':'#243e47'}
       strokeWidth={i%2?1.4:2.7} opacity=".75"/>;
   })}
   {/* One asymmetric sealed rooftop exhaust/cooling assembly. All of it
       is scenery sitting above the original blocked hangar frontage. */}
   <g data-testid="ground-industrial-skyline-roof-plant">
     <path d={polygon([
       up(mix(A,D,.39),3),up(mix(A,B,.14),3),
       up(mix(A,B,.24),3),up(mix(A,D,.54),3),
     ])} fill="#203843" opacity=".7"/>
     {[-1,1].map((dir,i)=>{
       const base=mix(A,B,i===0?.15:.28);
       return <g key={i}>
         <path d={polygon([
           p(base.x-7,base.y-4),p(base.x+7,base.y-4),
           p(base.x+5,base.y-33-dir*5),p(base.x-5,base.y-33-dir*5),
         ])} fill="#47616a" stroke="#d0c1a2" strokeWidth="1.8"/>
         <path d={polygon([
           p(base.x-10,base.y-35-dir*5),p(base.x+10,base.y-35-dir*5),
           p(base.x+8,base.y-40-dir*5),p(base.x-8,base.y-40-dir*5),
         ])} fill="#c0ad86" stroke="#2b4550" strokeWidth="1.4"/>
       </g>;
     })}
     <path d={polygon([
       up(mix(B,C,.32),13),up(mix(B,C,.72),13),
       up(mix(B,C,.72),24),up(mix(B,C,.32),24),
     ])} fill="#3d5960" stroke="#b8c1a7" strokeWidth="1.5"/>
     <path d={path([up(mix(B,C,.45),16),up(mix(B,C,.45),24)])}
       stroke="#d2b98a" strokeWidth="2.2"/>
   </g>
   <title>Galería industrial panorámica del hangar, estructura sellada</title>
 </g>;
}

export function GroundIndustrialSkyline({spans,visible}:Props){
 const ready=spans.filter(span=>span.end>span.start&&
   span.cells.every(cell=>visible.has(cell)));
 return <g data-testid="ground-industrial-skyline"
   data-visible-spans={ready.length}
   pointerEvents="none" aria-hidden="true">
  <defs>
   <linearGradient id="k47-upper-industrial-front" x1=".1" y1="0" x2=".4" y2="1">
     <stop stopColor="#8a9c8e"/>
     <stop offset=".42" stopColor="#577b78"/>
     <stop offset="1" stopColor="#274752"/>
   </linearGradient>
   <linearGradient id="k47-upper-industrial-glass" x1="0" y1="0" x2=".25" y2="1">
     <stop stopColor="#a4ded2"/>
     <stop offset=".30" stopColor="#438d9a"/>
     <stop offset=".66" stopColor="#21586b"/>
     <stop offset="1" stopColor="#102c42"/>
   </linearGradient>
   <linearGradient id="k47-upper-industrial-roof" x1=".1" y1="0" x2=".8" y2="1">
     <stop stopColor="#bbc2b2"/>
     <stop offset=".53" stopColor="#7b9187"/>
     <stop offset="1" stopColor="#375b60"/>
   </linearGradient>
   <radialGradient id="k47-upper-industrial-glow">
     <stop stopColor="#fdd093" stopOpacity=".43"/>
     <stop offset="1" stopColor="#fdd093" stopOpacity="0"/>
   </radialGradient>
  </defs>
  {ready.map(span=><VisibleIndustrialGallery key={span.start} span={span}/>)}
 </g>;
}
