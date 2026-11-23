import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { VersionNotice } from './components/VersionNotice';
import { bindGameStorageScope, resolveGameStorageScope } from './identityStorage';
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
})();
