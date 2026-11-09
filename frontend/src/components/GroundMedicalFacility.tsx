// Authored medical facility art for the existing 'relief-point' station.
// This is a visual mesh in the fixed isometric projection: no extra
// collision, station, gameplay action or traversable platform is created.
// The parent GroundColonyStations element owns discovery and fog opacity.
export function GroundMedicalFacility(){
  return <g data-testid="ground-medical-facility-volume"
    aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id="medical-module-roof" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#b6ada1"/>
        <stop offset=".35" stopColor="#857f79"/>
        <stop offset=".76" stopColor="#4c5357"/>
        <stop offset="1" stopColor="#303d45"/>
      </linearGradient>
      <linearGradient id="medical-module-left" x1="0" y1="0" x2=".95" y2="1">
        <stop stopColor="#7d7f79"/>
        <stop offset=".4" stopColor="#485a59"/>
        <stop offset="1" stopColor="#203840"/>
      </linearGradient>
      <linearGradient id="medical-module-right" x1="0" y1="0" x2=".85" y2="1">
        <stop stopColor="#445960"/>
        <stop offset=".55" stopColor="#274651"/>
        <stop offset="1" stopColor="#112f3d"/>
      </linearGradient>
      <linearGradient id="medical-module-glass" x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#8cd2c9"/>
        <stop offset=".42" stopColor="#3a7884"/>
        <stop offset="1" stopColor="#103845"/>
      </linearGradient>
      <radialGradient id="medical-module-warm-glow">
        <stop stopColor="#ffce8b" stopOpacity=".64"/>
        <stop offset=".36" stopColor="#e3a56e" stopOpacity=".27"/>
        <stop offset="1" stopColor="#e6aa73" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="medical-module-cold-glow">
        <stop stopColor="#9be7e4" stopOpacity=".26"/>
        <stop offset="1" stopColor="#5ebcbd" stopOpacity="0"/>
      </radialGradient>
    </defs>

    {/* The footprint is ONE authored blocked station. The wide ground glow
        is light only, never an implied additional walkable interior. */}
    <ellipse cx="8" cy="14" rx="57" ry="21"
      fill="#071b24" opacity=".77"/>
    <ellipse cx="20" cy="-14" rx="79" ry="45"
      fill="url(#medical-module-warm-glow)" opacity=".68"/>
    <ellipse cx="-29" cy="-7" rx="50" ry="29"
      fill="url(#medical-module-cold-glow)"/>
    <path d="M0 -24L46 0 0 23 -46 0Z"
      fill="#253d45" stroke="#a8a496" strokeWidth="2"/>
    <path d="M0 -19L38 0 0 18 -38 0Z"
      fill="#41565a" stroke="#d8b57d" strokeWidth="1.6"/>
    <path d="M-37 2L0 20 37 1" fill="none"
      stroke="#182e37" strokeWidth="5"/>
    <path d="M-35 3L-24 8M24 8L34 3" fill="none"
      stroke="#e4bd7c" strokeWidth="2.7"/>

    {/* True volume: two differently lit facades below the pitched roof. */}
    <path d="M-42 -90L0 -68V8L-42 -14Z"
      fill="url(#medical-module-left)"
      stroke="#182e35" strokeWidth="2"/>
    <path d="M0 -68L42 -91V-14L0 8Z"
      fill="url(#medical-module-right)"
      stroke="#122e3a" strokeWidth="2"/>

    {/* Left entrance: recessed triage doors and reinforced frames. */}
    <path d="M-36 -57L-7 -41V-2L-36 -18Z"
      fill="#182d35" stroke="#b8b7a4" strokeWidth="2"/>
    <path d="M-33 -52L-10 -39V-7L-33 -20Z"
      fill="url(#medical-module-glass)"
      stroke="#7cb8b7" strokeWidth="1.2"/>
    <path d="M-21.5 -45V-14M-33 -29L-10 -16"
      fill="none" stroke="#cad3bf" strokeWidth="1.8" opacity=".85"/>
    <path d="M-36 -8L-7 8M-36 -12L-7 4"
      fill="none" stroke="#cfbb8a" strokeWidth="2.4"/>
    <path d="M-39 -67L-4 -48" fill="none"
      stroke="#eac78f" strokeWidth="4"/>
    <path d="M-38 -61L-4 -43" fill="none"
      stroke="#142d37" strokeWidth="3"/>

    {/* Side wall: lit monitoring glazing, opaque structural mullions and
        service hatches rather than a flat teal rectangle. */}
    <path d="M7 -53L36 -69V-38L7 -23Z"
      fill="#0d2e3b" stroke="#91aaa4" strokeWidth="2"/>
    <path d="M11 -52L32 -64V-42L11 -30Z"
      fill="url(#medical-module-glass)"
      stroke="#88ccc3" strokeWidth="1.6"/>
    <path d="M20 -57V-34M10 -41L33 -54" fill="none"
      stroke="#142e3a" strokeWidth="2.3"/>
    <path d="M9 -17L33 -30V-14L9 -2Z"
      fill="#1b3c45" stroke="#708f8d" strokeWidth="1.7"/>
    <path d="M12 -14L29 -23M12 -9L29 -18" fill="none"
      stroke="#75b1ac" strokeWidth="1.4"/>
    <path d="M37 -69V-22M3 -63V0" fill="none"
      stroke="#8b9d94" strokeWidth="3.3"/>
    <path d="M-42 -18L0 5 42 -18" fill="none"
      stroke="#b5a78d" strokeWidth="2.7"/>
    <path d="M-42 -14L0 8 42 -14" fill="none"
      stroke="#152b34" strokeWidth="4"/>

    {/* Weighted sheet-metal and canvas roof, with an original medical cross
        and exposed edge framing. No borrowed franchise imagery. */}
    <path d="M0 -112L42 -91 0 -68 -42 -90Z"
      fill="url(#medical-module-roof)" stroke="#d4c6a6" strokeWidth="2.5"/>
    <path d="M-38 -91L0 -108 37 -91" fill="none"
      stroke="#ece0bd" strokeWidth="1.4" opacity=".72"/>
    <path d="M-32 -83L0 -99 31 -84M-20 -76L0 -86 20 -76"
      fill="none" stroke="#e0d0ad" strokeWidth="1.2" opacity=".55"/>
    <path d="M-39 -90L0 -69 39 -90" fill="none"
      stroke="#172e36" strokeWidth="4"/>
    <path d="M-36 -87L0 -67 37 -87" fill="none"
      stroke="#edc78e" strokeWidth="2"/>
    <path d="M-9 -95L-2 -99 -2 -93 5 -89 10 -92
      10 -86 4 -83 4 -77 -3 -81 -3 -87 -9 -90Z"
      fill="#efe6d2" stroke="#9b554d" strokeWidth="1.2"/>
    <path d="M-3 -93L5 -89M-3 -87L5 -83" fill="none"
      stroke="#c5675d" strokeWidth="2.3"/>

    {/* Mechanical canopy and believable small-scale utilities. */}
    <path d="M-44 -80L-51 -75 -51 -55M-44 -59L-51 -55"
      stroke="#bcc4b0" strokeWidth="3" fill="none"/>
    <path d="M-48 -73L-42 -76M-48 -65L-42 -68"
      stroke="#e6bf81" strokeWidth="1.8"/>
    <path d="M15 -106L18 -116 30 -110 27 -100Z"
      fill="#394c50" stroke="#b5b7a4" strokeWidth="1.6"/>
    <path d="M19 -116L32 -110M15 -109L27 -102" fill="none"
      stroke="#748e91" strokeWidth="2"/>
    <path d="M-2 -107V-125" stroke="#bcc8bb" strokeWidth="2.6"/>
    <path d="M-11 -128L-2 -125 7 -128" fill="none"
      stroke="#e8cf99" strokeWidth="2"/>
    <circle cx="-2" cy="-126" r="2.6" fill="#e9c18a"/>
    <path d="M39 -83L46 -91V-51" stroke="#c5ccbb"
      strokeWidth="2.7" fill="none"/>
    <ellipse cx="46" cy="-49" rx="14" ry="9"
      fill="url(#medical-module-warm-glow)"/>
    <circle cx="46" cy="-49" r="3.2" fill="#ffca88"/>
    <circle cx="37" cy="-18" r="2.5" fill="#76e6db"/>

    {/* A few shared-scale rivets, not a checkerboard repeated on the ground. */}
    {[-29,-16,-3].map((x,i)=>
      <circle key={x} cx={x} cy={-79+(i*6.5)} r="1.25"
        fill="#d2c2a0" opacity=".7"/>)}
    {[12,26,38].map((x,i)=>
      <circle key={x} cx={x} cy={-16-i*7} r="1"
        fill="#a4bfb6" opacity=".58"/>)}
  </g>;
}
