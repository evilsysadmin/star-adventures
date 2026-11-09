import world from '../../../content/scenes/meridian.json';

// Original isometric colony structures. Only canonical blocked wall / station
// cells own physical buildings. Architecture is not a picking surface.
const scene = world.scenes.surface;
type Vision = {explored:ReadonlySet<string>;visible:ReadonlySet<string>};
const key=(x:number,y:number)=>x+','+y;
const at=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const labels:Record<string,string>={
 probe:'SONDA', 'sensor-vault':'ARCHIVO', 'relief-point':'SOCORRO',
 'perimeter-uplink':'BALIZA', 'beam-out':'EXTRACCIÓN',
};

// Existing adjacent wall tiles form contiguous built structures, not isolated
// crates. The bridges are only between *two* real blocked building cells.
const cargoKeys=new Set(['10,2','10,6','4,8','15,7','16,9']);
const builtCells=scene.walls.filter(p=>p.x>0&&p.y>0&&
  p.x<scene.width-1&&p.y<scene.height-1&&!cargoKeys.has(key(p.x,p.y)));
const builtKeys=new Set(builtCells.map(p=>key(p.x,p.y)));
// The western-facing cargo annex is three adjacent *existing blocked* cells.
// It becomes a single authored building once its complete footprint is known;
// never infer a new traversable roof or disclose an unexplored wall.
const warehouseFootprint=[{x:14,y:2},{x:15,y:2},{x:16,y:2}];
const warehouseKeys=new Set(warehouseFootprint.map(p=>key(p.x,p.y)));
const warehouseValid=warehouseFootprint.every(p=>builtKeys.has(key(p.x,p.y)));
const roofJoins=builtCells.flatMap(p=>([[1,0],[0,1]] as const).flatMap(
 ([dx,dy])=>builtKeys.has(key(p.x+dx,p.y+dy))
  ? [{from:p,to:{x:p.x+dx,y:p.y+dy}}] : []));

// Two authored crossings of the eastern perimeter. Drawing a gateway is
// conditional on the actual collision topology, not on a decorative marker.
// A walkable gap must have built walls on both sides and free approach cells.
const occupied=new Set([...scene.walls,...scene.objects].map(p=>key(p.x,p.y)));
const gateways=[
 {x:8,y:4,kind:'entry'},
 {x:8,y:6,kind:'service'},
].filter(g=>builtKeys.has(key(g.x,g.y-1))&&
 builtKeys.has(key(g.x,g.y+1))&&
 !occupied.has(key(g.x,g.y))&&
 !occupied.has(key(g.x-1,g.y))&&
 !occupied.has(key(g.x+1,g.y)));

