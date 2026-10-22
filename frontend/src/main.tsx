import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Camera proof is isolated behind an explicit URL, not a gameplay feature.
const TacticalCameraProbe = React.lazy(() => import('./tactical/TacticalCameraProbe'));
const isCameraProbe = new URLSearchParams(window.location.search).get('tactical') === 'probe';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Cannot mount Star Adventures without #root');

createRoot(root).render(
  <React.StrictMode>
    {isCameraProbe ? <React.Suspense fallback={<p>Iniciando prueba táctica…</p>}><TacticalCameraProbe /></React.Suspense> : <App />}
  </React.StrictMode>,
);
