import { useEffect, useState } from 'react';
import { applyMandateAction, classifiedMandateReport, publicMandateReport, startMandate } from '../../../src/dualMandate.mjs';
import { localStorageOrNull } from '../session';
import { PROBE_FINDING } from '../../../src/awayTeam.mjs';
import { canBriefScientificFinding, briefScientificFinding } from '../../../src/scientificBriefing.mjs';
import { PROBE_SURVEY_INCIDENT } from '../../../src/observedMandate.mjs';
import world from '../../../content/scenes/meridian.json';
import type { ViewState } from './FirstPersonView';
import { reconcileObservedProbe, PROBE_SURVEY_ORDER } from '../../../src/observedMandate.mjs';
import { MANDATE_DEFINITION, persistMandateSession, restoreMandateSession, type MandateState } from '../mandateSession';
import './dualMandatePanel.css';

type MandateDecision = Record<string, unknown> & { type: string };
const label: Record<string, string> = {
  rescue: 'Civiles evacuados',
  failure: 'Evacuación fallida',
  evidence: 'Pruebas recuperadas',
  refusal: 'Directiva rechazada',
};
const resultText: Record<string, string> = {
  active: 'Pendiente', completed: 'Completada', failed: 'Fallida', refused: 'Rechazada',
};

type ActualAwayFinding = {
  version: number;
  squad: string[];
  findings: string[];
  attempts: number;
  lastReport: null | { officerId: string; skill: number; result: string };
};

