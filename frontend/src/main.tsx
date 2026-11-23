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

// The camera proof is opt-in; it is not an authorization bypass on staging.
const TacticalCameraProbe = React.lazy(() => import('./tactical/TacticalCameraProbe'));
const isCameraProbe = new URLSearchParams(window.location.search).get('tactical') === 'probe';

const node = document.getElementById('root');
if (!node) throw new Error('Cannot mount Star Adventures without #root');
const root = createRoot(node);

function blockedIdentity() {
  root.render(<main role="alert" data-testid="game-identity-blocked"
    style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '35rem', margin: '12vh auto', padding: '2rem', lineHeight: 1.6 }}>
    <h1>ShadowOps ID no ha confirmado tu sesión</h1>
    <p>Para proteger las partidas de otras cuentas, Star Adventures no cargará guardados
      hasta que Identity confirme tu acceso. No se ha borrado ningún progreso local.</p>
    <p><a href="https://id-staging.shadowops.dpdns.org/login?app=staradvs">Entrar con ShadowOps ID</a></p>
    <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
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
    notice.style.cssText = 'font: 16px system-ui; padding: 2rem; color: #d9e5e0;';
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
    if (document.visibilityState === 'hidden' || unfocused) return;
    if (pending) { queued = true; return; }
    pending = true;
    let valid = false;
    try { valid = await revalidateBoundGameStorage(window.location.origin); }
    catch { /* Unexpected verification failures also fail closed. */ }
    pending = false;
    if (stopped) return;
    if (document.visibilityState === 'hidden' || unfocused) {
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
