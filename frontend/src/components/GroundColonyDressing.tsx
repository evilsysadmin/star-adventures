import world from '../../../content/scenes/meridian.json';
import {GroundRescueBayDeck} from './GroundRescueBayDeck';
import {GroundServiceCorridor} from './GroundServiceCorridor';
import {GroundServiceYard} from './GroundServiceYard';
import {GroundColonyWidePlaza} from './GroundColonyWidePlaza';

// Original vector set dressing in the approved colony/away-team direction.
// Every detail is scenery; authoritative terrain, paths and collisions still
// come exclusively from the canonical world JSON and pure ground rules.
const scene=world.scenes.surface;
const project=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const key=(x:number,y:number)=>x+','+y;
const blocked=new Set([...scene.walls,...scene.objects].map(p=>key(p.x,p.y)));
const structuralWalls=new Set(scene.walls.map(p=>key(p.x,p.y)));
const cells=Array.from({length:scene.height},(_,y)=>
 Array.from({length:scene.width},(_,x)=>({x,y}))).flat();
const lights=[[2,3],[3,5],[5,2],[6,6],[7,4],[9,4],[11,6]];
const cargo=scene.walls.filter(p=>[[10,2],[10,6],[4,8],[15,7],[16,9]].some(
 ([x,y])=>p.x===x&&p.y===y));
const rails=scene.walls.filter(p=>(
 (p.y===0&&p.x>0&&p.x<scene.width-1&&p.x%2===1)||
 (p.x===0&&p.y>0&&p.y<scene.height-1&&p.y%2===0)||
 (p.x===scene.width-1&&p.y>0&&p.y<scene.height-1&&p.y%2===0)));
// Both paths are made entirely of real walkable cells. The southern
// maintenance corridor joins the original entrance to form a usable loop.
const paths=[[[3,4],[4,4]],[[4,4],[5,4]],[[5,4],[6,4]],[[5,5],[6,5]],[[6,5],[7,5]],
 [[7,4],[8,4]],[[8,4],[9,4]],[[9,4],[9,5]],[[9,5],[9,6]],
 [[6,6],[7,6]],[[7,6],[8,6]],[[8,6],[9,6]],[[9,6],[9,7]],[[9,7],[10,7]]]
 .filter(([a,b])=>!blocked.has(key(a[0],a[1]))&&!blocked.has(key(b[0],b[1])) &&
   Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1);

// Doorways and perimeter seams are taken from the actual authored collision
// geometry. These are FLOOR-LEVEL trims, never a new wall or a pick target.
// Isometric edges: north (y-1), east (x+1), south (y+1), west (x-1).
const wallEdges=[
 {side:'north',dx:0,dy:-1,from:[0,-20],to:[40,0]},
 {side:'east',dx:1,dy:0,from:[40,0],to:[0,20]},
 {side:'south',dx:0,dy:1,from:[0,20],to:[-40,0]},
 {side:'west',dx:-1,dy:0,from:[-40,0],to:[0,-20]},
] as const;
const corridorRims=cells.filter(p=>p.x<9&&p.y<8&&!blocked.has(key(p.x,p.y)))
 .flatMap(cell=>wallEdges.filter(edge=>
  structuralWalls.has(key(cell.x+edge.dx,cell.y+edge.dy)))
  .map(edge=>({...edge,x:cell.x,y:cell.y,id:key(cell.x,cell.y)})));

type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
const fade=(visible:ReadonlySet<string>,id:string)=>visible.has(id)?1:.34;

