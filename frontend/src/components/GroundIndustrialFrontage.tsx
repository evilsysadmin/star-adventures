import world from '../../../content/scenes/meridian.json';

// Complete, continuous frontage for the existing SOUTH retaining wall.
// This is authored architectural art for canonical BLOCKED cells (x=1..8,
// y=7), not an extended floor or another path. Rendered after ground fog
// because its discovered roof may rise over the silhouette of unknown ground.
const surface=world.scenes.surface;
const footprint=Array.from({length:8},(_,index)=>({x:index+1,y:7}));
const wallKeys=new Set(surface.walls.map(cell=>cell.x+','+cell.y));
const valid=footprint.every(cell=>wallKeys.has(cell.x+','+cell.y));
const at=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Span={start:number;end:number;lit:boolean};

function visibleSpans(explored:ReadonlySet<string>,visible:ReadonlySet<string>):Span[]{
 const result:Span[]=[];
 let current:Span|null=null;
 for(let x=1;x<=9;x++){
  const known=x<=8&&explored.has(x+',7');
  const lit=known&&visible.has(x+',7');
  if(!known){
   if(current&&current.end>current.start)result.push(current);
   current=null;continue;
  }
  if(current&&current.lit===lit){current.end=x;continue;}
  if(current&&current.end>current.start)result.push(current);
  current={start:x,end:x,lit};
 }
 return result;
}
const format=(x:number)=>x.toFixed(2);
const polygon=(points:Array<{x:number;y:number}>)=>
 points.map((p,i)=>(i?'L':'M')+format(p.x)+' '+format(p.y)).join(' ')+'Z';

