// Closing the official rescue records a refusal, never an invented evacuation.
import { applyMandateAction } from './dualMandate.mjs';

export const ABANDON_RESCUE_INCIDENT = 'rescue-abandoned';

export function abandonRescue(definition, state) {
  const recorded = applyMandateAction(definition, state, {
    type: 'record', incidentId: ABANDON_RESCUE_INCIDENT, orderId: 'evacuate',
    kind: 'refusal', witnesses: [], public: true,
  });
  return applyMandateAction(definition, recorded, {
    type: 'resolve', orderId: 'evacuate', incidentId: ABANDON_RESCUE_INCIDENT, status: 'refused',
  });
}
