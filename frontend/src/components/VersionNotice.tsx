import { useEffect, useState } from 'react';
import './versionNotice.css';

const CHECK_INTERVAL = 60 * 1000;
const CHECK_TIMEOUT = 10 * 1000;

export function VersionNotice() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    let checking = false;
    let activeController: AbortController | null = null;
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT);
      try {
        const url = new URL(`${import.meta.env.BASE_URL}version.json`, location.origin);
        url.searchParams.set('check', String(Date.now()));
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!stopped && data && typeof data === 'object' && 'version' in data &&
            typeof data.version === 'string' && data.version.length > 0 && data.version !== __BUILD_ID__) {
          setAvailableVersion(data.version);
        }
      } catch {
        // Offline play and temporary network errors do not interrupt the game.
      } finally {
        window.clearTimeout(timeout);
        if (activeController === controller) activeController = null;
        checking = false;
      }
    };
    const onResume = () => { if (document.visibilityState === 'visible') void check(); };
    void check();
    const interval = window.setInterval(check, CHECK_INTERVAL);
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('pageshow', onResume);
    return () => {
      stopped = true; activeController?.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('pageshow', onResume);
    };
  }, []);
  if (!availableVersion || dismissedVersion === availableVersion) return null;
  return <aside className="version-notice" role="status" data-testid="version-notice">
    <div><strong>Nueva versión disponible</strong><p>Recarga cuando termines tu acción actual para actualizar el juego.</p></div>
    <div className="version-notice-actions"><button type="button" onClick={() => location.reload()}>Recargar</button>
      <button type="button" className="version-notice-later" onClick={() => setDismissedVersion(availableVersion)}>Más tarde</button></div>
  </aside>;
}
