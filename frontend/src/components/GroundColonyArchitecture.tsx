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

export function GroundColonyWalls({explored,visible}:Vision){
 return <g data-testid="ground-colony-walls" pointerEvents="none">
  {scene.walls.filter(p=>p.x>0&&p.y>0&&
    p.x<scene.width-1&&p.y<scene.height-1&&explored.has(key(p.x,p.y)))
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
         object.id==='relief-point'?-59:object.id==='perimeter-uplink'?-76:37}
       textAnchor={object.id==='sensor-vault'?'start':'middle'}
       className="ground-landmark-name">{labels[object.id]??object.label}</text>
   </g>;
  })}
 </g>;
}
