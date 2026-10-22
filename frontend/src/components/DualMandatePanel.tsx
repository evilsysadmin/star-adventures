import { useEffect, useState } from 'react';
import { applyMandateAction, classifiedMandateReport, publicMandateReport, startMandate } from '../../../src/dualMandate.mjs';
import { localStorageOrNull } from '../session';
import { MANDATE_DEFINITION, persistMandateSession, restoreMandateSession } from '../mandateSession';
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

export function DualMandatePanel() {
  const [initial] = useState(() => restoreMandateSession(localStorageOrNull()));
  const [mandate, setMandate] = useState<ReturnType<typeof startMandate>>(() => initial.state);
  useEffect(() => { persistMandateSession(mandate, localStorageOrNull()); }, [mandate]);

  // Reports always come from the SAME canonical sequence, not from UI flags.
  const publicLog = publicMandateReport(MANDATE_DEFINITION, mandate);
  const classified = classifiedMandateReport(MANDATE_DEFINITION, mandate);
  const openOrder = publicLog.orders[0];
  const hiddenOrder = classified.orders.find((order: { channel: string }) => order.channel === 'covert')!;
  const secretIncident = classified.incidents.find((incident: { orderId: string }) => incident.orderId === hiddenOrder.id);
  const informed = secretIncident !== undefined &&
    mandate.knowledge.solan.includes(secretIncident.id);

  const run = (actions: MandateDecision[]) => setMandate(before =>
    actions.reduce((state, action) => applyMandateAction(MANDATE_DEFINITION, state, action), before)
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
          <button type="button" data-testid="mandate-reset" onClick={() => setMandate(startMandate(MANDATE_DEFINITION))}>Reiniciar solo este archivo</button>
        </div>
      </div>
    </details>
  );
}
