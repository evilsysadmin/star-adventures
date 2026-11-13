// Original, visible SVG environment volume for the genuine 2,2..4,2 science
// footprint. This is a reusable authored *building*, not a clickable tile or
// a new mission. It remains fully available without WebGL or R2 publication.
type Point={x:number;y:number};
type Props={known:boolean;visible:ReadonlySet<string>};
const at=(x:number,y:number):Point=>({x:440+(x-y)*40,y:52+(x+y)*20});
const point=(x:number,y:number):Point=>({x,y});
const add=(p:Point,x:number,y:number):Point=>point(p.x+x,p.y+y);
const mix=(a:Point,b:Point,t:number):Point=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const shape=(coords:ReadonlyArray<Point>)=>
  coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')+'Z';
const trace=(coords:ReadonlyArray<Point>)=>
  coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');

// The campus is a single 3-cell industrial envelope. Every modular bay uses
// the same façade grammar, and has no independent world occupancy.
function GlazedBay({u,v,front}:{u:number;v:number;front:(t:number,drop?:number)=>Point}){
 const panel=(l:number,r:number,top:number,bottom:number)=>shape([
  front(l,top),front(r,top),front(r,bottom),front(l,bottom)]);
 return <g data-testid="ground-science-glazed-bay">
  <path d={panel(u,v,12,44)} fill="#112b35" stroke="#91aaa5" strokeWidth="1.8"/>
  <path d={panel(u+.018,v-.018,15,39)}
    fill="url(#k47-science-deep-glass)"/>
  <path d={panel(u+.025,v-.025,17,21)} fill="#b0e6d8" opacity=".26"/>
  <path d={trace([front((u+v)/2,14),front((u+v)/2,43)])}
    fill="none" stroke="#163742" strokeWidth="3"/>
  <path d={panel(u,v,44,48)} fill="#c3a77a"/>
  <path d={trace([front(u,30),front(v,30)])}
    fill="none" stroke="#1c4147" strokeWidth="1.7"/>
 </g>;
}

