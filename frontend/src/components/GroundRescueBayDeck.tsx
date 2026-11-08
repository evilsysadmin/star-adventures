import world from '../../../content/scenes/meridian.json';

// First connected interior footprint. The visual bay only covers real
// walkable cells from the authored scene: it cannot invent walls, stations,
// doors, playable tiles or a second collision/interaction model.
const scene=world.scenes.surface;
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Cell={x:number;y:number};
const id=(x:number,y:number)=>x+','+y;
const at=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const blocked=new Set([...scene.walls,...scene.objects].map(p=>id(p.x,p.y)));
const structural=new Set(scene.walls.map(p=>id(p.x,p.y)));

// The original rescue area links the transport pad, clinic and service
// corridor. This is an art footprint, NOT a new scene definition.
const room=Array.from({length:4},(_,i)=>i+3).flatMap(y=>
  Array.from({length:6},(_,i)=>i+2).map(x=>({x,y})))
  .filter(p=>!blocked.has(id(p.x,p.y)));
const roomIds=new Set(room.map(p=>id(p.x,p.y)));
const edges=[
  {name:'north',dx:0,dy:-1,from:[0,-20],to:[40,0]},
  {name:'east',dx:1,dy:0,from:[40,0],to:[0,20]},
  {name:'south',dx:0,dy:1,from:[0,20],to:[-40,0]},
  {name:'west',dx:-1,dy:0,from:[-40,0],to:[0,-20]},
] as const;
const wallFaces=room.flatMap(p=>edges.filter(edge=>
    structural.has(id(p.x+edge.dx,p.y+edge.dy)))
  .map(edge=>({p,edge,neighbor:id(p.x+edge.dx,p.y+edge.dy)})));
// An exposed 2x2 engineering hatch, deliberately clear of the three
// initial officers so the room reads as an installation rather than blank floor.
const centerCells=['2,4','3,4','2,5','3,5'];

// Single contiguous visual material: no grid-line stroke on interior cells.
// Individual paths exist only to enforce known/remembered fog boundaries.
const polygon=(p:Cell)=>{
  const c=at(p.x,p.y);
  return 'M'+c.x+' '+(c.y-20)+'L'+(c.x+40)+' '+c.y+
    'L'+c.x+' '+(c.y+20)+'L'+(c.x-40)+' '+c.y+'Z';
};

export function GroundRescueBayDeck({explored,visible}:Vision){
  const hatchKnown=centerCells.every(k=>explored.has(k)&&roomIds.has(k));
  const hatchVisible=centerCells.every(k=>visible.has(k));
  const center=at(2.5,4.5);
  return <g data-testid="ground-rescue-bay" pointerEvents="none"
    aria-hidden="true">
    <defs>
      {/* One surface-wide gradient, not 24 separate tile gradients. */}
      <linearGradient id="ground-bay-deck-gradient" gradientUnits="userSpaceOnUse"
        x1="245" y1="160" x2="690" y2="450">
        <stop stopColor="#687e77"/>
        <stop offset=".48" stopColor="#465f61"/>
        <stop offset="1" stopColor="#29454e"/>
      </linearGradient>
    </defs>
    <g data-testid="ground-bay-continuous-floor">
      {room.filter(p=>explored.has(id(p.x,p.y))).map(p=>{
        const k=id(p.x,p.y),current=visible.has(k);
        return <path key={k} data-testid={'ground-bay-floor-'+k}
          data-fog={current?'visible':'remembered'}
          d={polygon(p)} fill="url(#ground-bay-deck-gradient)"
          opacity={current?1:.33}/>;
      })}
    </g>
    {/* A single large room-scale hatch, visibly spanning four canonical
        walkable cells rather than repeating one marker on each floor tile.
        Its center lies below the officers, and it never accepts input. */}
    {hatchKnown&&<g data-testid="ground-bay-central-hatch"
      data-fog={hatchVisible?'visible':'remembered'}
      transform={'translate('+center.x+' '+center.y+')'}
      opacity={hatchVisible?1:.32}>
      <path d="M0 -36L76 0 0 36 -76 0Z"
        fill="#17343b" stroke="#c7b591" strokeWidth="3.2"/>
      <path d="M0 -28L58 0 0 28 -58 0Z"
        fill="#244a50" stroke="#90c9b6" strokeWidth="2"/>
      <path d="M0 -17L35 0 0 17 -35 0Z"
        fill="#112e39" stroke="#639f9d" strokeWidth="2"/>
      <path d="M-50 0L-30 -10M30 10L50 0M-13 30L0 36 13 30"
        stroke="#e8be84" strokeWidth="3.8" fill="none"/>
      <path d="M-57 -4L-47 -9M47 9L57 4M-6 -17L0 -20 6 -17"
        stroke="#adccc3" strokeWidth="2" fill="none"/>
      <path d="M-14 0H14M0 -8V8" stroke="#a8dbcd"
        strokeWidth="2" opacity=".8"/>
      <circle cx="0" cy="0" r="3" fill="#d2edd4"/>
    </g>}
    {/* Low skirting and a short rear glass bulkhead follow ONLY existing
        wall neighbors. Unknown neighbors stay hidden, keeping fog truthful.
        No wall or collision is added to a walkable cell. */}
    <g data-testid="ground-bay-actual-wall-faces">
      {wallFaces.filter(({p,neighbor})=>
        explored.has(id(p.x,p.y))&&explored.has(neighbor)).map(({p,edge,neighbor})=>{
        const pos=at(p.x,p.y),k=id(p.x,p.y);
        const live=visible.has(k)&&visible.has(neighbor);
        const a=edge.from,b=edge.to;
        const line='M'+a[0]+' '+a[1]+'L'+b[0]+' '+b[1];
        const rear=edge.name==='north'||edge.name==='west';
        return <g key={k+'-'+edge.name}
          data-testid={'ground-bay-wall-face-'+k+'-'+edge.name}
          data-fog={live?'visible':'remembered'}
          opacity={live?1:.32}
          transform={'translate('+pos.x+' '+pos.y+')'}>
          {rear&&<>
            <path d={'M'+a[0]+' '+(a[1]-19)+'L'+b[0]+' '+(b[1]-19)+
              'L'+b[0]+' '+b[1]+'L'+a[0]+' '+a[1]+'Z'}
              fill="#29444c" stroke="#172d35" strokeWidth="1.2"/>
            <path d={'M'+a[0]+' '+(a[1]-14)+'L'+b[0]+' '+(b[1]-14)}
              fill="none" stroke="#8fcec0" strokeWidth="2.2" opacity=".9"/>
          </>}
          <path d={line} fill="none" stroke="#112e39"
            strokeWidth="6" strokeLinecap="square"/>
          <path d={line} fill="none" stroke="#d4bc8d"
            strokeWidth="1.8" opacity=".87"/>
        </g>;
      })}
    </g>
  </g>;
}
