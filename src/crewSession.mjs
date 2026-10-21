// V2 session checkpoints are verified by replaying commands; never trust stored statistics or XP.
import { startEpisode, choose } from './episode.mjs';
import { startCrew, assignOfficer, issueCrewOrder, validateCrew } from './crew.mjs';
import { deserializeSave } from './save.mjs';

export const CREW_SAVE_VERSION = 2;
export const MAX_CREW_ACTIONS = 512;
export const MAX_CREW_SAVE_BYTES = 65536;

export class CrewSaveError extends Error {
  constructor(message) { super(message); this.name = 'CrewSaveError'; }
}
const invalid = message => { throw new CrewSaveError(message); };
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const textValue = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;

export function startCrewSession(episode) {
  return { episodeState: startEpisode(episode), crew: startCrew(), actions: [] };
}

function validateAction(action) {
  if (!plain(action) || !textValue(action.type, 24)) invalid('Invalid action');
  if (action.type === 'assign' && Object.keys(action).length === 3 &&
      textValue(action.station, 24) && textValue(action.officerId, 64)) return;
  if ((action.type === 'order' || action.type === 'legacy-order') &&
      Object.keys(action).length === 2 && textValue(action.choiceId, 128)) return;
  if (action.type === 'restart' && Object.keys(action).length === 1) return;
  invalid('Unknown or malformed crew action');
}

export function applyCrewAction(episode, session, action) {
  validateAction(action);
  if (!session || !Array.isArray(session.actions) || session.actions.length >= MAX_CREW_ACTIONS) invalid('Crew history limit reached');
  // The reducer owns all changes. No state, crew or action argument is mutated.
  let episodeState = session.episodeState;
  let crew = session.crew;
  try {
    if (action.type === 'assign') crew = assignOfficer(crew, action.station, action.officerId);
    else if (action.type === 'restart') episodeState = startEpisode(episode);
    else if (action.type === 'legacy-order') episodeState = choose(episode, episodeState, action.choiceId);
    else {
      const result = issueCrewOrder(episode, episodeState, crew, action.choiceId);
      episodeState = result.episodeState;
      crew = result.crew;
    }
  } catch {
    invalid('Crew action cannot be applied');
  }
  return { episodeState, crew, actions: [...session.actions, { ...action }] };
}

export function replayCrewActions(episode, actions) {
  if (!Array.isArray(actions) || actions.length > MAX_CREW_ACTIONS) invalid('Invalid crew command sequence');
  return actions.reduce((state, action) => applyCrewAction(episode, state, action), startCrewSession(episode));
}

export function serializeCrewCheckpoint(episode, session) {
  if (!session || !Array.isArray(session.actions)) invalid('Invalid crew session');
  const canonical = replayCrewActions(episode, session.actions);
  validateCrew(canonical.crew);
  if (!same(canonical.episodeState, session.episodeState) || !same(canonical.crew, session.crew)) invalid('Crew session disagrees with its command history');
  const raw = JSON.stringify({ saveVersion: CREW_SAVE_VERSION, episodeId: episode.id, actions: canonical.actions });
  if (raw.length > MAX_CREW_SAVE_BYTES) invalid('Crew checkpoint too large');
  return raw;
}

export function deserializeCrewCheckpoint(episode, raw) {
  if (!textValue(raw, MAX_CREW_SAVE_BYTES)) invalid('Missing or oversized crew checkpoint');
  let data;
  try { data = JSON.parse(raw); } catch { invalid('Malformed crew checkpoint JSON'); }
  if (!plain(data) || data.saveVersion !== CREW_SAVE_VERSION || data.episodeId !== episode.id || !Array.isArray(data.actions)) invalid('Unsupported crew checkpoint or episode');
  return replayCrewActions(episode, data.actions);
}

// V1 orders retain their *exact original* results. The migration never rewrites the past
// to invent skill checks, XP or ship damage that did not exist when that save was made.
export function migrateLegacyCheckpoint(episode, oldRaw) {
  let old;
  try { old = deserializeSave(episode, oldRaw); } catch { invalid('Legacy checkpoint invalid'); }
  const actions = old.log.map(({ choiceId }) => ({ type: 'legacy-order', choiceId }));
  const session = replayCrewActions(episode, actions);
  if (!same(session.episodeState, old)) invalid('Legacy checkpoint did not migrate exactly');
  return session;
}
