// A legitimate rescue order can only be completed by a physically deployed
// medical team at an authored outpost interaction point.
import { OFFICERS, validateCrew } from './crew.mjs';
import { validateAwayTeam } from './awayTeam.mjs';
import { validateWorld, validateExploration, faceTile } from './spatial.mjs';
import { MandateError, applyMandateAction, replayMandateActions } from './dualMandate.mjs';

export const EVACUATION_STATION_ACTION = 'assist-evacuees';
export const EVACUATION_ORDER = 'evacuate';
export const EVACUATION_INCIDENT = 'field-medical-evacuation';
const MEDICAL_THRESHOLD = 3;
const fail = message => { throw new MandateError(message); };

function medicalEncounter(world, exploration, crew, away) {
  validateWorld(world);
  validateExploration(world, exploration);
  validateCrew(crew);
  validateAwayTeam(away);
  if (exploration.area !== 'surface' || exploration.pending !== null)
    fail('Civilian medical response requires a deployed surface party');
  const ahead = faceTile(exploration);
  const station = world.scenes.surface.objects.find(item =>
    item.type === 'station' && item.action === EVACUATION_STATION_ACTION &&
    item.x === ahead.x && item.y === ahead.y);
  if (!station) fail('Medical response requires a faced, authored evacuation station');
  const candidates = away.squad.map(officerId => {
    const officer = OFFICERS.find(candidate => candidate.id === officerId);
    const level = crew.progression[officerId].level;
    return { officerId, skill: Math.min(5, officer.skills.medicine + Math.floor((level - 1) / 2)) };
  }).sort((a, b) => b.skill - a.skill);
  return candidates[0];
}

/** Validates the REAL location, roster and crew ability before recording success.
 * An insufficient medical squad cannot report rescued civilians or close the order.
 * Every accepted rescue generates replayable public evidence, not inferred UI state.
 */
export function performMedicalEvacuation(definition, mandate, world, exploration, crew, away) {
  const medic = medicalEncounter(world, exploration, crew, away);
  const canonical = replayMandateActions(definition, mandate?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(mandate))
    fail('Untrusted evacuation history');
  const order = definition.orders.find(item =>
    item.id === EVACUATION_ORDER && item.channel === 'official');
  if (!order || !definition.actors.includes(medic.officerId))
    fail('Evacuation order or medical witness missing');
  if (mandate.orders[EVACUATION_ORDER] !== 'active')
    fail('Civilian order is already resolved');
  if (medic.skill < MEDICAL_THRESHOLD) {
    return { state: mandate, report: { result: 'insufficient-medical', ...medic } };
  }
  const observed = applyMandateAction(definition, mandate, {
    type: 'record', incidentId: EVACUATION_INCIDENT,
    orderId: EVACUATION_ORDER, kind: 'rescue',
    witnesses: [medic.officerId], public: true,
  });
  const state = applyMandateAction(definition, observed, {
    type: 'resolve', orderId: EVACUATION_ORDER,
    incidentId: EVACUATION_INCIDENT, status: 'completed',
  });
  return { state, report: { result: 'evacuated', ...medic } };
}