export function GroundColonyFloor({explored,visible,separatePlatform=false}:
 Vision & {separatePlatform?:boolean}){
 return <g data-testid="ground-colony-floor" pointerEvents="none">
  {cells.filter(p=>!blocked.has(key(p.x,p.y))&&explored.has(key(p.x,p.y))).map(cell=>{
   const id=key(cell.x,cell.y),p=project(cell.x,cell.y);
   const colony=cell.x<9&&cell.y<8;
   const variant=(cell.x*17+cell.y*13)%6;
   const landing=Math.abs(cell.x-4)+Math.abs(cell.y-6)<=2;
   return <g key={id} data-testid={'ground-dressing-'+id}
    data-fog={visible.has(id)?'visible':'remembered'}
    transform={`translate(${p.x} ${p.y})`} opacity={fade(visible,id)}>
    {colony?<>
     <path d="M-32 0 0 -16 32 0 0 16Z"
      fill="none" stroke="#bac5ad" strokeWidth="1" strokeOpacity=".19" />
     <path d="M-24 0 -5 -10M9 9 27 0M-4 12 13 4"
      fill="none" stroke="#101e22" strokeWidth="2.4" opacity=".42" />
     {(variant===0||variant===3)&&<path d="M-10 -3 0 -8 10 -3 0 2Z"
       fill="#71847a" opacity=".26" />}
     <circle cx="-25" cy="0" r="1.5" fill="#e7cf99" opacity=".42"/>
     <circle cx="24" cy="0" r="1.5" fill="#d3c49d" opacity=".32"/>
     {landing&&<path d="M-20 7 -8 1M-12 10 0 4M4 -7 16 -1"
      stroke="#c7a66a" strokeWidth="3" strokeOpacity=".8" />}
    </>:<>
     <path d={variant%2===0?'M-27 -2 -17 -7 -5 -2 8 -10':'M-22 5 -9 -2 5 4 23 -4'}
      fill="none" stroke="#1a3132" strokeWidth="2.4" opacity=".6" />
     <path d="M-16 8 -8 4M11 -9 19 -4" stroke="#b2ac87"
       strokeWidth="1.8" opacity=".42" />
     {variant===2&&<path d="M-7 3 0 -4 8 1 1 6Z"
      fill="#7a8171" opacity=".38" />}
    </>}
   </g>;
  })}
  {/* The first connected room footprint is the floor beneath route and
       obstacle dressing, never a second source of movement geometry. */}
  <GroundColonyWidePlaza explored={explored} visible={visible}/>
  <GroundRescueBayDeck explored={explored} visible={visible}
     layer={separatePlatform?'underlay':'full'}/>
  {/* The exterior apron continues the real service-gate topology; the
       corridor stays above it so the gateway threshold remains legible. */}
  <GroundServiceYard explored={explored} visible={visible}/>
  <GroundServiceCorridor explored={explored} visible={visible}/>
  {/* Decking is below the wall trims and service-gate panel, so it
       never paints across a doorway or raised entry lip. */}
  {paths.filter(([a,b])=>explored.has(key(a[0],a[1]))&&
      explored.has(key(b[0],b[1]))).map(([a,b],i)=>{
    const from=project(a[0],a[1]),to=project(b[0],b[1]);
    const isVisible=visible.has(key(a[0],a[1]))&&visible.has(key(b[0],b[1]));
    const line=`M${from.x} ${from.y+9} L${to.x} ${to.y+9}`;
    return <g key={i}
      data-testid={'ground-corridor-deck-'+key(a[0],a[1])+'-to-'+key(b[0],b[1])}
      data-fog={isVisible?'visible':'remembered'}
      pointerEvents="none" opacity={isVisible ? 0.86 : 0.26}>
      <path d={line} stroke="#152e36" strokeWidth="22" strokeLinecap="round" fill="none" />
      <path d={line} stroke="#687b76" strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d={line} stroke="#2b4b50" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d={line} stroke="#e1c993" strokeWidth="1.4"
        strokeDasharray="4 10" fill="none"/>
    </g>;
   })}
  {/* Metallic skirting follows real blocked neighbors. Open door and
       service-gate cells stay visually open and physically pickable. */}
  <g data-testid="ground-colony-corridor-rims" pointerEvents="none">
    {corridorRims.filter(edge=>explored.has(edge.id)&&
      explored.has(key(edge.x+edge.dx,edge.y+edge.dy))).map(edge=>{
      const center=project(edge.x,edge.y);
      const line=`M${edge.from[0]} ${edge.from[1]}L${edge.to[0]} ${edge.to[1]}`;
      const inSight=visible.has(edge.id)&&
        visible.has(key(edge.x+edge.dx,edge.y+edge.dy));
      return <g key={edge.id+'-'+edge.side}
        data-testid={'ground-corridor-rim-'+edge.id+'-'+edge.side}
        data-fog={inSight?'visible':'remembered'}
        transform={`translate(${center.x} ${center.y})`}
        opacity={inSight?1:.34}>
        <path d={line} fill="none" stroke="#1a3139" strokeWidth="6"/>
        <path d={line} fill="none" stroke="#baa77e" strokeWidth="2.5"/>
        <path d={line} fill="none" stroke="#9ed3c3" strokeWidth=".85"
          strokeDasharray="5 10"/>
      </g>;
    })}
  </g>
  {/* The maintenance gate occupies an actually walkable grid cell (8,6),
       between two existing blocking perimeter cells (8,5 and 8,7).
       This painting is purely decorative; authoritative movement and fog
       continue to derive from world.scenes.surface. */}
  {explored.has('8,6') && !blocked.has('8,6') && <g
    data-testid="ground-service-gate"
    data-fog={visible.has('8,6')?'visible':'remembered'}
    transform={`translate(${project(8,6).x} ${project(8,6).y})`}
    opacity={fade(visible,'8,6')}>
    <path d="M-31 0 0 -15 31 0 0 15Z"
      fill="#4b6562" stroke="#b7b59b" strokeWidth="1.8"/>
    <path d="M-25 -1 0 -13 25 -1 0 12Z"
      fill="#24484c" stroke="#74b8b1" strokeWidth="1.2"/>
    <path d="M-23 2 -13 -3M-17 7 -7 2M14 -8 23 -3M8 -3 17 2"
      fill="none" stroke="#f1c57d" strokeWidth="2.4" opacity=".86"/>
    <path d="M-5 -4 0 -7 5 -4M-5 3 0 0 5 3"
      fill="none" stroke="#9be0cb" strokeWidth="1.2"/>
    <circle cx="-28" cy="0" r="2" fill="#ddc18c"/>
    <circle cx="28" cy="0" r="2" fill="#ddc18c"/>
  </g>}

  </g>;
}

