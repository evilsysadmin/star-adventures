// First away-team vertical slice: a persistent three-officer squad and a real probe check.
// The squad operates in the SAME spatial world but is not a shipboard console.
import { OFFICERS, validateCrew } from './crew.mjs';
import { validateExploration, faceTile } from './spatial.mjs';

export const PROBE_FINDING = 'probe-mineral-signature';
export const DEFAULT_SQUAD = Object.freeze(['venn', 'dorn', 'mira']);
export class AwayTeamError extends Error {
  constructor(message) { super(message); this.name = 'AwayTeamError'; }
}
const fail = message => { throw new AwayTeamError(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = id => OFFICERS.some(officer => officer.id === id);

export function startAwayTeam() {
  return { version: 1, squad: [...DEFAULT_SQUAD], findings: [], attempts: 0, lastReport: null };
}

export function validateAwayTeam(state) {
  if (!isObject(state) || state.version !== 1 || !Array.isArray(state.squad) ||
      state.squad.length !== 3 || new Set(state.squad).size !== 3 ||
      !state.squad.every(has) || !Array.isArray(state.findings) ||
      state.findings.length > 1 || !state.findings.every(x => x === PROBE_FINDING) ||
      !Number.isSafeInteger(state.attempts) || state.attempts < 0 || state.attempts > 100 ||
      (state.findings.length && state.attempts === 0)) fail('Invalid away-team state');
  if (state.lastReport !== null) {
    const report = state.lastReport;
    if (!isObject(report) || !has(report.officerId) ||
        !Number.isInteger(report.skill) || report.skill < 1 || report.skill > 5 ||
        !['success', 'insufficient-science'].includes(report.result) ||
        state.attempts === 0 || (report.result === 'success') !== state.findings.includes(PROBE_FINDING)) {
      fail('Invalid away-team report');
    }
  } else if (state.attempts !== 0) fail('Missing away-team report');
  return true;
}

export function selectAwayOfficer(state, slot, officerId, exploration) {
  validateAwayTeam(state);
  if (!exploration || exploration.area !== 'bridge' || exploration.pending !== null)
    fail('Select the away team aboard the ship before transporting');
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3 || !has(officerId) ||
      state.squad.some((id, index) => id === officerId && index !== slot)) fail('Invalid or duplicate officer');
  const squad = state.squad.slice();
  squad[slot] = officerId;
  return { ...state, squad, findings: [...state.findings], lastReport: state.lastReport && { ...state.lastReport } };
}

// The probe exists as an authored, faced location. This is a distinct scientific
// away-team discovery, not a remote call to the ship's `scan` mission command.
export function investigateProbe(world, exploration, crew, state) {
  validateAwayTeam(state);
  validateCrew(crew);
  validateExploration(world, exploration);
  if (exploration.area !== 'surface' || exploration.pending !== null)
    fail('Probe can only be investigated from the surface');
  const front = faceTile(exploration);
  const target = world.scenes.surface.objects.find(object =>
    object.type === 'station' && object.action === 'inspect-probe' &&
    object.x === front.x && object.y === front.y);
  if (!target) fail('Must face the probe at an adjacent square');
  if (state.findings.includes(PROBE_FINDING)) fail('Probe already investigated');
  if (state.attempts >= 100) fail('Too many unsuccessful inspections');
  const ranked = state.squad.map(id => {
    const officer = OFFICERS.find(item => item.id === id);
    const level = crew.progression[id].level;
    return { id, skill: Math.min(5, officer.skills.science + Math.floor((level - 1) / 2)) };
  }).sort((a,b) => b.skill - a.skill);
  const expert = ranked[0];
  const success = expert.skill >= 3;
  const report = { officerId: expert.id, skill: expert.skill, result: success ? 'success' : 'insufficient-science' };
  const next = {
    ...state,
    squad: [...state.squad],
    findings: success ? [PROBE_FINDING] : [],
    attempts: state.attempts + 1,
    lastReport: report,
  };
  return { state: next, report };
}
