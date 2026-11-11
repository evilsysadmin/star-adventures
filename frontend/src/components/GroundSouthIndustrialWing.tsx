import type {SouthWingSpan} from '../groundSouthIndustrialSpans';

// The south perimeter is one original industrial enclosure, not a pile of
// unrelated per-cell crates. Every span is made exclusively of canonical
// BLOCKED wall cells that have already been explored; no roof may leak an
// unknown wall or create a false walkable bridge. The SVG is entirely passive.
const at=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
type Point={x:number;y:number};
type Props={spans:ReadonlyArray<SouthWingSpan>;visible:ReadonlySet<string>};
const point=(x:number,y:number):Point=>({x,y});
const polygon=(coords:ReadonlyArray<Point>)=>
 coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')+'Z';
const lerp=(a:Point,b:Point,t:number):Point=>
 point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const offset=(p:Point,dx:number,dy:number):Point=>point(p.x+dx,p.y+dy);

function ConnectedSouthHangar({span,visible}:{span:SouthWingSpan;visible:ReadonlySet<string>}){
 const count=span.end-span.start+1;
 const start=at(span.start,7),end=at(span.end,7);
 // The roof is a single isometric slab over a contiguous 1xN wall row.
 // The wall rises from that SAME tile footprint, not from a walkable cell.
 const rise=51;
 const a=point(start.x,start.y-20-rise);
 const b=point(end.x+40,end.y-rise);
 const c=point(end.x,end.y+20-rise);
 const d=point(start.x-40,start.y-rise);
 const front=(t:number,drop=0)=>offset(lerp(d,c,t),0,drop);
 const upper=(t:number,drop=0)=>offset(lerp(a,b,t),0,drop);
 const quad=(u:number,v:number,top:number,bottom:number)=>polygon([
  front(u,top),front(v,top),front(v,bottom),front(u,bottom),
 ]);
 const roof=[a,b,c,d];
 const allLit=span.cells.every(k=>visible.has(k));
 const id=span.start+'-to-'+span.end;
 const bayCount=count;
 const machineCenter=lerp(upper(.43),front(.43),.24);
 return <g key={id}
  data-testid={'ground-south-industrial-hangar-'+id}
  data-footprint={span.cells.join(' ')}
  data-fog={allLit?'visible':'remembered'}
  data-render-class="single-continuous-industrial-hangar"
  data-hangar-3d-eligible={allLit?'true':'false'}
  pointerEvents="none" aria-hidden="true"
  opacity={allLit?1:.36}>
  {/* One shadow across the entire authored, physically blocked frontage. */}
  <path d={polygon([
    front(0,52),front(1,52),offset(c,9,64),offset(d,-6,64),
  ])} fill="#07171c" opacity=".70"/>
  {/* Dark structural right return and the continuous front wall, not
      separated mini-houses with gaps between every wall square. */}
  <path d={polygon([b,c,offset(c,0,62),offset(b,0,62)])}
    fill="#1e3b43" stroke="#10262d" strokeWidth="2.5"/>
  <path d={quad(0,1,0,52)}
    fill="url(#k47-south-hangar-front)"
    stroke="#132b32" strokeWidth="2.5"/>
  <path d={quad(0,1,44,49)}
    fill="#132c34" stroke="#be9d68" strokeWidth="1"/>
  {/* Uninterrupted heavy horizontal fascia gives the building real length
      at ordinary camera zoom. Lower gold accent is restrained. */}
  <path d={quad(0,1,1,9)} fill="#132e37"
    stroke="#8ea9a2" strokeWidth="1.6"/>
  <path d={'M'+front(0,7).x+' '+front(0,7).y+
    'L'+front(1,7).x+' '+front(1,7).y}
    fill="none" stroke="#d3ad73" strokeWidth="2.1"/>
  {/* Recessed service bays in a shared shell. Bay spacing is derived from
      the real BLOCKED tiles and therefore never drifts into free territory. */}
  {Array.from({length:bayCount},(_,i)=>{
    const u=(i+.12)/bayCount,v=(i+.89)/bayCount;
    const maintenance=i===0||i===bayCount-1;
    const center=front((i+.5)/bayCount);
    return <g key={i} data-testid={'ground-south-hangar-bay-'+(span.start+i)}>
      <path d={quad(u,v,14,41)}
        fill={maintenance?'#253b40':'#102b34'}
        stroke="#718e8a" strokeWidth="1.7"/>
      {maintenance
       ? <><path d={quad(u+.01,v-.01,18,36)}
         fill="#51666a" stroke="#2b454b" strokeWidth="1.1"/>
         {[22,27,32].map(drop=><path key={drop}
          d={'M'+front(u+.01,drop).x+' '+front(u+.01,drop).y+
            'L'+front(v-.01,drop).x+' '+front(v-.01,drop).y}
          stroke="#9caeaa" strokeWidth=".8" opacity=".5"/>)}
         </>
       : <><path d={quad(u+.025,v-.025,16,37)}
         fill="url(#k47-south-hangar-window)"/>
         <path d={quad((u+v)/2-.008,(u+v)/2+.008,16,37)}
         fill="#193740"/>
         <path d={quad(u+.035,v-.035,36,39)} fill="#d1ad75"/>
         </>}
      <path d={'M'+(center.x-12)+' '+(center.y+46)+
        'l8 4 14 -7'} stroke="#819891" strokeWidth="1.2"
        strokeOpacity=".65" fill="none"/>
      {/* Recessed warm industrial lighting under each roof eave, no
          floating HUD-style icons or invented mission stations. */}
      {i%2===0&&<g>
       <ellipse cx={center.x} cy={center.y+10}
         rx="22" ry="11" fill="url(#k47-south-hangar-amber)"/>
       <path d={'M'+(center.x-3)+' '+(center.y+10)+
         'l6 3'} stroke="#f1d092" strokeWidth="3.5"
         strokeLinecap="round" fill="none"/>
      </g>}
    </g>;
  })}
  {/* Coherent roofline, darker raised parapet and weathered standing seams:
      one uninterrupted silhouette across a row of real building cells. */}
  <path d={polygon(roof)}
    fill="url(#k47-south-hangar-roof)"
    stroke="#c5b58b" strokeWidth="2.6"/>
  <path d={polygon([
    lerp(a,d,.13),lerp(b,c,.13),
    lerp(b,c,.85),lerp(a,d,.85),
  ])} fill="#586e69" opacity=".56"/>
  <path d={polygon(roof)} fill="url(#k47-south-hangar-wear)" opacity=".45"/>
  <path d={'M'+a.x+' '+a.y+'L'+b.x+' '+b.y}
    stroke="#1b353b" strokeWidth="7" fill="none"/>
  <path d={'M'+a.x+' '+(a.y-2)+'L'+b.x+' '+(b.y-2)}
    stroke="#a3b7a7" strokeWidth="2.2" fill="none"/>
  <path d={'M'+d.x+' '+d.y+'L'+c.x+' '+c.y}
    stroke="#e5c48b" strokeWidth="3.1" fill="none"/>
  {/* Longitudinal service conduit and a single real rooftop machinery
      cluster. This breaks the generic every-cell roof repetition. */}
  <path d={'M'+lerp(a,d,.35).x+' '+lerp(a,d,.35).y+
    'L'+lerp(b,c,.35).x+' '+lerp(b,c,.35).y}
    stroke="#28464a" strokeWidth="7" fill="none"/>
  <path d={'M'+lerp(a,d,.35).x+' '+(lerp(a,d,.35).y-2)+
    'L'+lerp(b,c,.35).x+' '+(lerp(b,c,.35).y-2)}
    stroke="#a0b8ae" strokeWidth="1.5" fill="none"/>
  {count>=3&&<g data-testid={'ground-south-hangar-roof-plant-'+id}>
    <ellipse cx={machineCenter.x+3} cy={machineCenter.y+4}
      rx="20" ry="10" fill="#122f35" opacity=".7"/>
    <path d={'M'+(machineCenter.x-22)+' '+(machineCenter.y-4)+
      'l20 -11 24 11 -20 12Z'}
      fill="#253d45" stroke="#a6b6a7" strokeWidth="1.4"/>
    <path d={'M'+(machineCenter.x-22)+' '+(machineCenter.y-4)+
      'v-11l20 -11v11Z'} fill="#485e61" stroke="#192d35" strokeWidth="1.1"/>
    <path d={'M'+(machineCenter.x-2)+' '+(machineCenter.y-15)+
      'v-11l24 11v11Z'} fill="#293f47" stroke="#152d34" strokeWidth="1.1"/>
    {[-11,-5,1,7].map(dx=><path key={dx}
      d={'M'+(machineCenter.x+dx)+' '+(machineCenter.y-9)+
        'l9 4'} stroke="#c5ac79" strokeWidth="1.5" opacity=".75"/>)}
  </g>}
  {/* No decorative plank may act as a click target. */}
  <title>Complejo industrial conectado del perímetro sur</title>
 </g>;
}

