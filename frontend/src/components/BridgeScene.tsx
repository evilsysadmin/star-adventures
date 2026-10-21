const stars = [
  [29, 17, 1], [64, 9, .6], [122, 36, 1.5], [193, 15, .8], [258, 47, .7],
  [326, 19, 1.2], [382, 44, .6], [446, 12, 1.4], [501, 34, .7], [559, 14, 1],
  [42, 98, .6], [98, 131, 1], [165, 89, .7], [223, 109, 1.1], [308, 88, .8],
  [369, 120, 1], [438, 94, .6], [519, 127, 1.3], [584, 94, .7], [560, 176, .9],
  [45, 211, 1.1], [115, 185, .6], [192, 217, .8], [258, 173, 1.2], [338, 224, .6],
  [414, 193, 1], [493, 232, .7], [560, 248, .8], [88, 269, .9], [280, 279, 1],
];

type BridgeSceneProps = { alert: boolean; terminal: boolean };

export function BridgeScene({ alert, terminal }: BridgeSceneProps) {
  return (
    <section className="bridge-scene" aria-label="Representación esquemática del sector disputado">
      <div className="scene-header">
        <div className="micro-heading"><span className="light-point" /> ENLACE TÁCTICO / SECTOR 07</div>
        <span className="scene-mode">MAPA ESQUEMÁTICO</span>
      </div>
      <svg className="sector-visual" viewBox="0 0 600 292" role="img" aria-label="Una nave de exploración y una señal de socorro dentro de un sector estelar">
        <defs>
          <radialGradient id="nebula"><stop offset="0" stopColor="#173654" stopOpacity=".48" /><stop offset="1" stopColor="#101824" stopOpacity="0" /></radialGradient>
          <linearGradient id="hull" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d4e5ef" /><stop offset=".52" stopColor="#8daebe" /><stop offset="1" stopColor="#435d75" /></linearGradient>
          <filter id="light"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <ellipse cx="330" cy="145" rx="260" ry="170" fill="url(#nebula)" />
        {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#d8ecf5" opacity={i % 4 === 0 ? .8 : .4} />)}
        <g fill="none" stroke="#56819b" strokeWidth=".75" opacity=".3">
          <circle cx="288" cy="152" r="74" strokeDasharray="2 6" />
          <circle cx="288" cy="152" r="117" strokeDasharray="3 8" />
          <path d="M0 152H600 M288 0V292" strokeDasharray="4 8" />
          <path d="M88 260L493 38 M77 41L521 260" opacity=".15" />
        </g>
        <path d="M288 152L460 96" stroke="#70b4b3" opacity=".4" strokeDasharray="6 7" />
        <g transform="translate(276 141) rotate(-17)">
          <ellipse rx="38" ry="17" fill="#2e6675" opacity=".7" filter="url(#light)" />
          <path d="M-48 0L-17 -10L-8 -39L0 -45L9 -11L43 0L9 11L0 43L-9 11L-17 10Z" fill="url(#hull)" stroke="#b6d2d5" strokeWidth="1.4" />
          <path d="M-42 0H39M0 -34V32" stroke="#496879" strokeWidth="3" />
          <path d="M-24 -6L-7 -6L-2 -17L3 -6L19 -6L3 7L-4 7Z" fill="#91ded1" opacity=".8" />
          <ellipse cx="0" cy="0" rx="6" ry="5" fill="#e4f9ff" />
        </g>
        <g transform="translate(463 94)">
          <circle r="27" fill={alert ? '#f29b64' : '#a9d2d7'} opacity=".1" />
          <circle r="21" fill="none" stroke={alert ? '#f7a474' : '#83b8c1'} strokeWidth="1" strokeDasharray="4 4" />
          <circle className="signal-pulse" r="9" fill="none" stroke="#f9b48b" opacity=".6" />
          <path d="M-6 -7L8 0L-6 7Z" fill="#f5b48c" />
          <circle r="3" fill="#f9e2c6" />
        </g>
        <g fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing="1.5">
          <text x="222" y="208" fill="#c7e5ec">TU NAVE</text>
          <text x="472" y="139" fill="#f4b88f">SEÑAL SOS</text>
          <text x="22" y="25" fill="#7095aa">07.18 / 4481</text>
          <text x="437" y="274" fill="#7095aa">SENSORES ONLINE</text>
        </g>
      </svg>
      <div className="scene-footer">
        <span><span className="readout-dot" /> PROPULSIÓN DISPONIBLE</span>
        <span>{terminal ? 'EPISODIO CONCLUIDO' : 'ESPERANDO ÓRDENES'}</span>
      </div>
    </section>
  );
}
