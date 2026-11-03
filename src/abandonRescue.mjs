// Closing the official rescue records a refusal, never an invented evacuation.
import { applyMandateAction, replayMandateActions } from './dualMandate.mjs';
import { validateExploration } from './spatial.mjs';

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

// Emergency extraction is available only after a recorded refusal and uses the
// authored return destination; it never resolves other orders or rescues civilians.
export function returnAfterAbandonedRescue(world, position, definition, mandate) {
  const canonical = replayMandateActions(definition, mandate?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(mandate) ||
      canonical.orders.evacuate !== 'refused' ||
      !canonical.incidents.some(item => item.id === ABANDON_RESCUE_INCIDENT && item.orderId === 'evacuate')) {
    throw new Error('Rescue has not been abandoned');
  }
  validateExploration(world, position);
  const exit = world.scenes.surface?.objects.find(item => item.id === 'beam-out' && item.type === 'transition' && item.to === 'bridge');
  if (position.area !== 'surface' || position.pending || !exit || !world.scenes.bridge?.spawn) {
    throw new Error('Emergency return unavailable');
  }
  const returned = { version: 1, area: exit.to, ...world.scenes[exit.to].spawn, pending: null };
  validateExploration(world, returned);
  return returned;
}