export function GroundColonyFixtures({explored,visible}:Vision){
 return <g data-testid="ground-colony-fixtures" pointerEvents="none">
  <defs>
   <radialGradient id="ground-colony-lamp-glow">
    <stop stopColor="#f6d59d" stopOpacity=".55"/>
    <stop offset="1" stopColor="#e4b174" stopOpacity="0"/>
   </radialGradient>
  </defs>
  {cargo.filter(p=>explored.has(key(p.x,p.y))).map(p=>{
   const at=project(p.x,p.y);
   return <g key={key(p.x,p.y)} data-testid={'ground-cargo-'+key(p.x,p.y)}
     data-fog={visible.has(key(p.x,p.y))?'visible':'remembered'}
     transform={`translate(${at.x} ${at.y})`} opacity={fade(visible,key(p.x,p.y))}>
    <ellipse cy="8" rx="28" ry="11" fill="#091b1e" opacity=".67"/>
    <path d="M-24 -3 0 -16 24 -3 0 10Z" fill="#566769"
     stroke="#a5b4a8" strokeWidth="1.5"/>
    <path d="M-24 -3 0 10V-7L-24 -20Z" fill="#283e43"/>
    <path d="M0 10 24 -3V-20L0 -7Z" fill="#1d323d"/>
    <path d="M-24 -20 0 -33 24 -20 0 -7Z" fill="#718280"
      stroke="#a7b6ac" strokeWidth="1.5"/>
    <path d="M-11 -25 3 -17M8 -23 18 -18" stroke="#dcc18d"
      strokeWidth="2.5"/>
    <path d="M5 1 19 -6" stroke="#72b9b2" strokeWidth="3"/>
    <circle cx="19" cy="-11" r="2" fill="#ffc987"/>
   </g>;
  })}
  {rails.filter(p=>explored.has(key(p.x,p.y))).map(p=>{
   const at=project(p.x,p.y);
   return <g key={key(p.x,p.y)}
     transform={`translate(${at.x} ${at.y})`} opacity={fade(visible,key(p.x,p.y))}
     data-testid={'ground-railing-'+key(p.x,p.y)}>
    <path d="M-29 -11 -29 -31M0 -26 0 -46M29 -11 29 -31M-29 -31 0 -46 29 -31"
      fill="none" stroke="#98a9a5" strokeWidth="3"/>
    <path d="M-29 -22 0 -37 29 -22" fill="none" stroke="#405661" strokeWidth="3"/>
    <circle cx="0" cy="-48" r="3" fill="#e1ba77"/>
   </g>;
  })}
  {lights.filter(([x,y])=>explored.has(key(x,y))).map(([x,y])=>{
   const at=project(x,y);
   return <g key={key(x,y)}
     data-testid={'ground-lamp-'+key(x,y)}
     data-fog={visible.has(key(x,y))?'visible':'remembered'}
     transform={`translate(${at.x+24} ${at.y-3})`} opacity={fade(visible,key(x,y))}>
    <ellipse cy="4" rx="13" ry="6" fill="#1a3437"/>
    <path d="M0 2V-16" stroke="#a6aaa2" strokeWidth="3"/>
    <path d="M-5 -15 0 -21 5 -15Z" fill="#e7bb77"/>
    <ellipse cy="-19" rx="24" ry="22" fill="url(#ground-colony-lamp-glow)" />
   </g>;
  })}
 </g>;
}
