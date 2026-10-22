import { lazy, Suspense, useState } from 'react';
import { TacticalProbe } from './TacticalProbe';
import './isoTacticalLab.css';

// Explicit, reversible opt-in: keep Codex's canonical fixed-camera probe untouched.
// No game/save schema changes; this visual lab owns no tactical rules.
const IsoTacticalLab = lazy(() => import('./IsoTacticalLab').then(x => ({ default: x.IsoTacticalLab })));

export function TacticalViewSwitcher() {
  const [mode, setMode] = useState<'existing' | 'iso'>('existing');
  return <div className="iso-mode-switcher" data-testid="tactical-mode-switcher">
    <div className="iso-mode-title">
      <span>EXPERIMENTO · COMPARAR CÁMARAS</span>
      <div className="iso-mode-tabs" role="group" aria-label="Comparar vistas tácticas">
        <button type="button" aria-pressed={mode === 'existing'} data-testid="tactical-view-current"
          onClick={() => setMode('existing')}>Vista actual</button>
        <button type="button" aria-pressed={mode === 'iso'} data-testid="tactical-view-iso"
          onClick={() => setMode('iso')}>Laboratorio isométrico</button>
      </div>
    </div>
    {mode === 'existing' ? <TacticalProbe /> : <Suspense fallback={<p role="status">Preparando laboratorio isométrico…</p>}>
      <IsoTacticalLab />
    </Suspense>}
  </div>;
}
