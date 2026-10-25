import { useState } from 'react';
import { readCombatBridgeDebrief, type BridgeCombatDebrief } from '../isoScenarioCombatBridgeDebrief';
import {
  readCombatExtractionLedger, recordCombatExtractionInLedger,
  type ExtractionLedgerRead, type ExtractionLedgerWrite,
} from '../isoScenarioCombatExtractionLedger';
import {
  readCombatExtractionAttemptLedger, recordCombatExtractionAttempt,
  type ExtractionAttemptRead, type ExtractionAttemptWrite,
} from '../isoScenarioCombatExtractionAttemptLedger';
import {
  readCombatMissionInstanceSession, type MissionInstanceRead,
} from '../isoScenarioCombatMissionInstanceSession';
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

const attemptText: Record<ExtractionAttemptWrite['status'], string> = {
  recorded: 'Misión identificada añadida al historial verificado. Sin recompensas de campaña.',
  'already-recorded': 'Esta misión ya estaba registrada. No se ha duplicado.',
  'not-extracted': 'No hay extracción acreditada para esta misión.',
  untracked: 'Esta misión no tiene identidad persistente. No se ha registrado.',
  'out-of-sync': 'La identidad y el combate guardado no coinciden. No se ha registrado.',
  conflict: 'Esta identidad ya tiene otros resultados o el historial ha cambiado. No se ha sobrescrito.',
  full: 'Historial de misiones lleno. No se ha eliminado ningún registro.',
  incompatible: 'La misión o el historial identificado es incompatible. No se ha modificado.',
  unavailable: 'No se ha podido guardar la misión. Comprueba el almacenamiento local.',
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
  const [attemptLedger, setAttemptLedger] = useState<ExtractionAttemptRead | null>(null);
  const [attemptWrite, setAttemptWrite] = useState<ExtractionAttemptWrite | null>(null);
  const [identity, setIdentity] = useState<MissionInstanceRead | null>(null);
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
        // Nested history disclosure must not reset the outer report state.
        if (event.target !== event.currentTarget) return;
        if (event.currentTarget.open) {
          const storage = localStorageOrNull();
          setDebrief(readCombatBridgeDebrief(storage));
          setLedger(readCombatExtractionLedger(storage));
          setAttemptLedger(readCombatExtractionAttemptLedger(storage));
          setIdentity(readCombatMissionInstanceSession(storage));
          setLedgerWrite(null);
          setAttemptWrite(null);
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
                {identity?.status === 'ready' ? <>
                  <button type="button" data-testid="bridge-combat-record-attempt"
                    disabled={attemptWrite?.status === 'recorded' || attemptWrite?.status === 'already-recorded'}
                    onClick={() => {
                      const storage = localStorageOrNull();
                      setAttemptWrite(recordCombatExtractionAttempt(storage));
                      setAttemptLedger(readCombatExtractionAttemptLedger(storage));
                    }}>
                    Registrar misión identificada
                  </button>
                  {attemptWrite && <p role="status" data-testid="bridge-combat-attempt-status">
                    {attemptText[attemptWrite.status]}
                  </p>}
                </> : identity?.status === 'missing' ? <>
                  <button type="button" data-testid="bridge-combat-record-extraction"
                    disabled={ledgerWrite?.status === 'recorded' || ledgerWrite?.status === 'already-recorded'}
                    onClick={() => {
                      const storage = localStorageOrNull();
                      setLedgerWrite(recordCombatExtractionInLedger(storage));
                      setLedger(readCombatExtractionLedger(storage));
                    }}>
                    Añadir extracción al historial anterior
                  </button>
                  {ledgerWrite && <p role="status" data-testid="bridge-combat-receipt-status">
                    {ledgerText[ledgerWrite.status]}
                  </p>}
                </> : <p role="status" data-testid="bridge-combat-identity-error">
                  La identidad de misión no se puede consultar. Se conserva el historial sin modificar.
                </p>}
              </div>
            )}
          </>}
        {attemptLedger && (identity?.status === 'ready' ||
          attemptLedger.status === 'incompatible' || attemptLedger.status === 'unavailable' ||
          attemptLedger.entries.length > 0) && (
          <details className="bridge-combat-ledger" data-testid="bridge-combat-attempt-ledger">
            <summary data-testid="bridge-combat-attempt-ledger-summary">
              Misiones identificadas · {attemptLedger.entries.length} {attemptLedger.entries.length === 1 ? 'misión' : 'misiones'} ▾
            </summary>
            {attemptLedger.status === 'incompatible'
              ? <p data-testid="bridge-combat-attempt-ledger-error">Historial identificado incompatible. No se ha modificado.</p>
              : attemptLedger.status === 'unavailable'
                ? <p data-testid="bridge-combat-attempt-ledger-error">No se puede leer el almacenamiento local.</p>
                : attemptLedger.entries.length === 0
                  ? <p>Todavía no hay misiones identificadas registradas.</p>
                  : <ol data-testid="bridge-combat-attempt-ledger-entries">
                    {attemptLedger.entries.map(entry => <li key={entry.instanceId}>
                      <span>Intento {entry.instanceId.slice(0, 8)} · {entry.report.label}</span>
                      <span>{entry.report.round} rondas · {entry.report.orders} órdenes · {entry.report.wounds} PV de daño</span>
                    </li>)}
                  </ol>}
          </details>
        )}
        {ledger && (identity?.status !== 'ready' || ledger.status !== 'missing' ||
          ledger.entries.length > 0) && <details className="bridge-combat-ledger" data-testid="bridge-combat-ledger">
          <summary data-testid="bridge-combat-ledger-summary">
            Historial anterior · {ledger.status === 'ready' ? ledger.entries.length : 0} {ledger.entries.length === 1 ? 'extracción' : 'extracciones'} ▾
          </summary>
          {ledger.status === 'incompatible'
            ? <p data-testid="bridge-combat-ledger-error">Historial incompatible. No se ha modificado.</p>
            : ledger.status === 'unavailable'
              ? <p data-testid="bridge-combat-ledger-error">No se puede leer el almacenamiento local.</p>
              : ledger.entries.length === 0
                ? <p>Todavía no hay extracciones registradas.</p>
                : <ol data-testid="bridge-combat-ledger-entries">
                  {ledger.entries.map(entry => <li key={entry.checkpoint}>
                    <span>{entry.report.label}</span>
                    <span>{entry.report.round} rondas · {entry.report.orders} órdenes · {entry.report.wounds} PV de daño</span>
                  </li>)}
                </ol>}
        </details>}
        <p className="bridge-combat-scope" data-testid="bridge-combat-scope">Informe reconstruido del combate experimental v4.
          Las misiones identificadas cuentan por intento, aunque repitan órdenes. Los registros anteriores permanecen separados.
          No concede recompensas ni modifica la campaña principal.</p>
      </div>
    </details>
  );
}
