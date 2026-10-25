import { useState } from 'react';
import { readCombatBridgeDebrief, type BridgeCombatDebrief } from '../isoScenarioCombatBridgeDebrief';
import { localStorageOrNull } from '../session';

const statusText: Record<string, string> = {
  active: 'Encuentro en curso',
  'threats-neutralized': 'Amenazas neutralizadas · extracción pendiente',
  'mission-extracted': 'Extracción confirmada · simulación completada',
  'squad-incapacitated': 'Escuadra incapacitada · encuentro terminado',
};

const officerNames = {
  science: 'Ciencia',
  security: 'Seguridad',
  medic: 'Medicina',
} as const;

/**
 * A deliberately read-only bridge console for the separate v4 tactical sandbox.
 * Re-read on every opening: the tactical board may have saved new orders since
 * this panel was last inspected, without needing to couple the two UIs.
 */
export function BridgeCombatReport() {
  const [debrief, setDebrief] = useState<BridgeCombatDebrief | null>(null);
  const report = debrief?.report;
  const objectives = report ? [
    report.objectives.scanned && 'Investigación',
    report.objectives.operated && 'Terminal',
    report.objectives.rescued && 'Rescate',
    report.objectives.extracted && 'Extracción',
  ].filter(Boolean).join(' · ') : '';

  return (
    <details className="bridge-combat-report" data-testid="bridge-combat-report"
      onToggle={event => {
        if (event.currentTarget.open) setDebrief(readCombatBridgeDebrief(localStorageOrNull()));
      }}>
      <summary>
        <span>INFORME TÁCTICO · EXPERIMENTAL</span>
        <span className="bridge-combat-action">Consultar ▾</span>
      </summary>
      <div className="bridge-combat-body" data-testid="bridge-combat-body" aria-live="polite">
        {!debrief ? <p>Consultando el historial táctico…</p>
          : !report ? <p data-testid="bridge-combat-unavailable">
            {debrief.status === 'missing'
              ? 'Todavía no hay un combate v4 guardado.'
              : debrief.status === 'incompatible'
                ? 'El historial v4 es incompatible o está dañado. No se ha modificado.'
                : 'No se puede consultar el historial v4 en este navegador.'}
          </p> : <>
            <strong data-testid="bridge-combat-status">{statusText[debrief.status]}</strong>
            <p className="bridge-combat-scenario">{report.label} · Ronda {report.round}</p>
            <div className="bridge-combat-metrics" data-testid="bridge-combat-metrics">
              <span>{report.orders} órdenes</span>
              <span>{report.shots} disparos</span>
              <span>{report.hostilesNeutralized} amenazas neutralizadas</span>
              <span>{report.wounds} PV de daño recibido</span>
            </div>
            <p data-testid="bridge-combat-objectives">Objetivos acreditados: {objectives || 'ninguno todavía'}</p>
            <div className="bridge-combat-health" data-testid="bridge-combat-health">
              {Object.entries(officerNames).map(([id, name]) =>
                <span key={id}>{name}: {report.officerHealth[id as keyof typeof officerNames]} PV</span>)}
            </div>
          </>}
        <p className="bridge-combat-scope" data-testid="bridge-combat-scope">Informe reconstruido del combate experimental v4.
          No concede recompensas ni modifica la campaña principal.</p>
      </div>
    </details>
  );
}
