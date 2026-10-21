// Replay-based, franchise-neutral checkpoint format; never trust stored derived state.
import { choose, startEpisode } from './episode.mjs';

export const SAVE_VERSION = 1;
export const MAX_SAVE_BYTES = 32768;
export const MAX_COMMANDS = 256;

export class SaveError extends Error {
  constructor(message) { super(message); this.name = 'SaveError'; }
}

function commandsFromState(state) {
  if (!state || !Array.isArray(state.log) || state.log.length > MAX_COMMANDS) {
    throw new SaveError('Invalid save history');
  }
  return state.log.map(entry => {
    if (typeof entry?.choiceId !== 'string' || entry.choiceId.length === 0 || entry.choiceId.length > 128) {
      throw new SaveError('Invalid saved command');
    }
    return entry.choiceId;
  });
}

export function replayCommands(episode, commands) {
  if (!Array.isArray(commands) || commands.length > MAX_COMMANDS) {
    throw new SaveError('Invalid command sequence');
  }
  let state = startEpisode(episode);
  try {
    for (const command of commands) {
      if (typeof command !== 'string' || command.length === 0 || command.length > 128) {
        throw new SaveError('Invalid command');
      }
      state = choose(episode, state, command);
    }
  } catch (error) {
    if (error instanceof SaveError) throw error;
    throw new SaveError('Save cannot be replayed against current episode');
  }
  return state;
}

export function serializeSave(episode, state) {
  const commands = commandsFromState(state);
  const canonical = replayCommands(episode, commands);
  if (state.episodeId !== canonical.episodeId || state.nodeId !== canonical.nodeId ||
      state.schemaVersion !== canonical.schemaVersion ||
      JSON.stringify(state.stats) !== JSON.stringify(canonical.stats) ||
      JSON.stringify(state.log) !== JSON.stringify(canonical.log)) {
    throw new SaveError('Save state does not match event history');
  }
  return JSON.stringify({ saveVersion: SAVE_VERSION, episodeId: episode.id, commands });
}

export function deserializeSave(episode, raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_SAVE_BYTES) {
    throw new SaveError('Missing or excessive checkpoint data');
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new SaveError('Malformed checkpoint JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.saveVersion !== SAVE_VERSION || data.episodeId !== episode.id || !Array.isArray(data.commands)) {
    throw new SaveError('Unsupported checkpoint version or episode');
  }
  return replayCommands(episode, data.commands);
}
