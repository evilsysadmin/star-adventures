// A covert retrieval can only occur at an authored physical station with a
// qualified officer actually deployed on the away squad. No renderer/IO imports.
import { OFFICERS, validateCrew } from './crew.mjs';
import { validateAwayTeam } from './awayTeam.mjs';
import { validateWorld, validateExploration, faceTile } from './spatial.mjs';
import { MandateError, applyMandateAction, replayMandateActions } from './dualMandate.mjs';

export const CORE_STATION_ACTION = 'extract-sensor-core';
export const CORE_ORDER = 'recover-core';
export const CORE_INCIDENT = 'field-core-extracted';
const TECHNICAL_THRESHOLD = 3;
const fail = message => { throw new MandateError(message); };

export function recoverSensorCore(definition, mandate, world, exploration, crew, away) {
  validateWorld(world);
  validateExploration(world, exploration);
  validateCrew(crew);
  validateAwayTeam(away);
  const canonical = replayMandateActions(definition, mandate?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(mandate))
    fail('Untrusted covert recovery history');
  if (!definition.orders.some(item => item.id === CORE_ORDER && item.channel === 'covert') ||
      mandate.orders[CORE_ORDER] !== 'active') fail('No active covert recovery order');
  if (exploration.area !== 'surface' || exploration.pending !== null)
    fail('Covert retrieval requires physical deployment');
  const ahead = faceTile(exploration);
  const station = world.scenes.surface.objects.find(item =>
    item.type === 'station' && item.action === CORE_STATION_ACTION &&
    item.x === ahead.x && item.y === ahead.y);
  if (!station) fail('Sensor core must be physically faced at its authored station');
  const strongest = away.squad.map(officerId => {
    const officer = OFFICERS.find(item => item.id === officerId);
    const levelBonus = Math.floor((crew.progression[officerId].level - 1) / 2);
    const skill = Math.min(5, Math.max(officer.skills.science, officer.skills.engineering) + levelBonus);
    return { officerId, skill };
  }).sort((a, b) => b.skill - a.skill)[0];
  if (!definition.actors.includes(strongest.officerId))
    fail('Covert technical witness absent from mandate');
  if (strongest.skill < TECHNICAL_THRESHOLD)
    return { state: mandate, report: { result: 'insufficient-technical', ...strongest } };
  const observed = applyMandateAction(definition, mandate, {
    type: 'record', incidentId: CORE_INCIDENT,
    orderId: CORE_ORDER, kind: 'evidence',
    witnesses: [strongest.officerId], public: false,
  });
  const state = applyMandateAction(definition, observed, {
    type: 'resolve', orderId: CORE_ORDER, incidentId: CORE_INCIDENT, status: 'completed',
  });
  return { state, report: { result: 'core-recovered', ...strongest } };
}
