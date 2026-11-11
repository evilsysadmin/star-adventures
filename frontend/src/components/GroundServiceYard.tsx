import world from '../../../content/scenes/meridian.json';

// Original exterior workyard connected to the two existing perimeter gates.
// Nothing here changes pathfinding, blocks a tile or implies an extra action.
const scene=world.scenes.surface;
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Cell={x:number;y:number};
const id=(x:number,y:number)=>x+','+y;
const xy=(p:Cell)=>id(p.x,p.y);
const at=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const blocked=new Set([...scene.walls,...scene.objects].map(p=>id(p.x,p.y)));
const walls=new Set(scene.walls.map(p=>id(p.x,p.y)));

// Two canonical gateways must remain open. If the authored topology changes,
// retire this art instead of pretending the workyard is reachable.
const gatewaysOpen=['8,4','8,6','9,4','9,6'].every(k=>!blocked.has(k));
const yard:Cell[]=gatewaysOpen
  ? Array.from({length:6},(_,y)=>y+3).flatMap(y=>
      Array.from({length:3},(_,x)=>({x:x+9,y})))
      .filter(p=>!blocked.has(xy(p)))
  : [];
const yardKeys=new Set(yard.map(xy));
const base=(p:Cell)=>{
  const c=at(p.x,p.y);
  return 'M'+c.x+' '+(c.y-20)+'L'+(c.x+40)+' '+c.y+
    'L'+c.x+' '+(c.y+20)+'L'+(c.x-40)+' '+c.y+'Z';
};
const boundary=[
  {name:'north',dx:0,dy:-1,a:[0,-20],b:[40,0]},
  {name:'east',dx:1,dy:0,a:[40,0],b:[0,20]},
  {name:'south',dx:0,dy:1,a:[0,20],b:[-40,0]},
  {name:'west',dx:-1,dy:0,a:[-40,0],b:[0,-20]},
] as const;
const wallEdges=yard.flatMap(p=>boundary.filter(edge=>
  walls.has(id(p.x+edge.dx,p.y+edge.dy))).map(edge=>({
    p,edge,wall:id(p.x+edge.dx,p.y+edge.dy),
  })));

// Floor markings, not navigational orders: each pair is physically adjacent,
// traversable in the scene, and connects into the existing real gateways.
const paintRoutes:Cell[][]=[
  [{x:9,y:4},{x:10,y:4},{x:10,y:5},{x:11,y:5}],
  [{x:9,y:6},{x:9,y:7},{x:10,y:7},{x:11,y:7}],
].filter(path=>path.every((p,i)=>yardKeys.has(xy(p))&&
  (i===0||Math.abs(p.x-path[i-1].x)+Math.abs(p.y-path[i-1].y)===1)));
const loadingCells=['10,4','11,4','10,5','11,5'];
const loadingValid=loadingCells.every(k=>yardKeys.has(k));

export function GroundServiceYard({explored,visible}:Vision){
  const loadingKnown=loadingValid&&loadingCells.every(k=>explored.has(k));
  const loadingLit=loadingCells.every(k=>visible.has(k));
  const center=at(10.5,4.5);
  return <g data-testid="ground-service-yard"
    data-topology-valid={gatewaysOpen?'true':'false'}
    aria-hidden="true" pointerEvents="none">
    <defs>
      {/* One room-scale material, not separate textures on each grid tile. */}
      <linearGradient id="ground-yard-paving" gradientUnits="userSpaceOnUse"
        x1="480" y1="285" x2="850" y2="520">
        <stop stopColor="#76867b"/>
        <stop offset=".45" stopColor="#526b68"/>
        <stop offset="1" stopColor="#344e53"/>
      </linearGradient>
    </defs>
    <g data-testid="ground-yard-connected-floor">
      {yard.filter(p=>explored.has(xy(p))).map(p=>{
        const k=xy(p),lit=visible.has(k);
        return <path key={k} data-testid={'ground-yard-floor-'+k}
          data-modular-paving="true"
          data-fog={lit?'visible':'remembered'} d={base(p)}
          fill="url(#ground-yard-paving)" opacity={lit?1:.32}/>;
      })}
    </g>
    {/* Worn twin-lane service stripes run across only real accessible
        neighbors, and the unexplored continuation remains undisclosed. */}
    <g data-testid="ground-yard-service-lanes">
      {paintRoutes.flatMap((path,route)=>path.slice(1).map((p,i)=>{
        const prev=path[i],from=at(prev.x,prev.y),to=at(p.x,p.y);
        if(!explored.has(xy(prev))||!explored.has(xy(p)))return null;
        const lit=visible.has(xy(prev))&&visible.has(xy(p));
        const d='M'+from.x+' '+(from.y+5)+'L'+to.x+' '+(to.y+5);
        return <g key={route+'-'+i}
          data-testid={'ground-yard-lane-'+xy(prev)+'-to-'+xy(p)}
          data-fog={lit?'visible':'remembered'}
          opacity={lit?.9:.28}>
          <path d={d} stroke="#233d43" strokeWidth="25"
            strokeLinecap="butt" fill="none"/>
          <path d={d} stroke="#b8bda1" strokeWidth="2"
            strokeDasharray="9 8" fill="none"/>
          <path d={d} stroke="#233d43" strokeWidth="1.5"
            strokeDasharray="3 14" fill="none"/>
        </g>;
      }))}
    </g>
    {/* A broad, two-by-two loading turntable is explicitly a ground decal,
        not a fabricated mission terminal, obstacle or extra walkable tile. */}
    {loadingKnown&&<g data-testid="ground-yard-loading-turntable"
      data-fog={loadingLit?'visible':'remembered'}
      transform={'translate('+center.x+' '+center.y+')'}
      opacity={loadingLit?1:.3}>
      <path d="M0 -34L72 0 0 34 -72 0Z"
        fill="#233f46" stroke="#cab58d" strokeWidth="3.5"/>
      <path d="M0 -27L57 0 0 27 -57 0Z"
        fill="#4b6967" stroke="#9ab9ad" strokeWidth="2"/>
      <path d="M-44 -1L0 -22 44 -1 0 21Z"
        stroke="#1a3740" strokeWidth="5" fill="none"/>
      <path d="M-58 4L-37 14M37 -14L58 -4M-19 -24L0 -31 19 -24"
        stroke="#ecc582" strokeWidth="4" fill="none"/>
      <path d="M-17 0H17M0 -9V9"
        stroke="#9acdc3" strokeWidth="2" fill="none"/>
    </g>}
    {/* A curb only where canonical walls already stop movement. It cannot
        falsely enclose an unblocked gate and cannot reveal hidden geometry. */}
    <g data-testid="ground-yard-actual-wall-curbs">
      {wallEdges.filter(({p,wall})=>
        explored.has(xy(p))&&explored.has(wall)).map(({p,edge,wall})=>{
        const c=at(p.x,p.y),lit=visible.has(xy(p))&&visible.has(wall);
        const d='M'+edge.a[0]+' '+edge.a[1]+'L'+edge.b[0]+' '+edge.b[1];
        return <g key={xy(p)+'-'+edge.name}
          data-testid={'ground-yard-curb-'+xy(p)+'-'+edge.name}
          data-wall-cell={wall} data-fog={lit?'visible':'remembered'}
          transform={'translate('+c.x+' '+c.y+')'}
          opacity={lit?1:.32}>
          <path d={d} stroke="#203943" strokeWidth="9" fill="none"/>
          <path d={d} stroke="#c7b593" strokeWidth="2.2" fill="none"/>
        </g>;
      })}
    </g>
  </g>;
}
