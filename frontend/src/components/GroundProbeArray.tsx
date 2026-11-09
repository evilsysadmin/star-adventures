// The original authored scientific probe is a single blocked station.
// This richer dish array is only its decorative skin. The parent station
// controls discovery, fog and the actual science interaction.
export function GroundProbeArray(){
  return <g data-testid="ground-probe-array" aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id="probe-array-steel" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#c5c0aa"/>
        <stop offset=".32" stopColor="#81918b"/>
        <stop offset=".72" stopColor="#425c62"/>
        <stop offset="1" stopColor="#203945"/>
      </linearGradient>
      <linearGradient id="probe-array-dark" x1="0" y1="0" x2=".85" y2="1">
        <stop stopColor="#698582"/>
        <stop offset=".45" stopColor="#284a53"/>
        <stop offset="1" stopColor="#132f3b"/>
      </linearGradient>
      <linearGradient id="probe-array-dish" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#d4cfbc"/>
        <stop offset=".38" stopColor="#8da8a7"/>
        <stop offset=".72" stopColor="#4c777d"/>
        <stop offset="1" stopColor="#274c59"/>
      </linearGradient>
      <radialGradient id="probe-array-warm-light">
        <stop stopColor="#ffdb9d" stopOpacity=".45"/>
        <stop offset=".4" stopColor="#ffc786" stopOpacity=".14"/>
        <stop offset="1" stopColor="#e7b77e" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="probe-array-signal">
        <stop stopColor="#a2e8e3" stopOpacity=".3"/>
        <stop offset="1" stopColor="#a2e8e3" stopOpacity="0"/>
      </radialGradient>
    </defs>
    {/* One station footprint. Ground shadow and light are decorative only. */}
    <ellipse cx="9" cy="14" rx="49" ry="18" fill="#081d27" opacity=".78"/>
    <ellipse cx="26" cy="-1" rx="60" ry="35" fill="url(#probe-array-warm-light)"/>
    <path d="M0 -20L38 -2 0 19 -38 -2Z"
      fill="#182f38" stroke="#d1bf95" strokeWidth="2.5"/>
    <path d="M0 -15L30 -2 0 12 -30 -2Z"
      fill="#3a5559" stroke="#8dadac" strokeWidth="1.8"/>
    <path d="M-36 -2L0 16 36 -2V8L0 25 -36 8Z"
      fill="#263c47" stroke="#182e37" strokeWidth="2"/>
    <path d="M0 16V25L36 8" fill="none" stroke="#829695" strokeWidth="2"/>
    <path d="M-30 -1L-18 5M18 5L30 -1" stroke="#e9c789" strokeWidth="3.2"/>
    {/* Service consoles and illuminated lower equipment compartment. */}
    <path d="M-28 -15L-9 -25 6 -17 -13 -6Z"
      fill="url(#probe-array-steel)" stroke="#20323a" strokeWidth="1.5"/>
    <path d="M-26 -12L-13 -19 -3 -14 -16 -8Z"
      fill="#123d4b" stroke="#80c9c8" strokeWidth="1.4"/>
    <path d="M-25 -12L-14 -8" stroke="#83c7bc" strokeWidth="1.2"/>
    <circle cx="-18" cy="-14" r="1.7" fill="#a5f3d7"/>
    <path d="M13 -20L27 -13V0L13 -7Z"
      fill="#25424a" stroke="#a8b5aa" strokeWidth="1.5"/>
    <path d="M16 -14L24 -10M16 -10L24 -6"
      fill="none" stroke="#85c5bd" strokeWidth="1.5"/>
    <circle cx="25" cy="-2" r="2.4" fill="#f7cb88"/>
    {/* Mast and diagonal braces make the instrument feel structural. */}
    <path d="M-9 -19L-5 -83 5 -88 9 -19Z"
      fill="url(#probe-array-dark)" stroke="#b4c5b5" strokeWidth="2.5"/>
    <path d="M-9 -20L5 -88M9 -20L-5 -83M-7 -46H7M-6 -68H6"
      fill="none" stroke="#b2c3b6" strokeWidth="2.2"/>
    <path d="M-19 -17L-4 -59 18 -18M-10 -23L-4 -44 9 -23"
      fill="none" stroke="#57787a" strokeWidth="3.5"/>
    <path d="M-4 -83L6 -92" fill="none"
      stroke="#e2d1aa" strokeWidth="4.2"/>
    <circle cx="5" cy="-91" r="5" fill="#3f626a" stroke="#c0c5b3" strokeWidth="2"/>
    {/* Parabolic receiver: a ribbed, angled dish with thick elliptical rim,
        visible depth and a cantilevered feed horn instead of a flat icon. */}
    <g transform="translate(10 -103) rotate(-24)">
      <ellipse cx="2" cy="6" rx="35" ry="16" fill="#122b37" opacity=".68"/>
      <path d="M-36 0Q0 35 36 0Q0 -15 -36 0Z"
        fill="url(#probe-array-dish)" stroke="#d7d4c0" strokeWidth="2.8"/>
      <path d="M-32 0Q0 25 32 0"
        fill="none" stroke="#4e7780" strokeWidth="3"/>
      <path d="M-29 1Q0 18 29 1" fill="none"
        stroke="#a8d1c6" strokeWidth="1.6"/>
      <path d="M-35 0Q0 -13 35 0"
        fill="none" stroke="#edf0de" strokeWidth="2.4"/>
      <path d="M-25 -3Q0 9 25 -3M-13 -8Q0 8 13 -8"
        fill="none" stroke="#c9d5c3" strokeWidth="1.1" opacity=".8"/>
      <path d="M-29 -3L0 18 29 -3M-17 -9L0 18 17 -9"
        stroke="#577c80" strokeWidth="1.4" fill="none" opacity=".8"/>
      <path d="M0 18L2 -15 8 -27M-18 -5L8 -27M20 -4L8 -27"
        stroke="#bfc8b7" strokeWidth="1.8" fill="none"/>
      <path d="M3 -25L16 -30 20 -26 8 -21Z" fill="#c5ccba" stroke="#5f7c7f" strokeWidth="1.3"/>
      <circle cx="8" cy="-26" r="4.3" fill="#a4eee4" stroke="#d4ecd8" strokeWidth="1.5"/>
    </g>
    <ellipse cx="16" cy="-118" rx="32" ry="21"
      fill="url(#probe-array-signal)" opacity=".68"/>
    {/* Two independent warning lights, no invented interaction hotspots. */}
    <path d="M-28 -21V-43M-28 -43L-33 -47" fill="none"
      stroke="#8bada7" strokeWidth="2.2"/>
    <circle cx="-33" cy="-47" r="3.6" fill="#f7c68a"/>
    <path d="M28 -10V-33" stroke="#9db2ad" strokeWidth="2.3"/>
    <circle cx="28" cy="-35" r="2.6" fill="#9be9e1"/>
    <path d="M-34 9L-20 17M20 17L34 9"
      fill="none" stroke="#192d36" strokeWidth="4"/>
  </g>;
}
