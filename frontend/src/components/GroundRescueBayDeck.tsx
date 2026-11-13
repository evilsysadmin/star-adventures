import world from '../../../content/scenes/meridian.json';
import {GroundIndustrialApron} from './GroundIndustrialApron';

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
  // Exact-route DEV-only A/B switch. Production always uses the complete
  // original industrial apron. Never changes the mission or visibility data.
  const legacyApron=import.meta.env.DEV&&typeof window!=='undefined'&&
    Boolean((window as typeof window&{__k47LegacyIndustrialApron?:boolean})
      .__k47LegacyIndustrialApron);
  // A/B preview is strictly local development; production always renders
  // the authored platform. It never affects game state or tile picking.
  const legacyPreview=import.meta.env.DEV && typeof window!=='undefined' &&
    Boolean((window as typeof window&{__k47LegacyLandingPlatform?:boolean})
      .__k47LegacyLandingPlatform);
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
      {/* One four-cell continuous, original industrial paint system. There
          is no individual tile border or externally sourced image. */}
      <linearGradient id="k47-transfer-steel" x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#7d867a"/>
        <stop offset=".38" stopColor="#485e5c"/>
        <stop offset="1" stopColor="#223e48"/>
      </linearGradient>
      <linearGradient id="k47-transfer-recess" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#071e28"/>
        <stop offset=".52" stopColor="#1b404a"/>
        <stop offset="1" stopColor="#365d5a"/>
      </linearGradient>
      <radialGradient id="k47-transfer-central-glow">
        <stop stopColor="#96d7c9" stopOpacity=".27"/>
        <stop offset="1" stopColor="#96d7c9" stopOpacity="0"/>
      </radialGradient>
      <pattern id="k47-transfer-surface-oxide" x="0" y="0"
        width="67" height="53" patternUnits="userSpaceOnUse">
        <path d="M1 5l16 -3 22 6 8 -2M4 42l18 3 10 -4M31 29l20 3"
          stroke="#182e34" strokeWidth="2.1" fill="none" opacity=".25"/>
        <path d="M3 35l8 -2M47 17l13 2M35 49l10 -1"
          stroke="#e1bc8f" strokeWidth="1.4" fill="none" opacity=".15"/>
      </pattern>
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
    {/* Multi-cell industrial fabrication lives ON the known, actually free
        floor, beneath original machinery, routes, stations and officers. */}
    {!legacyApron&&<GroundIndustrialApron cells={room}
      explored={explored} visible={visible}/>}
    {/* A single large room-scale hatch, visibly spanning four canonical
        walkable cells rather than repeating one marker on each floor tile.
        Its center lies below the officers, and it never accepts input. */}
    {hatchKnown&&<g data-testid="ground-bay-central-hatch"
      data-visual-version={legacyPreview?'legacy':'connected-industrial-transfer-platform'}
      data-fog={hatchVisible?'visible':'remembered'}
      transform={'translate('+center.x+' '+center.y+')'}
      opacity={hatchVisible?1:.32}>
      {legacyPreview ? <>
        {/* Baseline for exact-route DEV-only screenshot comparison. */}
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
      </> : <>
        {/* Four genuine traversable cells, ONE connected industrial piece:
            heavy cast-metal plating and a shallow bevel rather than
            four repeated squares or a floating raised collision surface. */}
        <path d="M-77 0L0 39 77 0 77 6 0 45 -77 6Z"
          fill="#142a32" stroke="#9c957a" strokeWidth="1.9"/>
        <path d="M0 -39L77 0 0 39 -77 0Z"
          fill="url(#k47-transfer-steel)" stroke="#ccb48b" strokeWidth="3.6"/>
        <path d="M0 -39L77 0 0 39 -77 0Z"
          fill="url(#k47-transfer-surface-oxide)"/>
        <path d="M0 -34L68 0 0 34 -68 0Z"
          fill="#1d3942" stroke="#75938b" strokeWidth="1.5"/>
        {/* Continuous larger-than-one-tile service panels and
            beveled diagonal ribs follow shared room coordinates. */}
        <path d="M0 -31L27 -18 0 -5 -27 -18Z"
          fill="#3e625f" stroke="#8ca69b" strokeWidth="1.6"/>
        <path d="M-52 -1L-25 -15 -1 -3 -27 11Z"
          fill="#4e6964" stroke="#213c45" strokeWidth="1.7"/>
        <path d="M26 -15L51 -1 25 13 1 -1Z"
          fill="#3f5658" stroke="#a1a898" strokeWidth="1.7"/>
        <path d="M-28 13L0 -1 27 13 0 27Z"
          fill="#50635c" stroke="#17323d" strokeWidth="1.8"/>
        <path d="M-50 0L0 25 50 0M-50 0L0 -25 50 0"
          fill="none" stroke="#102a34" strokeWidth="6.3" opacity=".86"/>
        <path d="M-51 -2L0 -28 51 -2M-51 2L0 28 51 2"
          fill="none" stroke="#b1b9a3" strokeWidth="1.5" opacity=".7"/>
        {/* One inset transporter/service machinery hub, not a decorative
            floating ring that implies the entire surface is a button. */}
        <g data-testid="ground-bay-machinery-hub">
          <ellipse cx="0" cy="0" rx="42" ry="22"
            fill="url(#k47-transfer-central-glow)"/>
          <ellipse cx="0" cy="0" rx="27" ry="12" fill="#081d26"
            stroke="#b7b097" strokeWidth="3.2"/>
          <ellipse cx="0" cy="0" rx="20" ry="8.3"
            fill="url(#k47-transfer-recess)" stroke="#88c9b7" strokeWidth="1.3"/>
          <path d="M-13 0L0 -5 13 0 0 5Z"
            fill="#122e39" stroke="#609f9d" strokeWidth="1.7"/>
          <path d="M-16 0H16M0 -7V7" stroke="#d3ddd0"
            strokeWidth="1.4" opacity=".75"/>
          <circle cx="0" cy="0" r="2.8" fill="#91d9c5"/>
        </g>
        {/* Wide painted safety borders and asymmetrical grime/scuff marks
            occupy the WHOLE industrial insert, not per-cell microtiles. */}
        <g data-testid="ground-bay-deck-safety-markings"
          fill="none" strokeLinecap="square">
          <path d="M-72 -1L-52 -11M52 -11L72 -1M-72 1L-52 11M52 11L72 1"
            stroke="#182e36" strokeWidth="8"/>
          <path d="M-70 -1L-54 -9M54 -9L70 -1M-70 1L-54 9M54 9L70 1"
            stroke="#dfbb7a" strokeWidth="3.3" strokeDasharray="6 5"/>
          <path d="M-21 -24L-8 -31M8 -31L21 -24M-21 24L-8 31M8 31L21 24"
            stroke="#a6c5b7" strokeWidth="1.6" opacity=".8"/>
          <path d="M-57 0L-42 -7M41 8L57 0M-16 30L-3 34"
            stroke="#273d42" strokeWidth="3.2" opacity=".8"/>
          <path d="M-60 -3L-46 -10M39 -9L56 -1M-10 -30L4 -36"
            stroke="#d2c29c" strokeWidth="1.2" opacity=".5"/>
        </g>
        {/* Fasteners are coupled to a multi-cell assembly; one pattern of
            large panels, not hundreds of checkerboard texture pixels. */}
        {[[-62,0],[62,0],[0,-32],[0,32],[-36,0],[36,0]].map(([x,y],i)=>
          <g key={i} transform={'translate('+x+' '+y+')'}>
            <circle r="3.1" fill="#1d3136" stroke="#bfbd9f" strokeWidth="1.1"/>
            <path d="M-1.4 -1L1.4 1" stroke="#c3ac83" strokeWidth="1.1"/>
          </g>)}
        <path d="M-75 5L0 43 75 5" stroke="#b89e73"
          strokeWidth="2" fill="none" opacity=".75"/>
      </>}
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