// One authored, three-cell industrial service hangar. The footprint consists
// only of canonical blocked walls: x=14..16, y=2. Unlike three independent
// cardboard modules this shares one structural roof, base, facades, lighting
// and continuous glazing. It never offers a false door or changes picking.
function GroundWarehouseBlock({known,visible}:{
 known:boolean;visible:ReadonlySet<string>;
}){
 if(!known)return null;
 const p0=at(14,2),p2=at(16,2);
 const roofCorners=[
  {x:p0.x,y:p0.y-20-60},       // far north
  {x:p2.x+40,y:p2.y-60},       // far east
  {x:p2.x,y:p2.y+20-60},       // front east
  {x:p0.x-40,y:p0.y-60},       // front west
 ];
 const [a,b,c,d]=roofCorners;
 const poly=(points:Array<{x:number;y:number}>)=>
   points.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')+'Z';
 const facade=(start:number,end:number,top:number,bottom:number)=>
   poly([start,end,end,start].map((t,i)=>({
     x:d.x+(c.x-d.x)*t,
     y:d.y+(c.y-d.y)*t+(i<2?top:bottom),
   })));
 const knownId=warehouseFootprint.map(p=>key(p.x,p.y));
 const lit=knownId.every(k=>visible.has(k));
 const wall=poly([d,c,{x:c.x,y:c.y+58},{x:d.x,y:d.y+58}]);
 const returnWall=poly([b,c,{x:c.x,y:c.y+58},{x:b.x,y:b.y+58}]);
 return <g data-testid="ground-colony-industrial-bay"
   data-footprint="14,2 15,2 16,2" data-fog={lit?'visible':'remembered'}
   opacity={lit?1:.65} pointerEvents="none" aria-hidden="true">
   <defs>
    <linearGradient id="ground-warehouse-roof" x1="0" y1="0" x2="0" y2="1">
     <stop stopColor="#87958a"/>
     <stop offset=".48" stopColor="#596e6b"/>
     <stop offset="1" stopColor="#334b53"/>
    </linearGradient>
    <linearGradient id="ground-warehouse-glass" x1="0" y1="0" x2="0" y2="1">
     <stop stopColor="#8ec7c0"/>
     <stop offset=".52" stopColor="#427b83"/>
     <stop offset="1" stopColor="#143b4e"/>
    </linearGradient>
   </defs>
   {/* Contact shadow and plinth remain on the three *blocked* diamonds. */}
   <path d={poly([
     {x:d.x-3,y:d.y+57},{x:c.x+4,y:c.y+57},
     {x:b.x+5,y:b.y+57},{x:a.x-4,y:a.y+57},
   ])} fill="#081d26" opacity=".48"/>
   <path d={returnWall} fill="#213c45" stroke="#162b35" strokeWidth="2"/>
   <path d={wall} fill="#38545a" stroke="#1a3339" strokeWidth="2.5"/>
   {/* Horizontal continuous side paneling instead of per-cell boxed walls. */}
   {[16,39].map(delta=><path key={delta}
    d={'M'+d.x+' '+(d.y+delta)+'L'+c.x+' '+(c.y+delta)}
    stroke="#718981" strokeWidth="2.2" fill="none" opacity=".7"/>)}
   {[.13,.40,.67].map((u,i)=><g key={i}>
     <path d={facade(u,u+.2,12,32)} fill="#172f3b"
       stroke="#9fb9b1" strokeWidth="1.8"/>
     <path d={facade(u+.024,u+.176,15,29)}
       fill="url(#ground-warehouse-glass)"/>
     <path d={facade(u+.092,u+.102,13,31)}
       fill="#1a343e"/>
     <path d={facade(u,u+.2,35,39)} fill="#bba379"/>
   </g>)}
   <path d={poly([a,b,c,d])} fill="url(#ground-warehouse-roof)"
     stroke="#c3b99b" strokeWidth="3"/>
   {/* One continuous roof spine, service markings, and real-looking vents. */}
   <path d={'M'+(a.x-9)+' '+(a.y+14)+'L'+(b.x-9)+' '+(b.y+14)}
     stroke="#243d46" strokeWidth="6" fill="none"/>
   <path d={'M'+(d.x+8)+' '+(d.y-7)+'L'+(c.x+8)+' '+(c.y-7)}
     stroke="#cfb483" strokeWidth="2.8" fill="none"/>
   <path d={'M'+(a.x+3)+' '+(a.y+9)+'L'+(b.x+3)+' '+(b.y+9)}
     stroke="#b5c7b9" strokeWidth="1.3" fill="none" opacity=".75"/>
   {[0,1,2].map(i=>{
     const x=925+i*39,y=311+i*20;
     return <g key={i}>
       <path d={'M'+(x-12)+' '+(y-2)+'L'+x+' '+(y-8)+'L'+(x+15)+' '+(y-1)+'L'+(x+3)+' '+(y+5)+'Z'}
         fill="#233b46" stroke="#8caaa5" strokeWidth="1.5"/>
       <path d={'M'+(x-7)+' '+(y-1)+'L'+(x+7)+' '+(y+6)}
         stroke="#c7b88d" strokeWidth="1.6"/>
     </g>;
   })}
   <path d={'M'+d.x+' '+(d.y+54)+'L'+c.x+' '+(c.y+54)}
     stroke="#c6a36d" strokeWidth="4" fill="none"/>
   <circle cx={d.x+17} cy={d.y+8} r="3.5" fill="#f2bd7c"/>
   <circle cx={c.x-11} cy={c.y+12} r="3.5" fill="#f2bd7c"/>
   <title>Hangar industrial sellado, fuera de la zona transitable</title>
 </g>;
}

