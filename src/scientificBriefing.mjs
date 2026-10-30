// An actual scientific away-team finding can be briefed only from the captain's chair.
// No UI, browser storage, or franchise-specific material in this gameplay rule.
import { MandateError, applyMandateAction } from './dualMandate.mjs';
import { eligibleMandateBranches } from './mandateGates.mjs';
import { facedConsole } from './consoleOrders.mjs';
import { captainConsole } from './captainOrders.mjs';
import { PROBE_FINDING } from './awayTeam.mjs';
import { reconcileObservedProbe, PROBE_SURVEY_INCIDENT, PROBE_SURVEY_ORDER } from './observedMandate.mjs';

const FIRST_OFFICER = 'solan';
const BRIEF_ID = 'brief-field-finding';
const BRIEF_BRANCH = Object.freeze([{
  id: BRIEF_ID,
  audience: 'official',
  when: { type: 'all', gates: [
    { type: 'order-status', orderId: PROBE_SURVEY_ORDER, status: 'completed' },
    { type: 'incident', orderId: PROBE_SURVEY_ORDER, kind: 'evidence', public: true },
  ] },
}]);

export function canBriefScientificFinding(definition, mandate, away, world, exploration, accessedStationId, commandMode = 'walking') {
  if (!['walking', 'seated'].includes(commandMode)) throw new MandateError('Unknown bridge command mode');
  // Check both canonical records: a historical entry alone cannot replace
  // the separately validated real away-team discovery on the same device.
  const consistent = reconcileObservedProbe(definition, mandate, away);
  if (consistent !== mandate || !away.findings.includes(PROBE_FINDING) ||
      away.lastReport?.result !== 'success') return false;
  const enabled = eligibleMandateBranches(definition, mandate, BRIEF_BRANCH, 'official');
  if (!enabled.includes(BRIEF_ID)) return false;
  const incident = mandate.incidents.find(item => item.id === PROBE_SURVEY_INCIDENT);
  if (!incident || !incident.witnesses.includes(away.lastReport.officerId) ||
      mandate.knowledge[FIRST_OFFICER].includes(PROBE_SURVEY_INCIDENT)) return false;
  const console = commandMode === 'seated'
    ? captainConsole(world, exploration, accessedStationId) : facedConsole(world, exploration);
  return console?.id === 'captain' && console.action === 'command' &&
    accessedStationId === console.id;
}

export function briefScientificFinding(definition, mandate, away, world, exploration, accessedStationId, commandMode = 'walking') {
  if (!canBriefScientificFinding(definition, mandate, away, world, exploration, accessedStationId, commandMode))
    throw new MandateError('Scientific briefing requires an authentic discovery and captain chair access');
  return applyMandateAction(definition, mandate, {
    type: 'inform', incidentId: PROBE_SURVEY_INCIDENT, from: 'captain', to: FIRST_OFFICER,
  });
}
