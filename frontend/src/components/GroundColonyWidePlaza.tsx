import world from '../../../content/scenes/meridian.json';

// One continuous service-campus apron across the expanded eastern sector.
// All drawing is beneath mission entities, officers and fog; no SVG object
// changes authored collision or claims that a false stair is traversable.
const surface=world.scenes.surface;
const point=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const key=(x:number,y:number)=>x+','+y;
const obstacle=new Set([...surface.walls,...surface.objects].map(p=>key(p.x,p.y)));
const campus=(x:number,y:number)=>
  ((x>=9&&x<=16&&y>=3&&y<=10)||
   (x>=7&&x<=9&&y>=4&&y<=8));
const apron=Array.from({length:surface.height},(_,y)=>
  Array.from({length:surface.width},(_,x)=>({x,y}))).flat()
  .filter(p=>campus(p.x,p.y)&&!obstacle.has(key(p.x,p.y)));
const apronKeys=new Set(apron.map(p=>key(p.x,p.y)));
const tile=(x:number,y:number)=>{
  const c=point(x,y);
  return 'M'+c.x+' '+(c.y-20)+'L'+(c.x+40)+' '+c.y+
     'L'+c.x+' '+(c.y+20)+'L'+(c.x-40)+' '+c.y+'Z';
};
const route=[
  [{x:9,y:4},{x:10,y:4},{x:11,y:4},{x:12,y:4},{x:13,y:4},{x:14,y:4},{x:15,y:4},{x:16,y:4}],
  [{x:9,y:5},{x:10,y:5},{x:11,y:5},{x:11,y:6},{x:12,y:6},{x:13,y:6},{x:14,y:6},{x:15,y:6},{x:16,y:6}],
].filter(path=>path.every(p=>apronKeys.has(key(p.x,p.y))));

type Vision={explored:ReadonlySet<string>;visible:ReadonlySet<string>};
const apronEdges=[
  {dx:0,dy:-1,a:[0,-20],b:[40,0]},
  {dx:1,dy:0,a:[40,0],b:[0,20]},
  {dx:0,dy:1,a:[0,20],b:[-40,0]},
  {dx:-1,dy:0,a:[-40,0],b:[0,-20]},
] as const;

