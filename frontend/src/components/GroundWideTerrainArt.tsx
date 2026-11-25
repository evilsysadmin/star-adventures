// Original, reusable scene vocabulary for the K-47 32x20 expedition.
// The pure kit owns biome identity; this view owns ONLY paint. Pointer
// events are forbidden here: the 640 authoritative pick polygons stay below.
type GroundTile={
  x:number;y:number;key:string;sectorId:string;family:string;floor:string;
  edge:string;highlight:string;variant:number;grain:number;blocked:boolean;
};
type GroundBarrier={
  x:number;y:number;key:string;sectorId:string;family:string;
  wall:string;variant:number;
};
const project=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});

export function WideTerrainDetail({tile}:{tile:GroundTile}){
  const p=project(tile.x,tile.y),v=tile.variant;
  return <g key={tile.key} data-wide-terrain={tile.key}
    data-wide-art-family={tile.family} data-wide-art-sector={tile.sectorId}
    transform={`translate(${p.x} ${p.y})`} pointerEvents="none" aria-hidden="true">
    {tile.family==='landing-deck'&&<>
      {/* Open prefabricated landing slabs; there are no fake obstacles. */}
      <path d="M-31 0 -2 -15 31 0 2 15Z" fill="none"
        stroke={tile.highlight} strokeWidth="1.1" strokeOpacity=".34"/>
      <path d={v%2===0?'M-15 -8 -8 -4 M15 8 8 4':'M-17 6 -7 1 M13 -9 20 -5'}
        stroke="#b8c7af" strokeWidth="1.7" opacity=".46"/>
      <path d="M-6 -9 6 -9 M-6 9 6 9" stroke="#1a3131" strokeWidth="2.4"
        opacity=".36"/>
      {v===3&&<path d="M-26 0 -14 -6 M-16 9 -6 4" stroke="#d9b777"
        strokeWidth="3.3" opacity=".58"/>}
    </>}
    {tile.family==='service-steel'&&<>
      {/* Industrial gantry floor. No implied collision from hatch lines. */}
      <path d="M-26 0 0 -13 26 0 0 13Z" fill="none"
        stroke="#aec4ba" strokeOpacity=".32" strokeWidth="1.2"/>
      <path d="M-16 -2 -8 -6 16 6 M-20 4 3 -8 21 1"
        stroke="#172f37" strokeWidth="2" opacity=".6" fill="none"/>
      {(v===0||v===4)&&<>
        <path d="M-10 0 0 -5 10 0 0 5Z" fill="#203e45"
          stroke="#85a8a6" strokeWidth="1.1"/>
        <path d="M-6 -1 3 3 M-2 -3 7 1" stroke="#9fc6bc"
          strokeWidth="1" opacity=".65"/>
      </>}
      <circle cx="-24" cy="0" r="1.7" fill="#b2c6b3" opacity=".52"/>
      <circle cx="24" cy="0" r="1.7" fill="#b2c6b3" opacity=".52"/>
    </>}
    {tile.family==='ridge-shale'&&<>
      {/* Directional cracked limestone/shale, no giant fake mountains. */}
      <path d={v%2===0
        ? 'M-32 2 -17 -3 -8 -1 0 -7 12 -6 27 -2'
        : 'M-28 -3 -16 -1 -7 -9 4 -5 19 -6 31 0'}
        fill="none" stroke="#a4b4a0" strokeWidth="2.3" opacity=".43"/>
      <path d="M-18 7 -10 3 2 6 13 3 M-4 -12 5 -9 17 -11"
        fill="none" stroke="#1c3837" strokeWidth="2.1" opacity=".55"/>
      {v%3===0&&<path d="M-7 0 0 -4 8 -2 0 3Z"
        fill="#85958a" stroke="#b5b9a1" strokeWidth=".8" opacity=".72"/>}
      {tile.grain===1&&<g fill="#b3bd9b" opacity=".48">
        <circle cx="-16" cy="-4" r="1.2"/><circle cx="12" cy="8" r="1.7"/>
      </g>}
    </>}
    {tile.family==='freight-concrete'&&<>
      {/* Recessed rail grooves and patched cargo pavement. */}
      <path d="M-30 0 0 -15 30 0 0 15Z" fill="none"
        stroke="#c1bba9" strokeOpacity=".24" strokeWidth="1.2"/>
      <path d="M-20 -4 11 11 M-10 -9 20 6"
        stroke="#242f31" strokeWidth="3" opacity=".48"/>
      <path d="M-22 3 3 -10 M-11 9 15 -4"
        stroke="#a5ac9e" strokeWidth="1" opacity=".37"/>
      {v===0&&<path d="M-7 -9 7 -3 M-12 -6 2 0" fill="none"
        stroke="#d9bd77" strokeWidth="2.6" opacity=".7"/>}
    </>}
    {tile.family==='lab-ceramic'&&<>
      {/* Pale sealed floor with legible safety channel, not a fake terminal. */}
      <path d="M-32 0 0 -16 32 0 0 16Z" fill="none"
        stroke="#c2ddd0" strokeWidth="1.7" opacity=".6"/>
      <path d="M-23 0 0 -11 23 0 0 11Z" fill="#85a3a2" fillOpacity=".08"
        stroke="#bfd7cc" strokeWidth="1" strokeOpacity=".35"/>
      {v%2===0&&<path d="M-18 6 -9 10 13 -1"
        stroke="#9cdecb" strokeWidth="2.1" fill="none" opacity=".65"/>}
      <circle cy="0" r="2" fill="#b6ded0" opacity=".66"/>
    </>}
    {tile.family==='weathered-steppe'&&<>
      {/* Low wind-etched rock and lichen; small plants stay traversable. */}
      <path d="M-28 0 -16 -4 -7 -2 5 -8 16 -5 28 -2"
        stroke="#a19b76" strokeWidth="2.4" opacity=".42" fill="none"/>
      <path d="M-14 7 -5 3 6 5 16 2" stroke="#1f3634"
        strokeWidth="2.6" fill="none" opacity=".56"/>
      {(v===1||v===4)&&<path d="M-5 2 -7 -6 M-5 2 1 -5 M-5 2 4 2"
        fill="none" stroke="#7f9970" strokeWidth="2" opacity=".84"
        strokeLinecap="round"/>}
      {tile.grain===0&&<circle cx="13" cy="3" r="2.8"
        fill="#a39b7e" opacity=".65"/>}
    </>}
  </g>;
}