// The south-facing part of the colony should read as one substantial
// installation, not one floating metal cube per block. Every span is made
// solely from already explored, same-visibility physical wall cells.
function IndustrialSpan({start,end,lit}:Span){
 const p=at(start,7),q=at(end,7);
 const roofBackA={x:p.x+21,y:p.y-83},roofBackB={x:q.x+21,y:q.y-83};
 const roofFrontA={x:p.x-23,y:p.y-59},roofFrontB={x:q.x-23,y:q.y-59};
 const sideA={x:roofFrontA.x,y:roofFrontA.y+71};
 const sideB={x:roofFrontB.x,y:roofFrontB.y+71};
 const facade=(a:number,b:number,top:number,bottom:number)=>polygon([
  {x:roofFrontA.x+(roofFrontB.x-roofFrontA.x)*a,
   y:roofFrontA.y+(roofFrontB.y-roofFrontA.y)*a+top},
  {x:roofFrontA.x+(roofFrontB.x-roofFrontA.x)*b,
   y:roofFrontA.y+(roofFrontB.y-roofFrontA.y)*b+top},
  {x:roofFrontA.x+(roofFrontB.x-roofFrontA.x)*b,
   y:roofFrontA.y+(roofFrontB.y-roofFrontA.y)*b+bottom},
  {x:roofFrontA.x+(roofFrontB.x-roofFrontA.x)*a,
   y:roofFrontA.y+(roofFrontB.y-roofFrontA.y)*a+bottom},
 ]);
 const count=end-start+1;
 const line=(a:{x:number;y:number},b:{x:number;y:number},dy=0)=>
  'M'+format(a.x)+' '+format(a.y+dy)+'L'+format(b.x)+' '+format(b.y+dy);
 return <g data-testid={'ground-frontage-span-'+start+'-'+end}
   data-footprint={Array.from({length:count},(_,i)=>(i+start)+',7').join(' ')}
   data-fog={lit?'visible':'remembered'} opacity={lit?1:.47}
   pointerEvents="none" aria-hidden="true">
   {/* Receding foundation, shadow and 71-unit-tall uninterrupted facade. */}
   <path d={polygon([
      {x:sideA.x-8,y:sideA.y+8},{x:sideB.x+9,y:sideB.y+8},
      {x:roofBackB.x+15,y:roofBackB.y+88},
      {x:roofBackA.x-14,y:roofBackA.y+88},
    ])} fill="#071a21" opacity=".82"/>
   <path d={polygon([roofFrontA,roofFrontB,sideB,sideA])}
      fill="url(#frontage-south-face)" stroke="#152c34" strokeWidth="2.5"/>
   <path d={polygon([
     roofBackB,roofFrontB,sideB,{x:roofBackB.x,y:roofBackB.y+71},
    ])} fill="#1c3740" stroke="#0f2b37" strokeWidth="2.5"/>
   <path d={facade(0,1,55,71)} fill="#203740" />
   <path d={facade(0,1,60,63)} fill="#baa17a" opacity=".9"/>
   {/* Structural bays are integrated in one shell; no doors in blocked
       cells or falsely traversable gantry floors are represented. */}
   {Array.from({length:count},(_,i)=>{
    const a=(i+.12)/count,b=(i+.88)/count;
    const accent=i%3===1?'#dfb37b':'#8dd5cc';
    return <g key={i}>
      <path d={facade(a,b,11,44)} fill="#102a35"
        stroke="#849d98" strokeWidth="1.7"/>
      <path d={facade(a+.035/count,b-.035/count,14,39)}
        fill="url(#frontage-blue-glazing)" opacity=".95"/>
      <path d={facade(a+.34/count,a+.40/count,12,43)}
        fill="#14333d"/>
      <path d={facade(a+.04/count,b-.04/count,44,49)}
        fill="#465e5c" stroke="#aab8a5" strokeWidth=".8"/>
      <path d={facade(a,b,6,9)} fill="#9caca3" opacity=".65"/>
      <path d={facade(a,b,50,53)} fill="#192f36"/>
      <path d={facade(a+.1/count,b-.1/count,53,55)} fill={accent} opacity=".8"/>
      <circle cx={roofFrontA.x+(roofFrontB.x-roofFrontA.x)*(i+.5)/count}
        cy={roofFrontA.y+(roofFrontB.y-roofFrontA.y)*(i+.5)/count+6}
        r="2.5" fill={accent}/>
    </g>;
   })}
   {/* A complete parapet, roof and raised drainage spine connect the bays. */}
   <path d={polygon([roofBackA,roofBackB,roofFrontB,roofFrontA])}
      fill="url(#frontage-cast-metal)" stroke="#b2b59e" strokeWidth="2.6"/>
   <path d={line(roofBackA,roofBackB,3)}
      stroke="#2a4850" strokeWidth="8" fill="none"/>
   <path d={line(roofBackA,roofBackB,2)}
      stroke="#9bb9b3" strokeWidth="2.4" fill="none"/>
   <path d={line(roofFrontA,roofFrontB)}
      stroke="#e3c48c" strokeWidth="3.7" fill="none"/>
   <path d={line(roofFrontA,roofFrontB,6)}
      stroke="#142d35" strokeWidth="3" fill="none"/>
   <path d={line(roofFrontA,roofFrontB,60)}
      stroke="#d2b58a" strokeWidth="2.5" fill="none" opacity=".75"/>
   {/* Roof conduits and service grilles have one shared rhythm, rather
       than eight separately repeated miniature roof textures. */}
   {[.2,.47,.74].map((t,i)=>{
     const x=roofBackA.x+(roofBackB.x-roofBackA.x)*t;
     const y=roofBackA.y+(roofBackB.y-roofBackA.y)*t;
     return <g key={i}>
      <path d={'M'+(x-10)+' '+(y+11)+'l14 -8 21 11 -14 8Z'}
        fill="#1f3b44" stroke="#9aafa3" strokeWidth="1.6"/>
      <path d={'M'+(x-6)+' '+(y+10)+'l11 6M'+(x+1)+' '+(y+7)+'l11 6'}
        stroke="#658b86" strokeWidth="1.6" fill="none"/>
     </g>;
   })}
   {/* Suspended railing above real blocked foundations, no crossing of
       the open perimeter entries at x=8,y=4 or x=8,y=6. */}
   <path d={line(roofFrontA,roofFrontB,-17)}
     stroke="#97ada4" strokeWidth="2.3" fill="none"/>
   <path d={line(roofFrontA,roofFrontB,-12)}
     stroke="#283f45" strokeWidth="3.2" fill="none"/>
   {Array.from({length:count+1},(_,i)=>{
      const t=i/count,x=roofFrontA.x+(roofFrontB.x-roofFrontA.x)*t;
      const y=roofFrontA.y+(roofFrontB.y-roofFrontA.y)*t;
      return <path key={i} d={'M'+x+' '+y+'v-18'}
        stroke="#b6c0ad" strokeWidth="2.3" />;
   })}
   <title>Frente industrial continuo de la colonia</title>
 </g>;
}

export function GroundIndustrialFrontage({explored,visible}:Vision){
 if(!valid)return null;
 return <g data-testid="ground-industrial-frontage"
   pointerEvents="none" aria-hidden="true">
   <defs>
    <linearGradient id="frontage-south-face" x1="0" y1="0" x2="1" y2="1">
      <stop stopColor="#78847d"/>
      <stop offset=".33" stopColor="#435e5c"/>
      <stop offset=".68" stopColor="#29454c"/>
      <stop offset="1" stopColor="#182f3a"/>
    </linearGradient>
    <linearGradient id="frontage-blue-glazing" x1="0" y1="0" x2=".9" y2="1">
      <stop stopColor="#a5e3d8"/>
      <stop offset=".35" stopColor="#427e87"/>
      <stop offset=".8" stopColor="#205364"/>
      <stop offset="1" stopColor="#102e3d"/>
    </linearGradient>
    <linearGradient id="frontage-cast-metal" x1="0" y1="0" x2=".8" y2="1">
      <stop stopColor="#b1b5a4"/>
      <stop offset=".34" stopColor="#7c8980"/>
      <stop offset=".74" stopColor="#536a69"/>
      <stop offset="1" stopColor="#2c444e"/>
    </linearGradient>
   </defs>
   {visibleSpans(explored,visible).map(span=>
     <IndustrialSpan key={span.start+'-'+span.end} {...span}/>)}
 </g>;
}