export function GroundColonyWidePlaza({explored,visible}:Vision){
  return <g data-testid="ground-colony-wide-plaza" pointerEvents="none" aria-hidden="true">
    <defs>
      <linearGradient id="ground-wide-plaza-metal" gradientUnits="userSpaceOnUse"
        x1="310" y1="225" x2="1130" y2="585">
        <stop stopColor="#777d70"/>
        <stop offset=".35" stopColor="#556f6a"/>
        <stop offset=".7" stopColor="#3d575a"/>
        <stop offset="1" stopColor="#34464e"/>
      </linearGradient>
      <radialGradient id="ground-wide-plaza-lamplight">
        <stop stopColor="#eac18a" stopOpacity=".29"/>
        <stop offset="1" stopColor="#eac18a" stopOpacity="0"/>
      </radialGradient>
      <pattern id="ground-wide-plaza-wear" width="37" height="31"
        patternUnits="userSpaceOnUse">
        <path d="M5 12l6 -2 12 4M27 24l5 2" fill="none"
          stroke="#172e35" strokeWidth="1.6" opacity=".23"/>
        <path d="M3 27l9 -3M25 5l6 -2" fill="none"
          stroke="#b6b7a0" strokeWidth="1" opacity=".17"/>
      </pattern>
    </defs>
    {/* Connected underfoot floor: every visible fragment is an authored free
        tile; adjacent fragments share the same world-space material, not
        separately lit floating diamonds. */}
    <g data-testid="ground-plaza-traversable-floor">
      {apron.filter(p=>explored.has(key(p.x,p.y))).map(p=>{
        const id=key(p.x,p.y),lit=visible.has(id);
        const d=tile(p.x,p.y);
        return <g key={id} data-testid={'ground-plaza-floor-'+id}
          data-fog={lit?'visible':'remembered'} opacity={lit?1:.32}>
          <path d={d} fill="url(#ground-wide-plaza-metal)"/>
          <path d={d} fill="url(#ground-wide-plaza-wear)"/>
          {((p.x+p.y)%5===0)&&<path d={d} stroke="#c2bc9a"
            strokeWidth=".75" opacity=".19" fill="none"/>}
          {((p.x*7+p.y)%8===0)&&<circle
            cx={point(p.x,p.y).x} cy={point(p.x,p.y).y}
            r="2" fill="#cdb892" opacity=".45"/>}
        </g>;
      })}
    </g>
    {/* Heavy perimeter metal ONLY where the adjoining square is physically
        blocked, revealed, and outside the reachable apron. Gateways remain
        visually open as well as passable in the canonical scene. */}
    <g data-testid="ground-plaza-honest-edges">
      {apron.flatMap(p=>apronEdges.filter(edge=>
        obstacle.has(key(p.x+edge.dx,p.y+edge.dy))&&
        !apronKeys.has(key(p.x+edge.dx,p.y+edge.dy))).map(edge=>({p,edge})))
        .filter(({p,edge})=>explored.has(key(p.x,p.y))&&
          explored.has(key(p.x+edge.dx,p.y+edge.dy)))
        .map(({p,edge})=>{
          const id=key(p.x,p.y),wall=key(p.x+edge.dx,p.y+edge.dy);
          const c=point(p.x,p.y),lit=visible.has(id)&&visible.has(wall);
          const d='M'+edge.a[0]+' '+edge.a[1]+'L'+edge.b[0]+' '+edge.b[1];
          return <g key={id+'-'+wall}
            data-testid={'ground-plaza-curb-'+id+'-to-'+wall}
            data-fog={lit?'visible':'remembered'}
            transform={'translate('+c.x+' '+c.y+')'} opacity={lit?1:.3}>
            <path d={d} stroke="#1a3138" strokeWidth="10" fill="none"/>
            <path d={d} stroke="#ccaf7e" strokeWidth="2" fill="none"/>
          </g>;
        })}
    </g>
    {/* Two wide service lanes cross the *real* east gates; never paint a path
        through an occupied grid cell or into unvisited fog. */}
    <g data-testid="ground-plaza-service-routes">
      {route.flatMap((path,i)=>path.slice(1).map((p,j)=>{
        const a=path[j],b=p,id=key(a.x,a.y)+'-to-'+key(b.x,b.y);
        if(!explored.has(key(a.x,a.y))||!explored.has(key(b.x,b.y)))return null;
        const start=point(a.x,a.y),end=point(b.x,b.y);
        const lit=visible.has(key(a.x,a.y))&&visible.has(key(b.x,b.y));
        const line='M'+start.x+' '+(start.y+7)+'L'+end.x+' '+(end.y+7);
        return <g key={i+'-'+j} data-testid={'ground-plaza-route-'+id}
          data-fog={lit?'visible':'remembered'} opacity={lit?.85:.28}>
          <path d={line} stroke="#233940" strokeWidth="19" fill="none"/>
          <path d={line} stroke="#d0b67c" strokeWidth="2.2"
            strokeDasharray="11 10" fill="none"/>
        </g>;
      }))}
    </g>
    {/* Recessed amber *floor* lights, not false obstacles. All three squares
        are traversable and actually visible before drawing their glow. */}
    <g data-testid="ground-plaza-floor-lights">
      {[[13,5],[15,4],[16,8],[11,9]].filter(([x,y])=>
        apronKeys.has(key(x,y))&&explored.has(key(x,y))).map(([x,y])=>{
        const id=key(x,y),lit=visible.has(id),c=point(x,y);
        return <g key={id} data-testid={'ground-plaza-light-'+id}
          data-fog={lit?'visible':'remembered'} opacity={lit?1:.3}>
          <ellipse cx={c.x} cy={c.y} rx="35" ry="19"
            fill="url(#ground-wide-plaza-lamplight)"/>
          <path d={'M'+(c.x-11)+' '+(c.y+1)+'L'+c.x+' '+(c.y+6)+
            'L'+(c.x+11)+' '+(c.y+1)}
            stroke="#d9b77d" strokeWidth="2" fill="none"/>
        </g>;
      })}
    </g>
  </g>;
}