export function WideTerrainBarrier({wall}:{wall:GroundBarrier}){
  const p=project(wall.x,wall.y),v=wall.variant;
  // Every form occupies one ACTUAL blocked cell. Faces project upward only,
  // never relocate a hitbox or become an invisible stand-in for collision.
  return <g key={wall.key} data-wide-wall={wall.key}
    data-wide-wall-style={wall.wall} data-wide-art-sector={wall.sectorId}
    transform={`translate(${p.x} ${p.y})`} pointerEvents="none" aria-hidden="true">
    {wall.wall==='rock'&&<>
      <path d="M-34 -5 -21 -19 -6 -25 8 -24 24 -15 34 -4 0 12Z"
        fill="#727e70" stroke="#a6af99" strokeWidth="1.6"/>
      <path d="M-34 -5 0 12 0 29 -34 10Z" fill="#354740"/>
      <path d="M0 12 34 -4 34 10 0 29Z" fill="#263a3b"/>
      <path d="M-22 -17 -9 -12 1 -21 12 -11 M-15 -5 1 0 18 -8"
        fill="none" stroke="#c3bd9e" strokeWidth="2" opacity=".5"/>
      <path d="M-24 8 -10 17 -6 15 M10 18 26 7"
        fill="none" stroke="#7d8e79" strokeWidth="1.6" opacity=".62"/>
      {v===2&&<path d="M-25 -13 -17 -15 -15 -10 -22 -8Z"
        fill="#929b83" opacity=".7"/>}
    </>}
    {wall.wall==='service'&&<>
      <path d="M-32 -13 0 -29 32 -13 0 3Z" fill="#8eaaa5"
        stroke="#c4d0bc" strokeWidth="1.7"/>
      <path d="M-32 -13 0 3 0 27 -32 11Z" fill="#35525b"/>
      <path d="M0 3 32 -13 32 11 0 27Z" fill="#23434e"/>
      <path d="M-28 -11 0 3 28 -11 M-26 7 -2 19 M4 19 27 7"
        fill="none" stroke="#a1c3be" strokeWidth="1.4" opacity=".45"/>
      <path d="M-12 -22 0 -28 12 -22" fill="none"
        stroke="#e1ce9c" strokeWidth="1.7" opacity=".8"/>
      <circle cx="-24" cy="5" r="1.8" fill="#d2cfad"/>
      <circle cx="25" cy="5" r="1.8" fill="#d2cfad"/>
      {v===1&&<path d="M8 15 25 6" stroke="#d9ae74" strokeWidth="3"
        opacity=".6"/>}
    </>}
    {wall.wall==='freight'&&<>
      <path d="M-34 -12 0 -29 34 -12 0 5Z" fill="#b1a894"
        stroke="#d5c7aa" strokeWidth="1.4"/>
      <path d="M-34 -12 0 5 0 25 -34 8Z" fill="#62564a"/>
      <path d="M0 5 34 -12 34 8 0 25Z" fill="#474743"/>
      <path d="M-25 -6 -13 0 M-9 2 1 8 M5 8 18 1 M22 -1 30 -5"
        fill="none" stroke="#e2bd70" strokeWidth="4" opacity=".68"/>
      <path d="M-30 5 -4 17 M4 17 30 5"
        fill="none" stroke="#c4b7a0" strokeWidth="1.2" opacity=".53"/>
    </>}
    {wall.wall==='lab'&&<>
      <path d="M-32 -13 0 -29 32 -13 0 3Z" fill="#adc9c5"
        stroke="#d7ede2" strokeWidth="1.7"/>
      <path d="M-32 -13 0 3 0 29 -32 12Z" fill="#416c70"/>
      <path d="M0 3 32 -13 32 12 0 29Z" fill="#2c5961"/>
      <path d="M-28 -2 -4 10 M4 10 28 -2"
        fill="none" stroke="#bbdcd5" strokeWidth="1.3" opacity=".66"/>
      <path d="M-24 3 -8 11 M8 11 24 3"
        fill="none" stroke="#8cddc8" strokeWidth="3.3" opacity=".68"/>
      <path d="M-10 -23 0 -28 10 -23" fill="none"
        stroke="#e2eee4" strokeWidth="2.5" opacity=".75"/>
    </>}
  </g>;
}