export function GroundSouthIndustrialWing({spans,visible}:Props){
 return <g data-testid="ground-south-industrial-wing"
   data-span-count={spans.length} pointerEvents="none" aria-hidden="true">
  <defs>
   <linearGradient id="k47-south-hangar-front" x1="0" y1="0" x2=".12" y2="1">
     <stop stopColor="#6b8781"/>
     <stop offset=".32" stopColor="#4e6c6d"/>
     <stop offset="1" stopColor="#29474f"/>
   </linearGradient>
   <linearGradient id="k47-south-hangar-roof" x1="0" y1="0" x2=".15" y2="1">
     <stop stopColor="#9cafa2"/>
     <stop offset=".48" stopColor="#71887e"/>
     <stop offset="1" stopColor="#416061"/>
   </linearGradient>
   <linearGradient id="k47-south-hangar-window" x1="0" y1="0" x2="0" y2="1">
     <stop stopColor="#87c4b7"/>
     <stop offset=".55" stopColor="#347988"/>
     <stop offset="1" stopColor="#122d3d"/>
   </linearGradient>
   <radialGradient id="k47-south-hangar-amber">
     <stop stopColor="#ffc98a" stopOpacity=".40"/>
     <stop offset="1" stopColor="#ffc98a" stopOpacity="0"/>
   </radialGradient>
   <pattern id="k47-south-hangar-wear" width="33" height="31"
     patternUnits="userSpaceOnUse">
     <path d="M1 3l13 2M21 15l8 -3M3 28l17 -4" fill="none"
       stroke="#132d35" strokeWidth="1.2" opacity=".4"/>
     <path d="M4 19l9 3M23 29l6 -3" fill="none"
       stroke="#dbcda8" strokeWidth=".8" opacity=".33"/>
   </pattern>
  </defs>
  {spans.map(span=><ConnectedSouthHangar key={span.start}
    span={span} visible={visible}/>)}
 </g>;
}
