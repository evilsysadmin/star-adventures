// Pure adapter: an observed away-team report becomes a public mission event.
import { PROBE_FINDING, validateAwayTeam } from './awayTeam.mjs';
import { applyMandateAction, replayMandateActions, MandateError } from './dualMandate.mjs';
export const PROBE_SURVEY_ORDER = 'survey-probe';
export const PROBE_SURVEY_INCIDENT = 'probe-signature-verified';
export function reconcileObservedProbe(definition, mandate, away) {
  validateAwayTeam(away);
  const canonical = replayMandateActions(definition, mandate?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(mandate)) throw new MandateError('Untrusted mission report');
  if (!definition.orders.some(order => order.id === PROBE_SURVEY_ORDER && order.channel === 'official'))
    throw new MandateError('Missing scientific survey order');
  if (!away.findings.includes(PROBE_FINDING)) return mandate;
  if (away.lastReport?.result !== 'success' || !definition.actors.includes(away.lastReport.officerId))
    throw new MandateError('Unverified scientific witness');
  const previous = mandate.incidents.find(item => item.id === PROBE_SURVEY_INCIDENT);
  if (previous) {
    if (previous.orderId !== PROBE_SURVEY_ORDER || previous.kind !== 'evidence' ||
        !previous.public || mandate.orders[PROBE_SURVEY_ORDER] !== 'completed' ||
        !previous.witnesses.includes(away.lastReport.officerId))
      throw new MandateError('Contradictory previous scientific record');
    return mandate;
  }
  if (mandate.orders[PROBE_SURVEY_ORDER] !== 'active') throw new MandateError('Survey no longer active');
  const observed = applyMandateAction(definition, mandate, {
    type: 'record', incidentId: PROBE_SURVEY_INCIDENT, orderId: PROBE_SURVEY_ORDER,
    kind: 'evidence', witnesses: [away.lastReport.officerId], public: true,
  });
  return applyMandateAction(definition, observed, {
    type: 'resolve', incidentId: PROBE_SURVEY_INCIDENT, orderId: PROBE_SURVEY_ORDER, status: 'completed',
  });
}
