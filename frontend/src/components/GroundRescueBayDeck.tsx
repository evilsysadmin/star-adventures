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
  // A/B testing only: shipping builds cannot disable the new surface.
  const industrial=!import.meta.env.DEV||typeof window==='undefined'||
    (window as typeof window&{__k47LegacyIndustrialFloor?:boolean})
      .__k47LegacyIndustrialFloor!==true;
  const hatchKnown=centerCells.every(k=>explored.has(k)&&roomIds.has(k));
  const hatchVisible=centerCells.every(k=>visible.has(k));
  const center=at(2.5,4.5);
  return <g data-testid="ground-rescue-bay" data-bay-floor-visual={industrial?"industrial-v2":"legacy"} pointerEvents="none"
    aria-hidden="true">
    <defs>
      {/* One surface-wide gradient, not 24 separate tile gradients. */}
      <linearGradient id="ground-bay-deck-gradient" gradientUnits="userSpaceOnUse"
        x1="245" y1="160" x2="690" y2="450">
        <stop stopColor="#687e77"/>
        <stop offset=".48" stopColor="#465f61"/>
        <stop offset="1" stopColor="#29454e"/>
      </linearGradient>
      <linearGradient id="ground-bay-connected-steel" gradientUnits="userSpaceOnUse"
        x1="245" y1="155" x2="675" y2="425">
        <stop stopColor="#92816d"/>
        <stop offset=".32" stopColor="#67665b"/>
        <stop offset=".7" stopColor="#4d5b57"/>
        <stop offset="1" stopColor="#30474a"/>
      </linearGradient>
      {/* Four-square industrial modules; the pattern shares one world-space
          origin instead of restarting at every logical game cell. */}
      <pattern id="ground-bay-industrial-plates" patternUnits="userSpaceOnUse"
        width="240" height="120">
        <path d="M0 0H240V120H0Z" fill="#243f42" fillOpacity=".10"/>
        <path d="M0 0L240 0 186 120 0 120Z" fill="#b1a187" fillOpacity=".15"/>
        <path d="M-5 36L54 21 126 29 183 16 252 41
                 M-4 86L54 76 105 89 160 72 250 83"
          fill="none" stroke="#142f35" strokeWidth="9" strokeOpacity=".24"/>
        <path d="M-5 39L54 24 126 32 183 19 252 44
                 M-4 90L54 80 105 93 160 76 250 87"
          fill="none" stroke="#c8aa80" strokeWidth="2.4" strokeOpacity=".53"/>
        <path d="M33 0L15 120M209 0L225 120"
          stroke="#22363a" strokeWidth="5" strokeOpacity=".49"/>
        <path d="M36 0L18 120M212 0L228 120"
          stroke="#c4b59a" strokeWidth="1.4" strokeOpacity=".58"/>
        <path d="M67 56l37 -4m-24 38l32 -8m45-27l23 2m-164 58l25 -4"
          stroke="#d6c6a4" strokeWidth="3" strokeOpacity=".5"/>
        <g fill="#20383b" fillOpacity=".72">
          <circle cx="14" cy="12" r="3.5"/><circle cx="222" cy="13" r="3.5"/>
          <circle cx="64" cy="104" r="3.2"/><circle cx="179" cy="101" r="3.4"/>
        </g>
        <g fill="#d0b58a" fillOpacity=".8">
          <circle cx="13" cy="11" r="1.5"/><circle cx="221" cy="12" r="1.5"/>
          <circle cx="63" cy="103" r="1.4"/><circle cx="178" cy="100" r="1.4"/>
        </g>
      </pattern>
      {/* Real LOS is authoritative; unknown cells never enter these clips. */}
      <clipPath id="ground-bay-visible-panels">
        {room.filter(p=>visible.has(id(p.x,p.y))).map(p=>
          <path key={id(p.x,p.y)} d={polygon(p)}/>)}
      </clipPath>
      <clipPath id="ground-bay-remembered-panels">
        {room.filter(p=>explored.has(id(p.x,p.y))&&!visible.has(id(p.x,p.y))).map(p=>
          <path key={id(p.x,p.y)} d={polygon(p)}/>)}
      </clipPath>
    </defs>
    <g data-testid="ground-bay-continuous-floor">
      {room.filter(p=>explored.has(id(p.x,p.y))).map(p=>{
        const k=id(p.x,p.y),current=visible.has(k);
        return <path key={k} data-testid={'ground-bay-floor-'+k}
          data-fog={current?'visible':'remembered'}
          d={polygon(p)} fill={industrial
            ? "url(#ground-bay-connected-steel)" : "url(#ground-bay-deck-gradient)"}
          opacity={current?1:.33}/>;
      })}
    </g>
    {/* The patterned industrial floor is a *real, prominent* replacement
        rather than tiny low-alpha wear hidden behind the old deck. The
        same drawing is clipped twice to true visible/remembered game cells. */}
    {industrial&&<g data-testid="ground-bay-industrial-skin" pointerEvents="none">
      <path d="M160 105H745V490H160Z" fill="url(#ground-bay-industrial-plates)"
        clipPath="url(#ground-bay-visible-panels)" opacity=".93"/>
      <path d="M160 105H745V490H160Z" fill="url(#ground-bay-industrial-plates)"
        clipPath="url(#ground-bay-remembered-panels)" opacity=".28"/>
      {/* Coarse plate welds every three WORLD tiles, never 1x1 squares.
          Neither lines nor rivets become movement/interaction objects. */}
      {room.filter(p=>(p.x===2||p.x===5)&&
        roomIds.has(id(p.x+1,p.y))&&explored.has(id(p.x,p.y))&&
        explored.has(id(p.x+1,p.y))).map(p=>{
          const c=at(p.x,p.y),known=visible.has(id(p.x,p.y))&&
            visible.has(id(p.x+1,p.y));
          return <g key={'joint-'+id(p.x,p.y)}
            data-testid={'ground-bay-plate-weld-'+id(p.x,p.y)}
            opacity={known?.9:.28}>
            <path d={'M'+(c.x+40)+' '+c.y+'L'+c.x+' '+(c.y+20)}
              stroke="#1d3237" strokeWidth="5.5" fill="none"/>
            <path d={'M'+(c.x+38)+' '+(c.y+1)+'L'+(c.x-2)+' '+(c.y+21)}
              stroke="#c9b492" strokeWidth="1.7" fill="none"/>
          </g>;
      })}
    </g>}
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
