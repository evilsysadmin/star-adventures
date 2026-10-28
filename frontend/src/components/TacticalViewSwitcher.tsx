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

// First-time players should see the bridge, story and real rescue controls,
// not a second full-size technical viewport. Existing opt-in lab users retain
// their view; this is derived from the old preference, not a new save key.
function initiallyExpanded(): boolean {
  try {
    const saved = localStorage.getItem(TACTICAL_VIEW_PREFERENCE);
    return saved === 'existing' || saved === 'iso' || saved === 'missions';
  } catch {
    return false;
  }
}


export function TacticalViewSwitcher() {
  // Lead with the complete stateful loop. The other two views remain explicit,
  // reversible inspection tools rather than leaving a new player in a probe.
  const [mode, setMode] = useState<TacticalViewMode>(initialMode);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const chooseMode = (next: TacticalViewMode) => {
    setMode(next);
    try { localStorage.setItem(TACTICAL_VIEW_PREFERENCE, next); } catch { /* non-persistent fallback */ }
  };
  return <section className={`iso-mode-switcher ${expanded ? 'is-expanded' : 'is-collapsed'}`}
    data-testid="tactical-mode-switcher" aria-label="Escenario táctico opcional">
    <div className="iso-mode-entry">
      <div className="iso-mode-entry-copy">
        <strong>ENCUENTRO TÁCTICO · OPCIONAL</strong>
        <span>Un escenario de combate independiente. La misión de rescate continúa en el puente.</span>
      </div>
      <button type="button" className="iso-mode-entry-toggle" data-testid="tactical-lab-toggle"
        aria-expanded={expanded} aria-controls="tactical-lab-content"
        onClick={() => setExpanded(open => !open)}>
        {expanded ? 'Cerrar escenario ↑' : 'Explorar combate táctico ↗'}
      </button>
    </div>
    {expanded && <div id="tactical-lab-content" data-testid="tactical-lab-content">
      <div className="iso-mode-title">
        <span>VISTAS DEL ESCENARIO</span>
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
    </div>}
  </section>;
}
