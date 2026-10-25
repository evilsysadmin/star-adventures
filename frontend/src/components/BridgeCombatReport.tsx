import { useState } from 'react';
import { readCombatBridgeDebrief, type BridgeCombatDebrief } from '../isoScenarioCombatBridgeDebrief';
import {
  readCombatExtractionLedger, recordCombatExtractionInLedger,
  type ExtractionLedgerRead, type ExtractionLedgerWrite,
} from '../isoScenarioCombatExtractionLedger';
import { localStorageOrNull } from '../session';

const statusText: Record<string, string> = {
  active: 'Encuentro en curso',
  'threats-neutralized': 'Amenazas neutralizadas · extracción pendiente',
  'mission-extracted': 'Extracción confirmada · simulación completada',
  'squad-incapacitated': 'Escuadra incapacitada · encuentro terminado',
};

const ledgerText: Record<ExtractionLedgerWrite['status'], string> = {
  recorded: 'Extracción añadida al historial verificado. Sin recompensas de campaña.',
  'already-recorded': 'Esta extracción ya estaba registrada. No se ha duplicado.',
  'not-extracted': 'El historial actual no acredita una extracción. No se ha registrado.',
  full: 'El historial está lleno. No se han eliminado extracciones anteriores.',
  incompatible: 'Historial o registro incompatible. No se ha modificado.',
  unavailable: 'No se ha podido guardar el historial. Comprueba el almacenamiento local.',
};

const officerNames = {
  science: 'Ciencia',
  security: 'Seguridad',
  medic: 'Medicina',
} as const;

/**
 * A bridge console for the separate v4 tactical sandbox. Reading the report is
 * side-effect-free; only the explicit button may persist an extraction receipt.
 * Re-read on every opening: the tactical board may have saved new orders since
 * this panel was last inspected, without needing to couple the two UIs.
 */
export function BridgeCombatReport() {
  const [debrief, setDebrief] = useState<BridgeCombatDebrief | null>(null);
  const [ledger, setLedger] = useState<ExtractionLedgerRead | null>(null);
  const [ledgerWrite, setLedgerWrite] = useState<ExtractionLedgerWrite | null>(null);
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
        if (event.currentTarget.open) {
          setDebrief(readCombatBridgeDebrief(localStorageOrNull()));
          setLedger(readCombatExtractionLedger(localStorageOrNull()));
          setLedgerWrite(null);
        }
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
            {debrief.status === 'mission-extracted' && (
              <div className="bridge-combat-receipt">
                <button type="button" data-testid="bridge-combat-record-extraction"
                  disabled={ledgerWrite?.status === 'recorded' || ledgerWrite?.status === 'already-recorded'}
                  onClick={() => {
                    const storage = localStorageOrNull();
                    setLedgerWrite(recordCombatExtractionInLedger(storage));
                    setLedger(readCombatExtractionLedger(storage));
                  }}>
                  Añadir extracción al historial
                </button>
                {ledgerWrite && <p role="status" data-testid="bridge-combat-receipt-status">
                  {ledgerText[ledgerWrite.status]}
                </p>}
              </div>
            )}
          </>}
        {ledger && <details className="bridge-combat-ledger" data-testid="bridge-combat-ledger">
          <summary data-testid="bridge-combat-ledger-summary">
            Historial verificado · {ledger.status === 'ready' ? ledger.entries.length : 0} extracciones ▾
          </summary>
          {ledger.status === 'incompatible'
            ? <p data-testid="bridge-combat-ledger-error">Historial incompatible. No se ha modificado.</p>
            : ledger.status === 'unavailable'
              ? <p data-testid="bridge-combat-ledger-error">No se puede leer el almacenamiento local.</p>
              : ledger.entries.length === 0
                ? <p>Todavía no hay extracciones registradas.</p>
                : <ol data-testid="bridge-combat-ledger-entries">
                  {ledger.entries.map((entry, index) => <li key={entry.checkpoint}>
                    <span>#{index + 1} · {entry.report.label}</span>
                    <span>{entry.report.round} rondas · {entry.report.orders} órdenes · {entry.report.wounds} PV de daño</span>
                  </li>)}
                </ol>}
        </details>}
        <p className="bridge-combat-scope" data-testid="bridge-combat-scope">Informe reconstruido del combate experimental v4.
          Las órdenes idénticas cuentan como una única evidencia. No concede recompensas ni modifica la campaña principal.</p>
      </div>
    </details>
  );
}
