import type { Dispatch, SetStateAction } from 'react';
import { applyMandateAction, classifiedMandateReport, publicMandateReport, startMandate } from '../../../src/dualMandate.mjs';
import { canBriefScientificFinding, briefScientificFinding } from '../../../src/scientificBriefing.mjs';
import { EVACUATION_INCIDENT } from '../../../src/medicalEvacuation.mjs';
import { CORE_INCIDENT } from '../../../src/sensorCoreRecovery.mjs';
import { PROBE_SURVEY_INCIDENT, reconcileObservedProbe, PROBE_SURVEY_ORDER } from '../../../src/observedMandate.mjs';
import world from '../../../content/scenes/meridian.json';
import type { ViewState } from './FirstPersonView';
import { MANDATE_DEFINITION, type MandateState } from '../mandateSession';
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

export function DualMandatePanel({ awayTeam, exploration, accessedStationId, mandate, setMandate, initialNotice, commandMode = 'walking' }: {
  awayTeam: ActualAwayFinding;
  exploration: ViewState;
  accessedStationId: string | null;
  mandate: MandateState;
  setMandate: Dispatch<SetStateAction<MandateState>>;
  initialNotice: string;
  commandMode?: 'walking' | 'seated';
}) {

  // Reports always come from the SAME canonical sequence, not from UI flags.
  const publicLog = publicMandateReport(MANDATE_DEFINITION, mandate);
  const classified = classifiedMandateReport(MANDATE_DEFINITION, mandate);
  const openOrder = publicLog.orders.find((order: { id: string }) => order.id === 'evacuate')!;
  const realRescueVerified = publicLog.incidents.some((item: { id: string }) =>
    item.id === EVACUATION_INCIDENT
  );
  const legacyRescue = openOrder.status !== 'active' && !realRescueVerified;
  const surveyOrder = publicLog.orders.find((order: { id: string }) => order.id === PROBE_SURVEY_ORDER)!;
  const hiddenOrder = classified.orders.find((order: { channel: string }) => order.channel === 'covert')!;
  const physicalCore = classified.incidents.some((event: { id: string }) => event.id === CORE_INCIDENT);
  const oldSimulatedCore = hiddenOrder.status === 'completed' && !physicalCore;
  const secretIncident = classified.incidents.find((incident: { orderId: string }) => incident.orderId === hiddenOrder.id);
  const informed = secretIncident !== undefined &&
    mandate.knowledge.solan.includes(secretIncident.id);
  const scienceBriefed = mandate.knowledge.solan.includes(PROBE_SURVEY_INCIDENT);
  const canBriefScience = canBriefScientificFinding(
    MANDATE_DEFINITION, mandate, awayTeam, world, exploration, accessedStationId, commandMode
  );

  const run = (actions: MandateDecision[]) => setMandate(before =>
    actions.reduce<MandateState>((state, action) => applyMandateAction(MANDATE_DEFINITION, state, action), before)
  );

  const refuseCovert = () => run([
    { type: 'record', incidentId: 'directive-declined', orderId: 'recover-core',
      kind: 'refusal', witnesses: [], public: false },
    { type: 'resolve', orderId: 'recover-core',
      incidentId: 'directive-declined', status: 'refused' },
  ]);

  return (
    <details className="mandate-archive" data-testid="mandate-archive">
      <summary>ARCHIVO DE ÓRDENES <span>Servicio real · archivo reservado ▾</span></summary>
      <div className="mandate-archive-body">
        <p className="mandate-caveat">El estudio, la evacuación y la recuperación del núcleo exigen acciones reales en superficie. La negativa a la directiva y la publicación son decisiones del capitán; «Ecos en la frontera» conserva su partida independiente.</p>
        <section className="mandate-record" data-testid="mandate-public-log" aria-label="Registro de servicio público">
          <h3>Registro de servicio <span>OFICIAL</span></h3>
          <p className="mandate-order">{openOrder.title}</p>
          <p className="mandate-progress" data-testid="mandate-official-status">{resultText[openOrder.status]}</p>
          {legacyRescue && <p className="mandate-caveat" data-testid="mandate-legacy-rescue">
            Estado heredado de la antigua simulación narrativa, no de una evacuación en la superficie. Reinicia el archivo para realizar el rescate real.
          </p>}
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
                MANDATE_DEFINITION, before, awayTeam, world, exploration, accessedStationId, commandMode
              ))}>
              Informar a Idris Solan desde el puesto de mando
            </button> : !scienceBriefed && <p className="mandate-caveat">
              {commandMode === 'seated' ? exploration.area === 'bridge'
                ? 'Selecciona Mando en el panel del capitán para transmitirle el informe.'
                : 'Regresa al puente y selecciona Mando en el panel del capitán para transmitirle el informe.'
                : 'Regresa al puente y usa el sillón del capitán para transmitirle el informe.'}
            </p>}
          </div>}
          {openOrder.status === 'active' && <p className="mandate-caveat" data-testid="mandate-rescue-guidance">
            Para evacuar a los civiles, despliega un equipo con capacidad médica y accede al puesto de socorro en la superficie. El resultado se registra al interactuar allí.
          </p>}
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
            {oldSimulatedCore && <p className="mandate-caveat" data-testid="mandate-legacy-core">
              Recuperación heredada de la simulación anterior, no de una extracción física. Reinicia el archivo si quieres realizar la misión real.
            </p>}
            {hiddenOrder.status === 'active' && <div className="mandate-actions">
              <p className="mandate-caveat" data-testid="mandate-core-guidance">
                Recupera el núcleo en el archivo de sensores de la superficie con un equipo técnico competente, o rechaza deliberadamente la directiva.
              </p>
              <button type="button" data-testid="mandate-refuse" onClick={refuseCovert}>Rechazar la directiva</button>
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
          <span data-testid="mandate-save-notice">{initialNotice} · {mandate.actions.length} eventos</span>
          <button type="button" data-testid="mandate-reset" onClick={() => setMandate(reconcileObservedProbe(MANDATE_DEFINITION, startMandate(MANDATE_DEFINITION), awayTeam))}>Reiniciar archivo (conservar sonda; borrar rescates y decisiones)</button>
        </div>
      </div>
    </details>
  );
}