export function GroundColonyWalls({explored,visible}:Vision){
 const warehouseKnown=warehouseValid&&warehouseFootprint.every(p=>explored.has(key(p.x,p.y)));
 return <g data-testid="ground-colony-walls" pointerEvents="none">
  {builtCells.filter(p=>explored.has(key(p.x,p.y))&&
    (!warehouseKnown||!warehouseKeys.has(key(p.x,p.y))))
    .map(p=>{
     const xy=key(p.x,p.y),pos=at(p.x,p.y);
     const annex=p.x===8,service=p.x===3&&p.y===2;
     const warm=(p.x*7+p.y)%3===0;
     return <g key={xy} transform={`translate(${pos.x} ${pos.y})`}
       data-testid={'ground-architecture-wall-'+xy}
       data-fog={visible.has(xy)?'visible':'remembered'}
       opacity={visible.has(xy)?1:.3}>
       <ellipse cy="9" rx="37" ry="15" fill="#081b21" opacity=".72"/>
       <path d="M-35 -3 0 -21 35 -3 0 15Z" fill="#526663"
         stroke="#9aaa91" strokeWidth="1.7"/>
       <path d="M-34 -5 -34 -43 0 -62 0 -22Z" fill="#53605c"
         stroke="#a4a68f" strokeWidth="1.4"/>
       <path d="M0 -22 0 -62 34 -43 34 -5Z" fill="#293b43"
         stroke="#80918a" strokeWidth="1.4"/>
       <path d="M-34 -43 0 -62 34 -43 0 -25Z"
         fill={annex?'#69746b':service?'#7c7664':'#616f68'}
         stroke="#a9afa0" strokeWidth="1.4"/>
       <path d="M-21 -45 -2 -55 18 -45 0 -35Z"
         fill="#293c3d" opacity=".55"/>
       <path d="M-26 -34 -9 -43V-18L-26 -9Z"
         fill="#1a343b" stroke="#93aba1" strokeWidth="1.5"/>
       <path d="M-23 -28 -12 -34M-23 -22 -12 -28" stroke="#71baa9"
         strokeWidth="2" opacity=".7"/>
       <path d="M9 -43 26 -34V-12L9 -21Z"
         fill="#162b32" stroke="#718d8d" strokeWidth="1.5"/>
       <path d="M10 -35 25 -26" stroke={warm?'#f0c78d':'#7bccc3'}
         strokeWidth="2.5" opacity=".75"/>
       <path d="M-36 -2 0 16 36 -2" fill="none"
         stroke="#b89e75" strokeWidth="2"/>
       {annex&&<path d="M-2 -62V-72M-8 -71H5" stroke="#b7c7b7"
         strokeWidth="2.5"/>}
       <circle cx="27" cy="-41" r="3.5" fill={warm?'#ffb96f':'#8fe3d2'} />
     </g>;
    })}
  <g data-testid="ground-colony-connected-roofs">
   {roofJoins.filter(({from,to})=>
     explored.has(key(from.x,from.y))&&explored.has(key(to.x,to.y))&&
     (!warehouseKnown||
       (!warehouseKeys.has(key(from.x,from.y))&&!warehouseKeys.has(key(to.x,to.y)))))
    .map(({from,to})=>{
     const start=at(from.x,from.y),end=at(to.x,to.y);
     const bothVisible=visible.has(key(from.x,from.y))&&visible.has(key(to.x,to.y));
     const id=key(from.x,from.y)+'-to-'+key(to.x,to.y);
     // A single roof deck spans two *existing* blocked cells. Its transverse
     // vector follows the actual isometric edge, so x- and y-facing wings
     // receive the same perspective without inventing walkable tiles.
     const sx=start.x,sy=start.y-47,ex=end.x,ey=end.y-47;
     const length=Math.hypot(ex-sx,ey-sy);
     const px=-(ey-sy)*17/length,py=(ex-sx)*17/length;
     const point=(x:number,y:number)=>x.toFixed(2)+' '+y.toFixed(2);
     const roof='M'+point(sx+px,sy+py)+' L'+point(ex+px,ey+py)+
       ' L'+point(ex-px,ey-py)+' L'+point(sx-px,sy-py)+'Z';
     const fascia='M'+point(sx+px,sy+py)+' L'+point(ex+px,ey+py)+
       ' L'+point(ex+px,ey+py+9)+' L'+point(sx+px,sy+py+9)+'Z';
     const mx=(sx+ex)/2,my=(sy+ey)/2;
     // Place the front wall on the screen-facing edge of the actual joined
     // blocked tiles. Both 45-degree orientations must face down-screen.
     const front=py>=0?1:-1;
     const ax=sx+px*front,ay=sy+py*front;
     const bx=ex+px*front,by=ey+py*front;
     const facadeQuad=(u:number,v:number,top:number,bottom:number)=>{
       const x1=ax+(bx-ax)*u,y1=ay+(by-ay)*u;
       const x2=ax+(bx-ax)*v,y2=ay+(by-ay)*v;
       return 'M'+point(x1,y1+top)+' L'+point(x2,y2+top)+
         ' L'+point(x2,y2+bottom)+' L'+point(x1,y1+bottom)+'Z';
     };
     const warm=(from.x+from.y)%3===0;
     const glass=warm?'#bda984':'#7fc4be';
     return <g key={id} data-testid={'ground-colony-roof-'+id}
       data-fog={bothVisible?'visible':'remembered'}
       opacity={bothVisible?0.94:0.3}>
       <path d={fascia} fill="#23383e" stroke="#0e252f" strokeWidth="1.5"/>
       {/* A shared, windowed wall replaces the open gap between adjacent
           blocked modules. It cannot create a new walkable cell or doorway;
           the roof join only exists for two physical wall tiles. */}
       <g data-testid={'ground-colony-facade-'+id}
         data-fog={bothVisible?'visible':'remembered'}
         pointerEvents="none">
         <path d={facadeQuad(0,.99,2,30)}
           fill="#2d474d" stroke="#102b33" strokeWidth="1.7"/>
         <path d={facadeQuad(.07,.46,8,22)}
           fill="#102d39" stroke="#849c99" strokeWidth="1.6"/>
         <path d={facadeQuad(.54,.93,8,22)}
           fill="#102d39" stroke="#849c99" strokeWidth="1.6"/>
         <path d={facadeQuad(.11,.42,11,19)}
           fill={glass} opacity=".83"/>
         <path d={facadeQuad(.58,.89,11,19)}
           fill={glass} opacity=".7"/>
         <path d={facadeQuad(.1,.43,23,26)}
           fill="#192e35" stroke="#809995" strokeWidth=".6"/>
         <path d={facadeQuad(.57,.9,23,26)}
           fill="#192e35" stroke="#809995" strokeWidth=".6"/>
         <path d={facadeQuad(.46,.54,3,29)}
           fill="#8f9c8b" stroke="#213c42" strokeWidth=".9"/>
         <path d={facadeQuad(.03,.97,28,30)}
           fill="#bfad82"/>
       </g>
       <path data-testid={'ground-colony-roof-deck-'+id}
         d={roof} fill="#63756e" stroke="#abb9a3" strokeWidth="1.5"/>
       <path d={`M${point(sx-px*.6,sy-py*.6)} L${point(ex-px*.6,ey-py*.6)}`}
         stroke="#304b50" strokeWidth="3" fill="none"/>
       <path d={`M${point(sx+px*.7,sy+py*.7)} L${point(ex+px*.7,ey+py*.7)}`}
         stroke="#d0b88b" strokeWidth="2" strokeDasharray="10 6" fill="none"/>
       <path d={`M${point(mx+px*.45,my+py*.45)} L${point(mx-px*.45,my-py*.45)}`}
         stroke="#283d43" strokeWidth="6" fill="none"/>
       <path d={`M${point(mx+px*.45,my+py*.45-2)} L${point(mx-px*.45,my-py*.45-2)}`}
         stroke="#9bc9b9" strokeWidth="1.4" fill="none"/>
       <circle cx={mx} cy={my} r="3.5" fill="#253f45" stroke="#b8bfa8" strokeWidth="1.5"/>
       <circle cx={mx} cy={my} r="1.3" fill="#e0c58d"/>
     </g>;
    })}
  </g>
  <GroundWarehouseBlock known={warehouseKnown} visible={visible}/>
  {/* Hollow frames sit on the two real wall ends. Both adjacent walls
       must have been explored: a glowing lintel cannot reveal hidden geometry.
       All geometry is behind officers and excluded from pointer picking. */}
  <g data-testid="ground-colony-gateways" pointerEvents="none">
   {gateways.filter(g=>[key(g.x,g.y),key(g.x,g.y-1),key(g.x,g.y+1)]
    .every(id=>explored.has(id))).map(g=>{
     const ids=[key(g.x,g.y),key(g.x,g.y-1),key(g.x,g.y+1)];
     const illuminated=ids.every(id=>visible.has(id));
     const pos=at(g.x,g.y),id=key(g.x,g.y);
     const accent=g.kind==='service'?'#8dd7c8':'#dfc48f';
     return <g key={id} data-testid={'ground-gateway-'+id}
       data-fog={illuminated?'visible':'remembered'}
       data-gateway-kind={g.kind}
       transform={`translate(${pos.x} ${pos.y})`}
       opacity={illuminated?1:.3}>
       <title>{g.kind==='service'?'Paso de mantenimiento':'Acceso al perímetro'}</title>
       {/* The open floor remains unobstructed and uses its original tile ID. */}
       <path d="M-29 13L26 -15" fill="none"
         stroke="#132c35" strokeWidth="9" strokeLinecap="round"/>
       <path d="M-29 13L26 -15" fill="none"
         stroke={accent} strokeWidth="2" opacity=".8"/>
       {/* Isometric side jambs support a hollow raised lintel, not a door
           slab that would visually imply a closed or impassable square. */}
       <path d="M-26 10V-27L26 -53V-16"
         stroke="#102830" strokeWidth="11" fill="none" strokeLinejoin="round"/>
       <path d="M-26 10V-27L26 -53V-16"
         stroke="#768e8c" strokeWidth="6" fill="none" strokeLinejoin="round"/>
       <path d="M-26 -27L26 -53"
         stroke={accent} strokeWidth="2.4" fill="none"/>
       <path d="M-26 -19V3M26 -45V-22" stroke="#b7d2c6"
         strokeWidth="1.5" fill="none" opacity=".75"/>
       <path d="M-17 -31L17 -48" stroke="#c6d9cb"
         strokeWidth="1" strokeDasharray="5 5" fill="none" opacity=".65"/>
       <circle cx="-26" cy="-28" r="3" fill={accent}/>
       <circle cx="26" cy="-54" r="3" fill={accent}/>
     </g>;
    })}
  </g>
 </g>;
}

