import { useEffect, useState } from 'react';
import './versionNotice.css';

const CHECK_INTERVAL = 5 * 60 * 1000;

export function VersionNotice() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let stopped = false;
    let checking = false;
    const controller = new AbortController();
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const url = new URL(`${import.meta.env.BASE_URL}version.json`, location.origin);
        url.searchParams.set('check', String(Date.now()));
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!stopped && data && typeof data === 'object' && 'version' in data &&
            typeof data.version === 'string' && data.version.length > 0 && data.version !== __BUILD_ID__) {
          setAvailable(true);
        }
      } catch {
        // Offline play and temporary network errors do not interrupt the game.
      } finally { checking = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    void check();
    const interval = window.setInterval(check, CHECK_INTERVAL);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true; controller.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  if (!available || dismissed) return null;
  return <aside className="version-notice" role="status" data-testid="version-notice">
    <div><strong>Nueva versión disponible</strong><p>Recarga cuando termines tu acción actual para actualizar el juego.</p></div>
    <div className="version-notice-actions"><button type="button" onClick={() => location.reload()}>Recargar</button>
      <button type="button" className="version-notice-later" onClick={() => setDismissed(true)}>Más tarde</button></div>
  </aside>;
}
