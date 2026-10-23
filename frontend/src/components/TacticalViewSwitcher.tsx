import { lazy, Suspense, useState } from 'react';
import { TacticalProbe } from './TacticalProbe';
import './isoTacticalLab.css';

// Explicit, reversible opt-in: keep Codex's canonical fixed-camera probe untouched.
// No game/save schema changes; this visual lab owns no tactical rules.
const IsoTacticalLab = lazy(() => import('./IsoTacticalLab').then(x => ({ default: x.IsoTacticalLab })));
const IsoScenarioLab = lazy(() => import('./IsoScenarioLab').then(x => ({ default: x.IsoScenarioLab })));

type TacticalViewMode = 'existing' | 'iso' | 'missions';
const TACTICAL_VIEW_PREFERENCE = 'shadowops.star-adventures.tactical-view.v1';

function initialMode(): TacticalViewMode {
  try {
    const saved = localStorage.getItem(TACTICAL_VIEW_PREFERENCE);
    if (saved === 'existing' || saved === 'iso' || saved === 'missions') return saved;
  } catch {
    // Private browsing/storage denial must still leave the playable mission usable.
  }
  return 'missions';
}


export function TacticalViewSwitcher() {
  // Lead with the complete stateful loop. The other two views remain explicit,
  // reversible inspection tools rather than leaving a new player in a probe.
  const [mode, setMode] = useState<TacticalViewMode>(initialMode);
  const chooseMode = (next: TacticalViewMode) => {
    setMode(next);
    try { localStorage.setItem(TACTICAL_VIEW_PREFERENCE, next); } catch { /* non-persistent fallback */ }
  };
  return <div className="iso-mode-switcher" data-testid="tactical-mode-switcher">
    <div className="iso-mode-title">
      <span>EXPERIMENTO · COMPARAR CÁMARAS</span>
      <div className="iso-mode-tabs" role="group" aria-label="Comparar vistas tácticas">
        <button type="button" aria-pressed={mode === 'existing'} data-testid="tactical-view-current"
          onClick={() => chooseMode('existing')}>Vista actual</button>
        <button type="button" aria-pressed={mode === 'iso'} data-testid="tactical-view-iso"
          onClick={() => chooseMode('iso')}>Laboratorio isométrico</button>
        <button type="button" aria-pressed={mode === 'missions'} data-testid="tactical-view-missions"
          onClick={() => chooseMode('missions')}>Misiones tácticas</button>
      </div>
    </div>
    {mode === 'existing' ? <TacticalProbe /> : <Suspense fallback={<p role="status">Preparando escena táctica…</p>}>
      {mode === 'iso' ? <IsoTacticalLab /> : <IsoScenarioLab />}
    </Suspense>}
  </div>;
}