function StationGeometry({id}:{id:string}){
 if(id==='sensor-vault')return <>
  <ellipse cy="10" rx="41" ry="16" fill="#0a191e" opacity=".8"/>
  <path d="M-34 -1 0 -20 34 -1 0 18Z" fill="#476263"
    stroke="#c8b48b" strokeWidth="2"/>
  <path d="M-34 -3V-49L0 -69V-21Z" fill="#657570"
    stroke="#b7c0ad" strokeWidth="2"/>
  <path d="M0 -21V-69L34 -49V-3Z" fill="#273e48"
    stroke="#91a9a3" strokeWidth="1.5"/>
  <path d="M-34 -49 0 -69 34 -49 0 -29Z" fill="#8a8877"
    stroke="#c1bda8" strokeWidth="1.5"/>
  <path d="M-23 -42 -8 -50V-20L-23 -12Z"
    fill="#15333b" stroke="#7ec5bb" strokeWidth="1.2"/>
  <path d="M-20 -36 -10 -41M-20 -28 -10 -33"
    stroke="#9af8e1" strokeWidth="2.2"/>
  <path d="M9 -49 25 -40V-13L9 -22Z"
    fill="#0a2a33" stroke="#9bc0bc" strokeWidth="1.6"/>
  <path d="M12 -39 23 -32M12 -32 23 -25" stroke="#80d7d1"
    strokeWidth="2"/>
  <path d="M-10 -64 0 -70 10 -64 0 -58Z" fill="#384d4c"/>
  <path d="M-5 -65V-78M5 -65V-78" stroke="#9bb7b3" strokeWidth="2"/>
  <circle cy="-79" r="3" fill="#e6c58c"/>
 </>;
 if(id==='relief-point')return <>
  <ellipse cy="10" rx="39" ry="16" fill="#061b23" opacity=".7"/>
  <path d="M-35 -3 0 -20 35 -3 0 16Z" fill="#4c6061"
    stroke="#c3b993" strokeWidth="2.3"/>
  <path d="M-32 -2V-31L0 -48V-19Z" fill="#7a7770"/>
  <path d="M0 -19V-48L32 -31V-2Z" fill="#384d53"/>
  <path d="M-38 -32 0 -54 38 -32 0 -12Z" fill="#9f9b87"
    stroke="#e0cda2" strokeWidth="2.4"/>
  <path d="M-34 -31 0 -50 34 -31" stroke="#c6a774" strokeWidth="3"/>
  <path d="M13 -34 27 -27V-11L13 -18Z" fill="#172d38"
    stroke="#a3b7b3" strokeWidth="1.5"/>
  <path d="M-22 -17 -7 -25V-6L-22 2Z" fill="#152f39"
    stroke="#9dd5c8" strokeWidth="1.4"/>
  <path d="M0 -44V-27M-9 -35H9" stroke="#fff0d5" strokeWidth="5"/>
  <path d="M-37 -31 -43 -25M37 -31 43 -25"
    stroke="#a6b8ae" strokeWidth="2.5"/>
  <circle cx="28" cy="-36" r="3" fill="#ffb67d"/>
 </>;
 if(id==='probe')return <>
  <ellipse cy="8" rx="37" ry="14" fill="#071820" opacity=".75"/>
  <path d="M-29 -2 0 -18 29 -2 0 14Z" fill="#4a686b"
    stroke="#c1c9ad" strokeWidth="2"/>
  <path d="M-24 -5 0 -17 24 -5" fill="none"
    stroke="#7ebdb2" strokeWidth="2.5"/>
  <path d="M0 -5V-56" stroke="#b4c8c5" strokeWidth="5"/>
  <path d="M-14 -19 0 -45 14 -19M-11 -35H11" fill="none"
    stroke="#819e9f" strokeWidth="3"/>
  <path d="M-29 -60Q1 -26 29 -60L22 -74Q0 -59 -22 -74Z"
    fill="#839fa5" stroke="#d6e3d3" strokeWidth="2.2"/>
  <path d="M-22 -74 0 -61 22 -74" fill="none"
    stroke="#c9d7d0" strokeWidth="2"/>
  <path d="M0 -45 21 -73" stroke="#d7d3b6" strokeWidth="2"/>
  <circle cx="22" cy="-74" r="4.5" fill="#b7f2d9"/>
  <rect x="-8" y="-14" width="16" height="11" rx="2" fill="#1a3a40"
    stroke="#78d2bd" strokeWidth="1.5"/>
  <circle cy="-8" r="2.7" fill="#b7f2d9"/>
 </>;
 if(id==='perimeter-uplink')return <>
  <ellipse cy="7" rx="38" ry="13" fill="#061b20" opacity=".7"/>
  <path d="M-30 -5 0 -22 30 -5 0 13Z" fill="#4c6968"
    stroke="#b5c4aa" strokeWidth="2"/>
  <path d="M-24 -4V-16L0 -29 24 -16V-4L0 9Z"
    fill="#334b50" stroke="#8dacaa" strokeWidth="1.4"/>
  <path d="M-15 -21 -8 -36 0 -88 8 -36 15 -21M-8 -36H8M-5 -51H5"
    fill="none" stroke="#b9ccbe" strokeWidth="3"/>
  <path d="M-22 -16 -4 -7 16 -18" stroke="#e1c990"
    strokeWidth="2.4" fill="none"/>
  <path d="M0 -88V-105" stroke="#d4e3d7" strokeWidth="2"/>
  <circle cy="-107" r="5" fill="#a4f4d9"/>
  <circle cy="-107" r="17" stroke="#82d5c3"
    strokeWidth="1.2" fill="none" opacity=".35"/>
  <circle cx="16" cy="-18" r="4" fill="#ffab70"/>
 </>;
 return <>
  <ellipse cy="9" rx="42" ry="19" fill="#081922" opacity=".7"/>
  <path d="M-39 0 0 -22 39 0 0 22Z" fill="#354e55"
    stroke="#d3b87a" strokeWidth="3"/>
  <path d="M-27 0 0 -15 27 0 0 15Z" fill="#153f48"
    stroke="#79d6c4" strokeWidth="2"/>
  <path d="M-11 -4 0 -10 11 -4 0 2Z" fill="#83e7cf" opacity=".6"/>
  <path d="M-34 -1 0 -20M0 20 34 1" stroke="#f4d28d"
    strokeWidth="3" strokeDasharray="7 4"/>
  <path d="M-35 3V-18M35 3V-18" stroke="#c6b88e" strokeWidth="3"/>
  <path d="M-40 -19 -29 -24 0 -9 29 -24 40 -19" fill="none"
    stroke="#9ba7a5" strokeWidth="2.3"/>
  <circle cx="-35" cy="-21" r="4" fill="#f6c984"/>
  <circle cx="35" cy="-21" r="4" fill="#f6c984"/>
 </>;
}

export function GroundColonyStations({explored,visible}:Vision){
 return <g data-testid="ground-outpost-landmarks" pointerEvents="none">
  {scene.objects.map(object=>{
   const id=key(object.x,object.y),known=explored.has(id),inSight=visible.has(id);
   const p=at(object.x,object.y);
   return <g key={object.id} data-testid={'ground-landmark-'+object.id}
     data-fog={inSight?'visible':known?'remembered':'unknown'}
     visibility={known?'visible':'hidden'} opacity={inSight?1:.34}
     transform={`translate(${p.x} ${p.y})`}>
     <title>{object.label}</title>
     <StationGeometry id={object.id}/>
     <text x={object.id==='sensor-vault'?43:object.id==='probe'?18:0}
       y={object.id==='sensor-vault'?-38:object.id==='probe'?-47:
         object.id==='relief-point'?-59:object.id==='perimeter-uplink'?39:37}
       textAnchor={object.id==='sensor-vault'?'start':'middle'}
       className="ground-landmark-name">{labels[object.id]??object.label}</text>
   </g>;
  })}
 </g>;
}
