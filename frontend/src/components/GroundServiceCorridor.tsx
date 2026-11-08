import world from '../../../content/scenes/meridian.json';

// A connected architectural passage between the rescue room and the east
// perimeter. Its floor follows only walkable cells of the canonical scene.
// No second navmesh, doorway state, collision geometry or discovery logic.
const surface=world.scenes.surface;
type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
type Cell={x:number;y:number};
const key=(x:number,y:number)=>x+','+y;
const xy=(p:Cell)=>key(p.x,p.y);
const at=(p:Cell)=>({x:440+(p.x-p.y)*40,y:52+(p.x+p.y)*20});
const blocked=new Set([...surface.walls,...surface.objects].map(x=>key(x.x,x.y)));
const walls=new Set(surface.walls.map(x=>key(x.x,x.y)));
const passage:Cell[]=[
  {x:7,y:4},{x:8,y:4},{x:9,y:4},{x:9,y:5},
  {x:9,y:6},{x:8,y:6},{x:7,y:6},
];
const connected=passage.every((p,i)=>{
  if(blocked.has(xy(p)))return false;
  if(i===0)return true;
  return Math.abs(p.x-passage[i-1].x)+Math.abs(p.y-passage[i-1].y)===1;
});
const cells=connected?passage:[];
const sides=[
  {name:'north',dx:0,dy:-1,a:[0,-20],b:[40,0],rear:true},
  {name:'east',dx:1,dy:0,a:[40,0],b:[0,20],rear:false},
  {name:'south',dx:0,dy:1,a:[0,20],b:[-40,0],rear:false},
  {name:'west',dx:-1,dy:0,a:[-40,0],b:[0,-20],rear:true},
] as const;
const realWallFaces=cells.flatMap(p=>sides.filter(side=>
  walls.has(key(p.x+side.dx,p.y+side.dy))).map(side=>({
    p,side,wall:key(p.x+side.dx,p.y+side.dy),
  })));
const tilePath=(p:Cell)=>{
  const c=at(p);
  return 'M'+c.x+' '+(c.y-20)+'L'+(c.x+40)+' '+c.y+
    'L'+c.x+' '+(c.y+20)+'L'+(c.x-40)+' '+c.y+'Z';
};
const stroke=(a:readonly number[],b:readonly number[])=>
  'M'+a[0]+' '+a[1]+'L'+b[0]+' '+b[1];

