import world from '../../../content/scenes/meridian.json';

// The northern retaining works are not an invented skyline. Their entire
// footprint is the canonical, permanently BLOCKED wall row y=0, x=1..7.
// A piece appears only when its real cells are explored. Unknown gaps split
// the visual run; a long beam must never reveal unseen wall topology.
const scene=world.scenes.surface;
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Point={x:number;y:number};
type Span={start:number;end:number;cells:string[]};
const id=(x:number,y:number)=>x+','+y;
const at=(x:number,y:number):Point=>({x:440+(x-y)*40,y:52+(x+y)*20});
const lerp=(a:Point,b:Point,t:number):Point=>({
 x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,
});
const outline=(pts:readonly Point[])=>pts.map((p,i)=>
 (i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ')+'Z';
const realNorth=new Set(scene.walls.filter(c=>c.y===0&&c.x>=1&&c.x<=7)
 .map(c=>id(c.x,c.y)));

function exploredSpans(explored:ReadonlySet<string>):Span[]{
 const spans:Span[]=[];
 let first=-1,run:string[]=[];
 const close=()=>{
  if(run.length)spans.push({start:first,end:first+run.length-1,cells:run});
  first=-1;run=[];
 };
 for(let x=1;x<=8;x++){
  const cell=id(x,0);
  if(x<=7&&realNorth.has(cell)&&explored.has(cell)){
   if(!run.length)first=x;
   run.push(cell);
  }else close();
 }
 return spans;
}

function NorthRetainingSpan({span,visible}:{span:Span;visible:ReadonlySet<string>}){
 const first=at(span.start,0),last=at(span.end,0),rise=43;
 const a={x:first.x,y:first.y-20-rise};
 const b={x:last.x+40,y:last.y-rise};
 const c={x:last.x,y:last.y+20-rise};
 const d={x:first.x-40,y:first.y-rise};
 const front=(t:number,drop=0):Point=>{
  const p=lerp(d,c,t);return {x:p.x,y:p.y+drop};
 };
 const panel=(u:number,v:number,top:number,bottom:number)=>
  outline([front(u,top),front(v,top),front(v,bottom),front(u,bottom)]);
 const count=span.cells.length;
 const lit=span.cells.every(k=>visible.has(k));
 return <g data-testid={'ground-north-retaining-span-'+span.start+'-'+span.end}
   data-footprint={span.cells.join(' ')}
   data-fog={lit?'visible':'remembered'} opacity={lit?1:.38}
   pointerEvents="none" aria-hidden="true">
   {/* Massive low retaining facade; it is BEHIND every traversable tile,
       officer and 3D building, and directly above its real blocked row. */}
   <path d={outline([d,c,{x:c.x,y:c.y+43},{x:d.x,y:d.y+43}])}
     fill="url(#ground-north-retaining-cladding)"
     stroke="#11272e" strokeWidth="2.5"/>
   <path d={outline([a,b,c,d])} fill="url(#ground-north-retaining-roof)"
     stroke="#87978d" strokeWidth="2"/>
   <path d={panel(0,1,5,10)} fill="#182f36"
     stroke="#84988d" strokeWidth="1.2"/>
   <path d={panel(0,1,36,40)} fill="#152e37"
     stroke="#ae9469" strokeWidth="1.3"/>
   {/* Repeated service bays are divisions of the SAME wall envelope,
       not extra independent little buildings or fictional entrances. */}
   {Array.from({length:count},(_,i)=>{
    const u=(i+.12)/count,v=(i+.88)/count;
    const cold=i%3!==1;
    const mid=front((i+.5)/count);
    return <g key={i} data-testid={'ground-north-bay-'+(span.start+i)}>
      <path d={panel(u,v,13,31)} fill="#112d37"
        stroke="#789592" strokeWidth="1.35"/>
      <path d={panel(u+.045/count,v-.045/count,16,27)}
        fill={cold?'#365b60':'#7b6652'} stroke="#1a3940" strokeWidth="1.2"/>
      <path d={panel(u+.36/count,v-.36/count,16,27)}
        fill="#152e38" opacity=".66"/>
      <path d={'M'+mid.x+' '+(mid.y+31)+'v8'}
        stroke="#b39c74" strokeWidth="1.8"/>
      {i%2===0&&<circle cx={mid.x} cy={mid.y+12} r="2.6"
        fill="#e7b77b" opacity=".84"/>}
    </g>;
   })}
   {/* One continuous restrained industrial parapet, no traversal cue. */}
   <path d={'M'+a.x+' '+a.y+'L'+b.x+' '+b.y}
     stroke="#273d42" strokeWidth="5" fill="none"/>
   <path d={'M'+(a.x+3)+' '+(a.y+3)+'L'+(b.x+3)+' '+(b.y+3)}
     stroke="#a7b8a5" strokeWidth="1.4" fill="none"/>
   <path d={'M'+front(0,41).x+' '+front(0,41).y+
     'L'+front(1,41).x+' '+front(1,41).y}
     stroke="#6f8780" strokeWidth="3" fill="none"/>
   <title>Retención industrial del perímetro norte</title>
 </g>;
}

export function GroundNorthIndustrialRetainingWall({explored,visible}:Vision){
 const spans=exploredSpans(explored);
 return <g data-testid="ground-north-industrial-retaining"
   data-wall-row="0" data-physical-footprint="1,0 2,0 3,0 4,0 5,0 6,0 7,0"
   aria-hidden="true" pointerEvents="none">
   <defs>
    <linearGradient id="ground-north-retaining-cladding"
      gradientUnits="userSpaceOnUse" x1="430" y1="20" x2="770" y2="240">
      <stop stopColor="#536d6a"/>
      <stop offset=".45" stopColor="#304d50"/>
      <stop offset="1" stopColor="#1b343b"/>
    </linearGradient>
    <linearGradient id="ground-north-retaining-roof"
      gradientUnits="userSpaceOnUse" x1="480" y1="-20" x2="820" y2="170">
      <stop stopColor="#506660"/>
      <stop offset=".6" stopColor="#3c5552"/>
      <stop offset="1" stopColor="#263f46"/>
    </linearGradient>
   </defs>
   {spans.map(span=><NorthRetainingSpan key={span.start}
     span={span} visible={visible}/>)}
 </g>;
}
