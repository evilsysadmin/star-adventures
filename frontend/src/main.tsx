import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { VersionNotice } from './components/VersionNotice';
import {
  bindGameStorageScope, pauseBoundGameStorage, revalidateBoundGameStorage,
  revokeBoundGameStorage, resolveGameStorageScope,
} from './identityStorage';
import './styles.css';
import './components/isoScenarioPlay.css';
import './bridge/bridgePresentation.css';
import './identityGate.css';

// The camera proof is opt-in; it is not an authorization bypass on staging.
const TacticalCameraProbe = React.lazy(() => import('./tactical/TacticalCameraProbe'));
const isCameraProbe = new URLSearchParams(window.location.search).get('tactical') === 'probe';

const mountNode = document.getElementById('root');
if (!mountNode) throw new Error('Cannot mount Star Adventures without #root');
const node: HTMLElement = mountNode;
const root = createRoot(node);

function blockedIdentity() {
  root.render(<main className="identity-gate-screen" role="alert" data-testid="game-identity-blocked">
    <section className="identity-gate-panel" aria-labelledby="identity-gate-title">
      <div className="identity-gate-mark" aria-hidden="true">✧</div>
      <p className="identity-gate-eyebrow">SHADOWOPS ID <span aria-hidden="true">·</span> STAR ADVENTURES</p>
      <h1 id="identity-gate-title">Tu sesión necesita verificarse.</h1>
      <p className="identity-gate-description">
        No podemos confirmar tu acceso a Star Adventures. Para proteger las
        partidas de otras cuentas, el juego permanece bloqueado.
      </p>
      <div className="identity-gate-actions">
        <a className="identity-gate-primary" href="https://id-staging.shadowops.dpdns.org/login?app=staradvs">
          Entrar con ShadowOps ID
        </a>
        <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
      <p className="identity-gate-footnote">Tu progreso local no se ha borrado.</p>
    </section>
  </main>);
}

// A tab left open while another tab changes account must never continue
// reading/writing its previous owner's checkpoints. Foreground transitions
// suspend the lease BEFORE the first asynchronous network request.
function monitorProtectedSession() {
  let pending = false;
  let queued = false;
  let stopped = false;
  let unfocused = false;
  let interval = 0;
  let notice: HTMLParagraphElement | null = null;

  const mask = () => {
    node.inert = true;
    node.style.visibility = 'hidden';
    if (notice) return;
    notice = document.createElement('p');
    notice.dataset.testid = 'game-identity-rechecking';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Comprobando de nuevo tu cuenta ShadowOps ID…';
    notice.className = 'identity-gate-rechecking';
    node.insertAdjacentElement('afterend', notice);
  };
  const unmask = () => {
    notice?.remove();
    notice = null;
    node.inert = false;
    node.style.visibility = '';
  };
  const stop = () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
  const deny = () => {
    revokeBoundGameStorage();
    stop();
    unmask();
    blockedIdentity();
  };
  const check = async (blocking: boolean) => {
    if (stopped) return;
    if (blocking) { pauseBoundGameStorage(); mask(); }
    if (document.hidden || unfocused) return;
    if (pending) { queued = true; return; }
    pending = true;
    let valid = false;
    try { valid = await revalidateBoundGameStorage(window.location.origin); }
    catch { /* Unexpected verification failures also fail closed. */ }
    pending = false;
    if (stopped) return;
    if (document.hidden || unfocused) {
      pauseBoundGameStorage();
      return;
    }
    // A visibility/focus transition superseded this in-flight response.
    if (queued) { queued = false; void check(true); return; }
    if (!valid) { deny(); return; }
    unmask();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      pauseBoundGameStorage(); mask();
    } else void check(true);
  };
  const onBlur = () => { unfocused = true; pauseBoundGameStorage(); mask(); };
  const onFocus = () => { unfocused = false; if (document.visibilityState === 'visible') void check(true); };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  // A continuously foreground tab also checks freshness. Hidden-tab timers
  // are not trusted; returning to visibility always runs a new check.
  interval = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !unfocused) void check(false);
  }, 25_000);
}

root.render(<p role="status" style={{ fontFamily: 'system-ui', padding: '2rem' }}>
  Comprobando acceso a Star Adventures…
</p>);

// Nothing that can read or write a checkpoint mounts before this decision.
// On public/local development origins, existing unprefixed offline saves keep
// working. On protected staging the SSO subject is the only save namespace.
void (async () => {
  const scope = await resolveGameStorageScope(window.location.origin);
  if (scope.mode === 'blocked' || !bindGameStorageScope(scope)) {
    blockedIdentity();
    return;
  }
  root.render(
    <React.StrictMode>
      {isCameraProbe
        ? <React.Suspense fallback={<p>Iniciando prueba táctica…</p>}><TacticalCameraProbe /></React.Suspense>
        : <><App /><VersionNotice /></>}
    </React.StrictMode>,
  );
  if (scope.mode === 'account') monitorProtectedSession();
})();