export function GroundServiceCorridor({explored,visible}:Vision){
  return <g data-testid="ground-connected-service-corridor"
    data-topology-valid={connected?'true':'false'}
    aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id="ground-corridor-floor-light" gradientUnits="userSpaceOnUse"
        x1="440" y1="270" x2="670" y2="400">
        <stop stopColor="#80958a"/>
        <stop offset=".45" stopColor="#435c60"/>
        <stop offset="1" stopColor="#284249"/>
      </linearGradient>
      <linearGradient id="ground-corridor-window-light"
        x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#a6d6c7"/>
        <stop offset="1" stopColor="#355a67"/>
      </linearGradient>
    </defs>
    {/* A single material system links all traversable corridor cells. Each
        fragment respects exploration before becoming part of the visible
        room; a hidden tile never discloses topology or mission content. */}
    <g data-testid="ground-service-corridor-floor">
      {cells.filter(p=>explored.has(xy(p))).map(p=>
        <path key={xy(p)} data-testid={'ground-service-floor-'+xy(p)}
          data-fog={visible.has(xy(p))?'visible':'remembered'}
          d={tilePath(p)}
          fill="url(#ground-corridor-floor-light)"
          opacity={visible.has(xy(p))?1:.32}/>)}
    </g>
    {/* An unbroken floor-level service conduit follows true connected
        neighbors only; no cross-wall shortcut and no canopy over officers. */}
    <g data-testid="ground-service-corridor-conduit">
      {cells.slice(1).filter((p,i)=>{
        const prev=cells[i];
        return explored.has(xy(p))&&explored.has(xy(prev));
      }).map(p=>{
        const i=cells.findIndex(c=>xy(c)===xy(p));
        const prev=cells[i-1],a=at(prev),b=at(p);
        const lit=visible.has(xy(prev))&&visible.has(xy(p));
        return <g key={xy(prev)+'-'+xy(p)}
          data-testid={'ground-service-conduit-'+xy(prev)+'-to-'+xy(p)}
          data-fog={lit?'visible':'remembered'} opacity={lit?.92:.28}>
          <path d={'M'+a.x+' '+(a.y+8)+'L'+b.x+' '+(b.y+8)}
            fill="none" stroke="#152e37" strokeWidth="24"
            strokeLinecap="round"/>
          <path d={'M'+a.x+' '+(a.y+8)+'L'+b.x+' '+(b.y+8)}
            fill="none" stroke="#587a77" strokeWidth="16"
            strokeLinecap="round"/>
          <path d={'M'+a.x+' '+(a.y+8)+'L'+b.x+' '+(b.y+8)}
            fill="none" stroke="#b0bda0" strokeWidth="2"
            strokeDasharray="9 12"/>
        </g>;
      })}
    </g>
    {/* The raised glazing belongs to actual impassable wall neighbors.
        Only rear-facing facades are tall: the front edge is low to avoid
        hiding a passing officer. The already authored gate at 8:4 or 8:6
        stays hollow, walkable and unobstructed. */}
    <g data-testid="ground-service-real-wall-faces">
      {realWallFaces.filter(({p,wall})=>
        explored.has(xy(p))&&explored.has(wall)).map(({p,side,wall})=>{
        const k=xy(p),position=at(p);
        const lit=visible.has(k)&&visible.has(wall);
        const a=side.a,b=side.b,edge=stroke(a,b);
        const sill='M'+a[0]+' '+(a[1]-5)+'L'+b[0]+' '+(b[1]-5);
        const front='M'+a[0]+' '+(a[1]-48)+
          'L'+b[0]+' '+(b[1]-48)+'L'+b[0]+' '+(b[1]-6)+
          'L'+a[0]+' '+(a[1]-6)+'Z';
        return <g key={k+'-'+side.name}
          data-testid={'ground-service-wall-'+k+'-'+side.name}
          data-wall-cell={wall}
          data-fog={lit?'visible':'remembered'}
          opacity={lit?1:.3}
          transform={'translate('+position.x+' '+position.y+')'}>
          {side.rear&&<>
            <path d={front} fill="#293f48" stroke="#a9b39e"
              strokeWidth="2"/>
            <path d={'M'+a[0]+' '+(a[1]-40)+
              'L'+b[0]+' '+(b[1]-40)+'L'+b[0]+' '+(b[1]-13)+
              'L'+a[0]+' '+(a[1]-13)+'Z'}
              fill="#183842" stroke="#718e89" strokeWidth="1.7"/>
            <path d={'M'+a[0]+' '+(a[1]-37)+
              'L'+b[0]+' '+(b[1]-37)+'L'+b[0]+' '+(b[1]-19)+
              'L'+a[0]+' '+(a[1]-19)+'Z'}
              fill="url(#ground-corridor-window-light)" opacity=".9"/>
            <path d={'M'+(a[0]+b[0])/2+' '+((a[1]+b[1])/2-41)+
              'L'+(a[0]+b[0])/2+' '+((a[1]+b[1])/2-13)}
              stroke="#b5bcad" strokeWidth="3" fill="none"/>
            <path d={'M'+a[0]+' '+(a[1]-50)+'L'+b[0]+' '+(b[1]-50)}
              fill="none" stroke="#d3c195" strokeWidth="3"/>
          </>}
          <path d={edge} stroke="#102b34" strokeWidth="7" fill="none"/>
          <path d={sill} stroke="#98bdb0" strokeWidth="2" fill="none"/>
        </g>;
      })}
    </g>
  </g>;
}
