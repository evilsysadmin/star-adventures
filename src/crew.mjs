// Independent, immutable crew model. No React, browser API, or franchise dependency.
import { choose, currentNode } from './episode.mjs';

export class CrewError extends Error {
  constructor(message) { super(message); this.name = 'CrewError'; }
}

export const STATIONS = Object.freeze(['command', 'science', 'diplomacy', 'tactical', 'engineering', 'medicine']);

// Original prototype officers. Stable IDs survive rename/localization.
export const OFFICERS = Object.freeze([
  { id: 'varela', name: 'Elena Varela', rank: 'Capitana', skills: { command: 4, science: 1, diplomacy: 3, tactical: 2, engineering: 1, medicine: 1 } },
  { id: 'solan', name: 'Idris Solan', rank: 'Primer oficial', skills: { command: 3, science: 2, diplomacy: 4, tactical: 2, engineering: 1, medicine: 1 } },
  { id: 'venn', name: 'Nara Venn', rank: 'Oficial científica', skills: { command: 1, science: 4, diplomacy: 1, tactical: 1, engineering: 3, medicine: 2 } },
  { id: 'dorn', name: 'Kael Dorn', rank: 'Oficial táctico', skills: { command: 2, science: 1, diplomacy: 1, tactical: 4, engineering: 2, medicine: 1 } },
  { id: 'rhee', name: 'Tao Rhee', rank: 'Ingeniero jefe', skills: { command: 1, science: 3, diplomacy: 1, tactical: 2, engineering: 4, medicine: 1 } },
  { id: 'mira', name: 'Isa Mira', rank: 'Médica jefe', skills: { command: 1, science: 3, diplomacy: 2, tactical: 1, engineering: 1, medicine: 4 } },
]);

const DEFAULT_ASSIGNMENTS = Object.freeze({
  command: 'varela', science: 'venn', diplomacy: 'solan', tactical: 'dorn', engineering: 'rhee', medicine: 'mira',
});
const CHECK_STATIONS = Object.freeze({
  scan: 'science', broadcast: 'science', hail: 'diplomacy', mediate: 'diplomacy',
  intercept: 'tactical', disable: 'tactical', disengage: 'command', withdraw: 'command', ultimatum: 'command',
});
const CHECKPOINT_CHOICES = new Set(['broadcast', 'mediate', 'disable']);
const MAX_LEVEL = 5;
const SKILL_PASS = 3;

const invalid = message => { throw new CrewError(message); };
const lookup = id => OFFICERS.find(officer => officer.id === id);

export function startCrew() {
  return {
    version: 1,
    assignments: { ...DEFAULT_ASSIGNMENTS },
    progression: Object.fromEntries(OFFICERS.map(officer => [officer.id, { xp: 0, level: 1 }])),
  };
}

export function validateCrew(crew) {
  if (!crew || crew.version !== 1 || !crew.assignments || !crew.progression) invalid('Unsupported crew');
  if (Object.keys(crew.assignments).length !== STATIONS.length ||
      new Set(Object.values(crew.assignments)).size !== OFFICERS.length) invalid('Invalid assignments');
  for (const station of STATIONS) if (!lookup(crew.assignments[station])) invalid('Unknown assigned officer');
  if (Object.keys(crew.progression).length !== OFFICERS.length) invalid('Invalid progression');
  for (const officer of OFFICERS) {
    const current = crew.progression[officer.id];
    if (!current || !Number.isSafeInteger(current.xp) || current.xp < 0 || current.xp > 1_000_000 ||
        current.level !== Math.min(MAX_LEVEL, 1 + Math.floor(current.xp / 100))) invalid('Invalid officer progression');
  }
  return true;
}

// Staffing one station swaps occupants; nobody can occupy two stations.
export function assignOfficer(crew, station, officerId) {
  validateCrew(crew);
  if (!STATIONS.includes(station) || !lookup(officerId)) invalid('Unknown station or officer');
  const previousStation = STATIONS.find(key => crew.assignments[key] === officerId);
  const assignments = { ...crew.assignments };
  if (previousStation !== station) {
    assignments[previousStation] = assignments[station];
    assignments[station] = officerId;
  }
  return { ...crew, assignments, progression: structuredClone(crew.progression) };
}

export function officerAt(crew, station) {
  validateCrew(crew);
  if (!STATIONS.includes(station)) invalid('Unknown station');
  const officer = lookup(crew.assignments[station]);
  const { xp, level } = crew.progression[officer.id];
  const skill = Math.min(5, officer.skills[station] + Math.floor((level - 1) / 2));
  return { id: officer.id, name: officer.name, rank: officer.rank, level, xp, skill, station };
}

export function stationForChoice(choiceId) {
  return CHECK_STATIONS[choiceId] ?? 'command';
}

// Skill checks are resolved only by real assigned officers and stored in the event log.
// A poorly staffed key action may cause withdrawal instead of success.
export function issueCrewOrder(episode, episodeState, crew, choiceId) {
  validateCrew(crew);
  const node = currentNode(episode, episodeState);
  const command = (node.choices ?? []).find(choice => choice.id === choiceId);
  if (!command) invalid('Unavailable mission order');
  const station = stationForChoice(choiceId);
  const officer = officerAt(crew, station);
  const passed = officer.skill >= SKILL_PASS;
  const checkpoint = CHECKPOINT_CHOICES.has(choiceId);
  const base = choose(episode, episodeState, choiceId);
  const nodeId = checkpoint && !passed ? 'withdrawal' : base.nodeId;
  if (!Object.hasOwn(episode.nodes, nodeId)) invalid('Missing fallback outcome in episode');
  const stats = { ...base.stats };
  // Good staffing contributes measurable benefits, even before a terminal decision.
  if (passed && station === 'science') stats.science += 1;
  if (passed && station === 'diplomacy') stats.diplomacy += 1;
  if (passed && station === 'tactical') stats.shipDamage = Math.max(0, stats.shipDamage - 1);
  if (checkpoint && !passed) stats.shipDamage += station === 'tactical' ? 1 : 0;
  const effect = Object.fromEntries(Object.keys(stats).map(key => [key, stats[key] - episodeState.stats[key]]));
  const log = base.log.map((entry, index) => index === base.log.length - 1 ? {
    ...entry, next: nodeId, effects: effect,
    officerId: officer.id, station, skill: officer.skill,
    check: checkpoint ? (passed ? 'passed' : 'failed') : 'none',
  } : entry);
  const earned = 25 + (checkpoint && passed ? 25 : 0);
  const previous = crew.progression[officer.id];
  const xp = Math.min(1_000_000, previous.xp + earned);
  const progression = {
    ...crew.progression,
    [officer.id]: { xp, level: Math.min(MAX_LEVEL, 1 + Math.floor(xp / 100)) },
  };
  return {
    episodeState: { ...base, nodeId, stats, log },
    crew: { ...crew, assignments: { ...crew.assignments }, progression },
    report: { station, officerId: officer.id, officerName: officer.name, skill: officer.skill, check: checkpoint ? (passed ? 'passed' : 'failed') : 'none', xpEarned: earned },
  };
}