export function DualMandatePanel({ awayTeam, exploration, accessedStationId }: {
  awayTeam: ActualAwayFinding;
  exploration: ViewState;
  accessedStationId: string | null;
}) {
  const [initial] = useState(() => restoreMandateSession(localStorageOrNull()));
  const [mandate, setMandate] = useState<MandateState>(() => initial.state);
  useEffect(() => { persistMandateSession(mandate, localStorageOrNull()); }, [mandate]);
  // The only automatic evidence is an actual, validated first-person expedition.
  // On F5 the independently persisted away-team checkpoint replays into this log.
  useEffect(() => {
    if (awayTeam.findings.includes(PROBE_FINDING)) {
      setMandate(before => reconcileObservedProbe(MANDATE_DEFINITION, before, awayTeam));
    }
  }, [awayTeam]);

  // Reports always come from the SAME canonical sequence, not from UI flags.
  const publicLog = publicMandateReport(MANDATE_DEFINITION, mandate);
  const classified = classifiedMandateReport(MANDATE_DEFINITION, mandate);
  const openOrder = publicLog.orders.find((order: { id: string }) => order.id === 'evacuate')!;
  const surveyOrder = publicLog.orders.find((order: { id: string }) => order.id === PROBE_SURVEY_ORDER)!;
  const hiddenOrder = classified.orders.find((order: { channel: string }) => order.channel === 'covert')!;
  const secretIncident = classified.incidents.find((incident: { orderId: string }) => incident.orderId === hiddenOrder.id);
  const informed = secretIncident !== undefined &&
    mandate.knowledge.solan.includes(secretIncident.id);
  const scienceBriefed = mandate.knowledge.solan.includes(PROBE_SURVEY_INCIDENT);
  const canBriefScience = canBriefScientificFinding(
    MANDATE_DEFINITION, mandate, awayTeam, world, exploration, accessedStationId
  );

  const run = (actions: MandateDecision[]) => setMandate(before =>
    actions.reduce<MandateState>((state, action) => applyMandateAction(MANDATE_DEFINITION, state, action), before)
  );

  const finishOfficial = (result: 'success' | 'failed') => {
    const success = result === 'success';
    const incidentId = success ? 'survivors-evacuated' : 'evacuation-incomplete';
    run([
      { type: 'record', incidentId, orderId: 'evacuate',
        kind: success ? 'rescue' : 'failure', witnesses: ['mira'], public: true },
      { type: 'resolve', orderId: 'evacuate', incidentId,
        status: success ? 'completed' : 'failed' },
    ]);
  };

  const finishCovert = (result: 'success' | 'refused') => {
    const success = result === 'success';
    const incidentId = success ? 'sensor-core-recovered' : 'directive-declined';
    run([
      { type: 'record', incidentId, orderId: 'recover-core',
        kind: success ? 'evidence' : 'refusal',
        witnesses: success ? ['venn'] : [], public: false },
      { type: 'resolve', orderId: 'recover-core', incidentId,
        status: success ? 'completed' : 'refused' },
    ]);
  };

  return (
    <details className="mandate-archive" data-testid="mandate-archive">
      <summary>ARCHIVO DE ÓRDENES <span>Simulación narrativa ▾</span></summary>
      <div className="mandate-archive-body">
        <p className="mandate-caveat">Prototipo autónomo de decisiones y bitácoras. Aún no representa acciones realizadas en el escenario 3D ni modifica la misión «Ecos en la frontera».</p>
        <section className="mandate-record" data-testid="mandate-public-log" aria-label="Registro de servicio público">
          <h3>Registro de servicio <span>OFICIAL</span></h3>
          <p className="mandate-order">{openOrder.title}</p>
          <p className="mandate-progress" data-testid="mandate-official-status">{resultText[openOrder.status]}</p>
          <p className="mandate-order" data-testid="mandate-real-survey">{surveyOrder.title} · <strong data-testid="mandate-survey-status">{resultText[surveyOrder.status]}</strong></p>
          <p className="mandate-caveat">El estudio científico se completa solo tras investigar la sonda con un equipo competente en el escenario 3D; no puede adjudicarse desde aquí.</p>
          {surveyOrder.status === 'completed' && <div data-testid="mandate-field-briefing">
            <p className="mandate-knowledge" data-testid="mandate-field-knowledge">
              {scienceBriefed ? 'Idris Solan ha recibido el informe científico del capitán.' :
                'El hallazgo consta en la bitácora. Idris Solan todavía no ha recibido un informe personal.'}
            </p>
            {canBriefScience ? <button type="button" className="mandate-secondary"
              data-testid="mandate-brief-science"
              onClick={() => setMandate(before => briefScientificFinding(
                MANDATE_DEFINITION, before, awayTeam, world, exploration, accessedStationId
              ))}>
              Informar a Idris Solan desde el puesto de mando
            </button> : !scienceBriefed && <p className="mandate-caveat">
              Regresa al puente y usa el sillón del capitán para transmitirle el informe.
            </p>}
          </div>}
          {openOrder.status === 'active' && <div className="mandate-actions">
            <button type="button" data-testid="mandate-rescue" onClick={() => finishOfficial('success')}>Registrar evacuación realizada</button>
            <button type="button" data-testid="mandate-failure" onClick={() => finishOfficial('failed')}>Registrar evacuación fallida</button>
          </div>}
          {publicLog.incidents.length > 0 &&
            <ul className="mandate-events" data-testid="mandate-public-events">
              {publicLog.incidents.map((incident: { id: string; kind: string }) =>
                <li key={incident.id}>{label[incident.kind] ?? incident.kind}</li>)}
            </ul>}
        </section>

        <details className="mandate-vault" data-testid="mandate-vault">
          <summary>Canal reservado <span>Acceso del capitán ▾</span></summary>
          <section data-testid="mandate-classified-log" aria-label="Bitácora clasificada">
            <h3>Bitácora auténtica <span>RESERVADO</span></h3>
            <p className="mandate-order" data-testid="mandate-classified-order">{hiddenOrder.title}</p>
            <p className="mandate-progress" data-testid="mandate-covert-status">{resultText[hiddenOrder.status]}</p>
            {hiddenOrder.status === 'active' && <div className="mandate-actions">
              <button type="button" data-testid="mandate-recover" onClick={() => finishCovert('success')}>Registrar recuperación de pruebas</button>
              <button type="button" data-testid="mandate-refuse" onClick={() => finishCovert('refused')}>Rechazar la directiva</button>
            </div>}
            {secretIncident && <>
              <p className="mandate-knowledge" data-testid="mandate-knowledge">
                {secretIncident.knownBy.includes('venn') ? 'La oficial científica conoce el incidente.' : 'Solo el capitán conoce el incidente.'}
                {informed ? ' El primer oficial también está informado.' : ''}
              </p>
              {!informed && <button className="mandate-secondary" type="button" data-testid="mandate-inform"
                onClick={() => run([{ type: 'inform', incidentId: secretIncident.id, from: 'captain', to: 'solan' }])}>
                Informar al primer oficial
              </button>}
              {!secretIncident.public && <button className="mandate-secondary" type="button" data-testid="mandate-publish"
                onClick={() => run([{ type: 'publish', incidentId: secretIncident.id }])}>
                Hacer público el hallazgo sin revelar la directiva
              </button>}
            </>}
          </section>
        </details>

        <div className="mandate-archive-footer">
          <span data-testid="mandate-save-notice">{initial.notice} · {mandate.actions.length} eventos</span>
          <button type="button" data-testid="mandate-reset" onClick={() => setMandate(reconcileObservedProbe(MANDATE_DEFINITION, startMandate(MANDATE_DEFINITION), awayTeam))}>Reiniciar simulación (conservar hallazgos reales)</button>
        </div>
      </div>
    </details>
  );
}
