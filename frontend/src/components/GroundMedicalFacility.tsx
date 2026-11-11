// One original, low-profile industrial rescue facility, on the existing
// blocked relief-point (6,4). The parent owns visibility, interaction and
// fog. No decorative opening is an additional real door or walkable cell.
// Geometry is deliberately wider/lower than the former isolated tower so
// the squad, not a square facade, remains the foreground focal point.
export function GroundMedicalFacility(){
 return <g data-testid="ground-medical-facility-volume"
   data-architectural-form="low-profile-modular-relief-clinic"
   data-station-footprint="6,4"
   pointerEvents="none" aria-hidden="true">
  <defs>
   <linearGradient id="relief-pbr-roof" x1="0" y1="0" x2=".55" y2="1">
    <stop stopColor="#a2b0a3"/>
    <stop offset=".42" stopColor="#657f78"/>
    <stop offset="1" stopColor="#334e56"/>
   </linearGradient>
   <linearGradient id="relief-pbr-left" x1="0" y1="0" x2=".9" y2="1">
    <stop stopColor="#7d9185"/>
    <stop offset=".5" stopColor="#4d6b6b"/>
    <stop offset="1" stopColor="#273f47"/>
   </linearGradient>
   <linearGradient id="relief-pbr-right" x1="0" y1="0" x2=".8" y2="1">
    <stop stopColor="#577576"/>
    <stop offset=".6" stopColor="#2e515d"/>
    <stop offset="1" stopColor="#1a3442"/>
   </linearGradient>
   <linearGradient id="relief-pbr-glass" x1="0" y1="0" x2=".8" y2="1">
    <stop stopColor="#a4d5cb"/>
    <stop offset=".50" stopColor="#579aa1"/>
    <stop offset="1" stopColor="#164151"/>
   </linearGradient>
   <radialGradient id="relief-warm-lamp">
    <stop stopColor="#f5cc93" stopOpacity=".52"/>
    <stop offset="1" stopColor="#e3ac71" stopOpacity="0"/>
   </radialGradient>
   <radialGradient id="relief-cold-lamp">
    <stop stopColor="#9fe6df" stopOpacity=".23"/>
    <stop offset="1" stopColor="#77b7b9" stopOpacity="0"/>
   </radialGradient>
  </defs>
  {/* The ground plinth fits the ONE existing station diamond. Its
      decorative shadow and low floor lights are neither pick targets nor
      newly traversable paths. */}
  <ellipse cx="4" cy="12" rx="48" ry="17" fill="#061c26" opacity=".78"/>
  <ellipse cx="26" cy="-19" rx="62" ry="38" fill="url(#relief-warm-lamp)"/>
  <ellipse cx="-29" cy="-7" rx="43" ry="24" fill="url(#relief-cold-lamp)"/>
  <path d="M0 -22 41 -1 0 22 -41 -1Z"
    fill="#233f47" stroke="#a9b5a0" strokeWidth="1.8"/>
  <path d="M0 -17 35 0 0 17 -35 0Z"
    fill="#385c60" stroke="#d3b580" strokeWidth="1.1"/>
  <path d="M-34 -3 0 14 34 -3" fill="none"
    stroke="#c4a571" strokeWidth="2" opacity=".75"/>
  <path d="M-25 6 -14 11M15 11 25 6" fill="none"
    stroke="#84ccc1" strokeWidth="2.1"/>
  {/* Tapered structural shell, not two tall blank box faces. The shoulders
      slope gently into a shared low roof, fitting the nearby south factory. */}
  <path d="M-42 -58 -34 -64 0 -46 0 9 -40 -13Z"
    fill="url(#relief-pbr-left)" stroke="#19343c" strokeWidth="2.1"/>
  <path d="M0 -46 35 -65 42 -58 40 -13 0 9Z"
    fill="url(#relief-pbr-right)" stroke="#142f3a" strokeWidth="2.1"/>
  <path d="M-41 -15 0 7 40 -15" fill="none"
    stroke="#d2b786" strokeWidth="2.3"/>
  <path d="M-40 -12 0 10 39 -12" fill="none"
    stroke="#132d37" strokeWidth="3.4"/>

  {/* Recessed triage airlock and equipment glazing. No illusory door
      opening is introduced in the grid; the actual relief station remains
      the only mission interaction. */}
  <path d="M-34 -46 -9 -32V-3L-34 -17Z"
    fill="#15333d" stroke="#aec0ad" strokeWidth="2.2"/>
  <path d="M-31 -43 -12 -32V-7L-31 -18Z"
    fill="url(#relief-pbr-glass)" stroke="#74c1ba" strokeWidth="1.2"/>
  <path d="M-21.5 -37V-13M-31 -29 -12 -19" fill="none"
    stroke="#d2d9c5" strokeWidth="1.5"/>
  <path d="M-34 -9 -9 5" stroke="#ba9f73" strokeWidth="2.6"/>
  <path d="M-37 -51 -8 -34" stroke="#e3c18a" strokeWidth="2.9"/>

  <path d="M8 -45 33 -59V-35L8 -21Z"
    fill="#153845" stroke="#93b5aa" strokeWidth="1.8"/>
  <path d="M11 -44 30 -54V-37L11 -27Z"
    fill="url(#relief-pbr-glass)"/>
  <path d="M20 -49V-29M10 -35 31 -47" fill="none"
    stroke="#1b3d47" strokeWidth="2"/>
  <path d="M11 -13 32 -24V-10L11 1Z"
    fill="#223f49" stroke="#8aa7a0" strokeWidth="1.6"/>
  <path d="M13 -9 30 -18M13 -5 30 -14" fill="none"
    stroke="#86c7be" strokeWidth="1.2"/>

  {/* The broad canopy changes the *building silhouette*: a single shallow,
      segmented roof with raised back parapet, not the former tall roof box.
      Rounded leading edge and staggered fascia suggest prefabricated relief
      architecture without copying any film or game's art. */}
  <path d="M-45 -63 Q-42 -68 -36 -71L-1 -91
    Q4 -93 10 -89L43 -72Q49 -68 46 -61L4 -40Z"
    fill="url(#relief-pbr-roof)" stroke="#d7ccb0" strokeWidth="2.4"/>
  <path d="M-44 -63Q-39 -67 -35 -69L-1 -87
    Q3 -89 8 -86L42 -70"
    stroke="#e4d7b2" strokeWidth="1.7" fill="none" opacity=".67"/>
  <path d="M-43 -62 4 -38 45 -62"
    stroke="#172f37" strokeWidth="5" fill="none" strokeLinejoin="round"/>
  <path d="M-41 -60 4 -36 43 -60"
    stroke="#e2bb80" strokeWidth="2.7" fill="none"/>
  {/* Long roof standing seams instead of a checkerboard of identical
      roof vents. A service antenna and separate HVAC cluster break symmetry. */}
  <path d="M-32 -68 -3 -83 29 -67M-17 -61 9 -76 37 -63"
    fill="none" stroke="#c6d1bb" strokeWidth="1.45" opacity=".5"/>
  <path d="M-25 -71 10 -53M-7 -83 26 -66"
    fill="none" stroke="#1f3f42" strokeWidth="2.1" opacity=".62"/>
  <path d="M-12 -80 -3 -85 13 -77 4 -72Z"
    fill="#38565a" stroke="#c7c7af" strokeWidth="1.2"/>
  <path d="M-9 -80V-87L1 -92V-85Z"
    fill="#718782" stroke="#284247" strokeWidth=".9"/>
  <path d="M1 -85V-92L15 -84V-77Z"
    fill="#294853" stroke="#294048" strokeWidth=".9"/>
  <path d="M-8 -79 4 -74M-5 -82 7 -77"
    stroke="#d3b788" strokeWidth="1.2"/>
  <path d="M28 -66V-84M24 -82 28 -87 32 -82"
    fill="none" stroke="#cbd5c6" strokeWidth="2.2"/>
  <circle cx="28" cy="-87" r="2.5" fill="#f8d29a"/>

  {/* Med-bay cross is one small original high-contrast roof identifier, not
      floating HUD signage or a trademarked visual design. */}
  <path d="M-9 -64 -4 -67 -1 -63 4 -65 8 -61
    3 -57 5 -53 0 -50 -4 -55 -9 -53 -12 -57 -7 -60Z"
    fill="#e8e4d5" stroke="#825e56" strokeWidth="1.4"/>
  <path d="M-6 -61 2 -57M-5 -56 3 -60"
    stroke="#b56862" strokeWidth="2"/>

  {/* Lateral emergency lamps recessed under real eaves and scaled to the
      same roofline as the new industrial block. */}
  <path d="M-45 -52 -49 -49 -49 -32" fill="none"
    stroke="#b3c5b6" strokeWidth="2.3"/>
  <ellipse cx="-49" cy="-32" rx="15" ry="9" fill="url(#relief-cold-lamp)"/>
  <circle cx="-49" cy="-32" r="2.6" fill="#adede2"/>
  <path d="M40 -53 45 -56V-38" stroke="#bec6b7"
    strokeWidth="2.4" fill="none"/>
  <ellipse cx="45" cy="-38" rx="15" ry="9" fill="url(#relief-warm-lamp)"/>
  <circle cx="45" cy="-38" r="2.7" fill="#f6ca86"/>
  <circle cx="36" cy="-16" r="2.5" fill="#8fe5d9"/>

  {/* Three fasteners and a weathered vertical relief seam at human scale. */}
  {[-35,-23,-11].map((x,i)=><circle key={i}
    cx={x} cy={-56+(i*6)} r="1.35" fill="#d6ccb3" opacity=".73"/>)}
  <path d="M-2 -41V2" fill="none" stroke="#1e3d47"
    strokeWidth="2" opacity=".6"/>
  <title>Puesto de socorro, clínica modular de evacuación</title>
 </g>;
}
