import world from '../../../content/scenes/meridian.json';

// Scenery consumes only the authored location records. Picking and game
// commands remain owned by GroundSquadSelection, never by these SVG shapes.
const scene=world.scenes.surface;
const project=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const labels:Record<string,string>={
  probe:'SONDA', 'sensor-vault':'ARCHIVO', 'relief-point':'SOCORRO',
  'perimeter-uplink':'BALIZA', 'beam-out':'EXTRACCIÓN',
};

export function GroundPlanetBackdrop(){
 return <g pointerEvents="none" data-testid="ground-planet-backdrop">
  <defs>
   <linearGradient id="planet-sky" x2="0" y2="1">
    <stop stopColor="#101b2d"/><stop offset="1" stopColor="#294247"/>
   </linearGradient>
  </defs>
  <rect width="900" height="430" fill="url(#planet-sky)"/>
  <circle cx="738" cy="93" r="23" fill="#d3c6a1" opacity=".68"/>
  <path d="M0 248 82 196 158 212 241 166 317 219 405 180 495 232 577 177 665 212 763 165 854 204 900 192V430H0Z" fill="#253e46"/>
  <path d="M0 294 94 249 192 278 283 240 369 275 473 237 564 275 656 232 769 278 900 246V430H0Z" fill="#1b353b"/>
  <ellipse cx="449" cy="330" rx="353" ry="85" fill="#071b23" opacity=".5"/>
 </g>;
}

export function GroundOutpostLandmarks(){
 return <g data-testid="ground-outpost-landmarks" pointerEvents="none">
  {scene.objects.map(object=>{
   const {x,y}=project(object.x,object.y);
   return <g key={object.id} data-testid={'ground-landmark-'+object.id} transform={`translate(${x} ${y})`}>
    <title>{object.label}</title>
    <ellipse cy="6" rx="30" ry="12" fill="#091a20" opacity=".7"/>
    {object.id==='beam-out'?<>
     <path d="M-33 0 0 -17 33 0 0 17Z" fill="#304b50" stroke="#d8c08f" strokeWidth="3"/>
     <path d="M-22 0 0 -11 22 0 0 11Z" fill="#1c5360" stroke="#8ee9d7" strokeWidth="2"/>
     <circle r="7" fill="#bff9dd" opacity=".7"/>
    </>:object.id==='probe'?<>
     <path d="M-19 -5 0 -15 19 -5 0 5Z" fill="#6b8a89" stroke="#c1ddc9" strokeWidth="2"/>
     <path d="M0 -9V-42" stroke="#b9cdcd" strokeWidth="5"/>
     <path d="M-21 -47Q0 -25 21 -47L13 -61Q0 -52 -13 -61Z" fill="#8ea9a8" stroke="#d5e4cf" strokeWidth="2"/>
     <circle cx="16" cy="-62" r="4" fill="#b7fce0"/>
    </>:object.id==='perimeter-uplink'?<>
     <path d="M-18 -3 0 -12 18 -3 0 7Z" fill="#527474"/>
     <path d="M0 -8V-55M-12 -28 0 -55 12 -28M-12 -36H12" stroke="#a8c6be" strokeWidth="3" fill="none"/>
     <circle cy="-58" r="5" fill="#a8eecf"/>
     <circle cy="-58" r="15" stroke="#a8eecf" opacity=".4" fill="none"/>
    </>:<>
     <path d="M-29 -7V-32L0 -49 29 -32V-7L0 11Z" fill="#263e48" stroke="#a1bfb9" strokeWidth="2"/>
     <path d="M-29 -32 0 -49 29 -32 0 -15Z" fill={object.id==='relief-point'?'#ac9f87':'#708e8c'}/>
     <path d="M0 -15 29 -32V-7L0 11Z" fill="#19313b"/>
     {object.id==='relief-point'
      ? <path d="M16 -24V-7M8 -15H24" stroke="#f5dfb8" strokeWidth="4"/>
      : <path d="M-15 -17 -3 -23V-7L-15 -1Z" fill="#8de4db"/>}
    </>}
    <text
      x={object.id==='sensor-vault'?43:object.id==='probe'?16:0}
      y={object.id==='beam-out'?35:object.id==='sensor-vault'?-30:
         object.id==='probe'?-40:object.id==='relief-point'?-54:35}
      textAnchor={object.id==='sensor-vault'?'start':'middle'}
      className="ground-landmark-name">{labels[object.id]}</text>
   </g>;
  })}
 </g>;
}
