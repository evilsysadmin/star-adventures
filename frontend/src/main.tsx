import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './components/isoScenarioPlay.css';

// The camera proof is an opt-in diagnostic route, not a replacement for the playable mission.
const TacticalCameraProbe = React.lazy(() => import('./tactical/TacticalCameraProbe'));
const isCameraProbe = new URLSearchParams(window.location.search).get('tactical') === 'probe';

const root = document.getElementById('root');
if (!root) throw new Error('Cannot mount Star Adventures without #root');

createRoot(root).render(
  <React.StrictMode>
    {isCameraProbe
      ? <React.Suspense fallback={<p>Iniciando prueba táctica…</p>}><TacticalCameraProbe /></React.Suspense>
      : <App />}
  </React.StrictMode>,
);
