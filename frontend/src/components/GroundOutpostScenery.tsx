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
   <linearGradient id="planet-rock-terrace" x1="0" y1="0" x2=".62" y2="1">
    <stop stopColor="#445750"/>
    <stop offset=".43" stopColor="#30463f"/>
    <stop offset="1" stopColor="#152e35"/>
   </linearGradient>
   <linearGradient id="planet-dusk-haze" x1="0" y1="0" x2="0" y2="1">
    <stop stopColor="#91aca2" stopOpacity=".16"/>
    <stop offset="1" stopColor="#1c363a" stopOpacity="0"/>
   </linearGradient>
  </defs>
  <rect width="1120" height="550" fill="url(#planet-sky)"/>
  <circle cx="738" cy="93" r="23" fill="#d3c6a1" opacity=".68"/>
  <path d="M0 248 82 196 158 212 241 166 317 219 405 180 495 232 577 177 665 212 763 165 854 204 960 176 1040 205 1120 175V550H0Z" fill="#253e46"/>
  <path d="M0 294 94 249 192 278 283 240 369 275 473 237 564 275 656 232 769 278 900 246 1030 277 1120 239V550H0Z" fill="#1b353b"/>
  <ellipse cx="449" cy="330" rx="455" ry="110" fill="#071b23" opacity=".5"/>
  {/* Far beyond the canonical 13×10 ground grid: terraces, dust and stone
      strata give the planet scale without pretending to be extra playable
      cells, objects or revealed terrain. This layer sits below every tile,
      fog mask and officer, and never participates in ground-cell picking. */}
  <g data-testid="ground-exterior-geology" pointerEvents="none" aria-hidden="true">
   <path d="M0 314 Q94 284 170 299 T357 292 Q461 310 565 288
     T785 295 Q938 265 1120 294V344H0Z"
     fill="url(#planet-dusk-haze)"/>
   <path d="M0 397 66 376 118 385 182 360 246 380 324 374
     356 403 331 433 259 444 195 476 112 486 0 503Z"
     fill="url(#planet-rock-terrace)" stroke="#536d63" strokeWidth="2"/>
   <path d="M0 441 71 424 150 445 219 437 282 421 341 433
     287 463 213 484 122 515 0 527Z"
     fill="#243d3e" opacity=".88"/>
   <path d="M0 490 85 474 151 484 229 465 297 467 260 493
     174 519 96 544 0 550Z" fill="#182f35"/>
   <path d="M867 378 936 356 1013 367 1081 347 1120 359
     V495L1072 476 1011 448 957 431 904 415Z"
     fill="url(#planet-rock-terrace)" stroke="#597267" strokeWidth="2"/>
   <path d="M907 427 979 409 1032 423 1120 402V507
     L1057 484 1000 454Z" fill="#243e40"/>
   <path d="M943 476 1000 451 1083 478 1120 468V550
     L1062 537 986 513Z" fill="#192e35"/>
   <g data-testid="ground-exterior-strata" fill="none"
     strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 408 67 389 118 397 188 373M28 459 89 444 151 457
      224 447M0 505 95 487 153 499 224 479"
      stroke="#8b9780" strokeWidth="2.1" opacity=".38"/>
    <path d="M900 389 938 374 1002 384 1082 364M953 440
      999 425 1056 446 1110 427M984 491 1030 474 1092 497"
      stroke="#a0a088" strokeWidth="2" opacity=".34"/>
    <path d="M52 420 76 418 84 430M203 395 232 402 253 396
      M108 501 136 509M987 391 1006 401M1041 471 1067 466 1087 479"
      stroke="#132a31" strokeWidth="4" opacity=".6"/>
   </g>
   <g fill="#789281" opacity=".5">
    <circle cx="30" cy="442" r="3"/><circle cx="61" cy="451" r="2"/>
    <circle cx="231" cy="469" r="3"/><circle cx="284" cy="442" r="2"/>
    <circle cx="971" cy="429" r="2"/><circle cx="1061" cy="460" r="3"/>
    <circle cx="1097" cy="493" r="2"/>
   </g>
  </g>
 </g>;
}

export function GroundOutpostLandmarks({explored,visible}:{explored:ReadonlySet<string>;visible:ReadonlySet<string>}){
 return <g data-testid="ground-outpost-landmarks" pointerEvents="none">
  {scene.objects.map(object=>{
   const {x,y}=project(object.x,object.y);
   const tileId=object.x+','+object.y;
   const known=explored.has(tileId),inSight=visible.has(tileId);
   return <g key={object.id} data-testid={'ground-landmark-'+object.id}
     data-fog={inSight?'visible':known?'remembered':'unknown'}
     visibility={known?'visible':'hidden'} opacity={inSight?1:.36}
     transform={`translate(${x} ${y})`}>
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

// Secondary surface ecology is authored as decorative terrain, not fake
// stations. It never participates in picking; large boulders are separately
// present in the authoritative scene.walls collision list.
export function GroundWildSectorScenery({explored,visible}:{explored:ReadonlySet<string>;visible:ReadonlySet<string>}){
 return <g pointerEvents="none" data-testid="ground-wild-sector-scenery">
  {scene.scenery.map((feature,index)=>{
   const {x,y}=project(feature.x,feature.y);
   const tileId=feature.x+','+feature.y;
   const known=explored.has(tileId),inSight=visible.has(tileId);
   return <g key={index} transform={`translate(${x} ${y})`}
     data-testid={'ground-scenery-'+feature.type+'-'+index}
     data-fog={inSight?'visible':known?'remembered':'unknown'}
     visibility={known?'visible':'hidden'} opacity={inSight?1:.33}>
    {feature.type==='crater'?<>
      <ellipse rx="32" ry="15" fill="#263d3c" stroke="#a6a286" strokeWidth="4"/>
      <ellipse rx="23" ry="9" fill="#152e33" />
      <path d="M-32 0 -25 11M30 -4 20 -13" stroke="#c1b89a" strokeWidth="3"/>
    </>:feature.type==='crystal'?<>
      <ellipse cy="6" rx="14" ry="7" fill="#1f3434"/>
      <path d="M-14 3 -7 -20 3 -31 13 -8 11 4 0 9Z" fill="#80a79b" stroke="#aed9bd" strokeWidth="2"/>
      <path d="M3 -31V9M-7 -20 3 -10 13 -8" stroke="#c4f0d4" fill="none"/>
    </>:feature.type==='stone'?<>
      <ellipse cy="7" rx="17" ry="7" fill="#243e3c" />
      <path d="M-16 2 -9 -13 4 -21 16 -9 18 4 0 10Z" fill="#5c776a" stroke="#9ba693" strokeWidth="1.5"/>
      <path d="M4 -21V-2L18 4" stroke="#334d4a" strokeWidth="3"/>
    </>:<>
      <path d="M-10 5Q-7 -11 -3 -18M0 6Q4 -19 6 -22M9 5Q11 -8 15 -13"
        stroke="#91b28b" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <ellipse cy="6" rx="13" ry="4" fill="#334e42"/>
    </>}
   </g>;
  })}
 </g>;
}
