import { useEffect, useState } from 'react';
import assets from '../assets/r2-assets-manifest.json';
import { WALK_ATLAS, walkFrameAt } from '../tacticalAnimation';

// Reuses exactly the same two immutable atlas URLs and the canonical UV frame
// schedule as the live 3D board. No derived/binary artwork is committed to Git.
const pairs = [
  { id:'female', title:'Oficial · atlas femenino',
    url:assets.assets['starAdventures.tactical.officerFemaleWalkV1'].url },
  { id:'male', title:'Oficial · atlas masculino',
    url:assets.assets['starAdventures.tactical.officerMaleWalkV1'].url },
] as const;

export function IsoAtlasMagnifier({ playing }: { playing: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrame(0);
      return;
    }
    let handle = 0;
    let previous = -1;
    const tick = (now: number) => {
      const next = walkFrameAt(now);
      if (next !== previous) { previous = next; setFrame(next); }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing]);
  const column = frame % WALK_ATLAS.columns;
  const row = Math.floor(frame / WALK_ATLAS.columns);
  const backgroundPosition = `${column * 100 / (WALK_ATLAS.columns - 1)}% ${row * 100 / (WALK_ATLAS.rows - 1)}%`;
  return <div className="iso-atlas-inspector" data-testid="iso-atlas-inspector">
    <p>Vista ampliada de los mismos atlas WebP originales del tablero. Son 6 fotogramas de caminata a 6 FPS, no animaciones inventadas de disparo ni impactos.</p>
    <div className="iso-atlas-pair">
      {pairs.map(asset => <figure key={asset.id} className="iso-atlas-card">
        <div className="iso-atlas-frame" role="img" aria-label={asset.title}
          data-testid={`iso-atlas-preview-${asset.id}`}
          style={{ backgroundImage: `url("${asset.url}")`,
            backgroundSize: `${WALK_ATLAS.columns * 100}% ${WALK_ATLAS.rows * 100}%`,
            backgroundPosition }} />
        <figcaption>
          <strong>{asset.title}</strong>
          <span data-testid={`iso-atlas-frame-${asset.id}`}>Fotograma {frame + 1}/6 · R2</span>
        </figcaption>
      </figure>)}
    </div>
    <p className="iso-atlas-inspector-note">Este visor permite valorar silueta, recorte, proporciones y coherencia de estilo antes de integrar los demás ciclos.</p>
  </div>;
}