export function GroundScienceCampus({known,visible}:Props){
 if(!known)return null;
 const footprint=['2,2','3,2','4,2'];
 const lit=footprint.every(cell=>visible.has(cell));
 const start=at(2,2),end=at(4,2);
 // The building's floor is unchanged. Projected height is decorative only.
 const height=64;
 const a=point(start.x,start.y-20-height);
 const b=point(end.x+40,end.y-height);
 const c=point(end.x,end.y+20-height);
 const d=point(start.x-40,start.y-height);
 const front=(t:number,drop=0)=>add(mix(d,c,t),0,drop);
 const back=(t:number,drop=0)=>add(mix(a,b,t),0,drop);
 const segment=(l:number,r:number,top:number,bottom:number)=>shape([
  front(l,top),front(r,top),front(r,bottom),front(l,bottom)]);
 const upper={a:add(mix(a,b,.20),0,-38),b:add(mix(a,b,.77),0,-38),
  c:add(mix(d,c,.77),0,-38),d:add(mix(d,c,.20),0,-38)};
 const upperBase={a:mix(a,b,.20),b:mix(a,b,.77),
  c:mix(d,c,.77),d:mix(d,c,.20)};
 const tierTop=shape([upper.a,upper.b,upper.c,upper.d]);
 // The true 3-cell footprint gives five façade bays across the connected
 // span; this shared grammar is reusable for other sealed science frontages.
 const bays=[.045,.235,.425,.615,.805].map(u=>({u,v:u+.15}));
 const sills=[.12,.31,.50,.69,.88];
 return <g data-testid="ground-science-campus"
   data-footprint="2,2 3,2 4,2"
   data-render-class="k47-research-superstructure"
   data-fog={lit?'visible':'remembered'}
   opacity={lit?1:.35} pointerEvents="none" aria-hidden="true">
   <defs>
    <linearGradient id="k47-science-facade" x1="0" y1="0" x2=".3" y2="1">
     <stop stopColor="#70827a"/><stop offset=".38" stopColor="#405f61"/>
     <stop offset="1" stopColor="#1a353f"/>
    </linearGradient>
    <linearGradient id="k47-science-roof" x1=".1" y1="0" x2=".8" y2="1">
     <stop stopColor="#aeb5a0"/><stop offset=".37" stopColor="#617e76"/>
     <stop offset="1" stopColor="#2c4e55"/>
    </linearGradient>
    <linearGradient id="k47-science-deep-glass" x1="0" y1="0" x2="0" y2="1">
     <stop stopColor="#a4ddd0"/><stop offset=".28" stopColor="#3b98a2"/>
     <stop offset=".62" stopColor="#19556c"/><stop offset="1" stopColor="#0b2738"/>
    </linearGradient>
    <linearGradient id="k47-science-atrium" x1="0" y1="0" x2="1" y2="1">
     <stop stopColor="#b4d0bc"/><stop offset=".22" stopColor="#3b7f87"/>
     <stop offset="1" stopColor="#142f3e"/>
    </linearGradient>
    <radialGradient id="k47-science-warm-glow">
     <stop stopColor="#ffd9a4" stopOpacity=".68"/>
     <stop offset="1" stopColor="#ffd9a4" stopOpacity="0"/>
    </radialGradient>
   </defs>
   {/* One large foundation and recognisable silhouette, not a tiny house
       on every grid tile. No false stair or new accessible rooftop. */}
   <path d={shape([add(d,-5,65),add(c,6,65),add(b,6,66),add(a,-5,66)])}
     fill="#0b1f27" opacity=".58"/>
   <path d={shape([b,c,add(c,0,64),add(b,0,64)])}
     fill="#1b3742" stroke="#0b2630" strokeWidth="2.5"/>
   <path d={shape([d,c,add(c,0,64),add(d,0,64)])}
     fill="url(#k47-science-facade)" stroke="#152f38" strokeWidth="2.8"/>
   <path d={segment(0,1,58,66)} fill="#172d36"/>
   <path d={segment(0,1,68,74)} fill="#a99170"/>
   <path d={segment(.025,.975,7,54)} fill="#152e39" stroke="#799995"
     strokeWidth="2.3"/>
   {bays.map((p,i)=><GlazedBay key={i} u={p.u} v={p.v} front={front}/>)}
   {sills.map((t,i)=><g key={i}>
     <path d={trace([front(t,9),front(t,56)])}
       stroke="#234451" strokeWidth="3.8" fill="none"/>
     <circle cx={front(t,54).x} cy={front(t,54).y} r="3.5"
       fill={i%2?'#b4e7dc':'#f4b975'}/>
    </g>)}
   {/* Strong continuous metal roof; visible even at full-colony zoom. */}
   <path d={shape([a,b,c,d])} fill="url(#k47-science-roof)"
     stroke="#d0c5a7" strokeWidth="3.2"/>
   <path d={trace([add(a,0,-3),add(b,0,-3)])}
     stroke="#203944" strokeWidth="10" fill="none"/>
   <path d={trace([d,c])} stroke="#e9c78c"
     strokeWidth="4.5" fill="none"/>
   <path d={shape([mix(a,d,.69),mix(b,c,.69),mix(b,c,.79),mix(a,d,.79)])}
     fill="#273e47" opacity=".84"/>
   {/* Five long roof ribs make this genuinely one industrial structure. */}
   {sills.map((t,i)=><path key={i}
     d={trace([mix(back(t),front(t),.17),mix(back(t),front(t),.95)])}
     stroke={i%2?'#c5bca3':'#253f46'} strokeWidth={i%2?2:4}
     fill="none" opacity=".82"/>)}
   {/* A substantial elevated glass-and-steel research atrium. These roof
       masses are tall but sit on the very same three blocked world cells. */}
   <g data-testid="ground-science-upper-atrium">
     <path d={shape([upper.d,upper.c,upperBase.c,upperBase.d])}
       fill="url(#k47-science-atrium)" stroke="#193641" strokeWidth="2.4"/>
     <path d={shape([upper.b,upper.c,upperBase.c,upperBase.b])}
       fill="#1c3c46" stroke="#1a333c" strokeWidth="1.8"/>
     {[.08,.29,.50,.71].map((t,i)=>{
       const p=mix(upper.d,upper.c,t),q=mix(upper.d,upper.c,t+.15);
       return <g key={i}>
         <path d={shape([add(p,0,8),add(q,0,8),add(q,0,38),add(p,0,38)])}
           fill="url(#k47-science-deep-glass)" stroke="#98bbb0"
           strokeWidth="1.5"/>
         <path d={trace([add(p,0,43),add(q,0,43)])}
           stroke="#dfc08c" strokeWidth="2.5" fill="none"/>
       </g>;
     })}
     <path d={tierTop} fill="#526f6e" stroke="#d2ccb0" strokeWidth="3"/>
     <path d={shape([
       mix(upper.a,upper.d,.32),mix(upper.b,upper.c,.32),
       mix(upper.b,upper.c,.76),mix(upper.a,upper.d,.76),
      ])} fill="#1d404b" stroke="#9ab4a5" strokeWidth="1.8"/>
     <path d={trace([upper.d,upper.c])}
       stroke="#f0cd95" strokeWidth="3.3" fill="none"/>
     <path d={trace([upper.a,upper.b])}
       stroke="#162f3b" strokeWidth="5.6" fill="none"/>
   </g>
   {/* Asymmetric service plant and capacitors: 2 connected architectural
       masses instead of an army of repeated generic ventilation boxes. */}
   <g data-testid="ground-science-roof-plant">
    <path d={shape([add(back(.04),0,-8),add(back(.18),0,-8),
      add(front(.18),0,-8),add(front(.04),0,-8)])}
      fill="#29434b" stroke="#8ca6a0" strokeWidth="2"/>
    {[.04,.10,.16].map((t,i)=>{
     const q=back(t);
     return <g key={i}>
       <path d={trace([add(q,0,-8),add(q,0,-34-(i%2)*8)])}
         fill="none" stroke="#b4b6a1" strokeWidth="5"/>
       <path d={trace([add(q,0,-36-(i%2)*8),add(q,0,-46-(i%2)*8)])}
         fill="none" stroke="#1b4b54" strokeWidth="7"/>
       <circle cx={q.x} cy={q.y-45-(i%2)*8} r="4"
         fill="#efbb80" stroke="#f7d5a8" strokeWidth="1.4"/>
     </g>;
    })}
    {/* A sealed service duct following the roof, with painted vents. */}
    <path d={trace([mix(a,d,.91),mix(b,c,.91)])}
      fill="none" stroke="#263f46" strokeWidth="11"/>
    <path d={trace([mix(a,d,.91),mix(b,c,.91)])}
      fill="none" stroke="#91a99c" strokeWidth="2.5"
      strokeDasharray="9 7"/>
   </g>
   <ellipse cx={front(.04,56).x} cy={front(.04,56).y}
     rx="24" ry="13" fill="url(#k47-science-warm-glow)"/>
   <ellipse cx={front(.94,56).x} cy={front(.94,56).y}
     rx="24" ry="13" fill="url(#k47-science-warm-glow)"/>
   <title>Complejo científico de tres módulos conectados, con atrio superior sellado</title>
 </g>;
}
