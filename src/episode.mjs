// A dependency-free, franchise-neutral, deterministic episode engine.
const EFFECT_KEYS = new Set(['science', 'diplomacy', 'shipDamage']);

export class EpisodeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EpisodeError';
  }
}

const fail = (message) => { throw new EpisodeError(message); };
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateEpisode(episode) {
  if (!plain(episode) || !nonempty(episode.id) || episode.version !== 1 ||
      !nonempty(episode.start) || !plain(episode.nodes)) {
    fail('Invalid episode envelope');
  }
  const entries = Object.entries(episode.nodes);
  if (!entries.length || !Object.hasOwn(episode.nodes, episode.start)) {
    fail('Episode needs a valid start node');
  }
  for (const [id, node] of entries) {
    if (!nonempty(id) || !plain(node) || !nonempty(node.text)) {
      fail('Invalid node: ' + id);
    }
    if (node.outcome !== undefined) {
      if (!nonempty(node.outcome) || (node.choices !== undefined && node.choices.length !== 0)) {
        fail('Terminal node must have an outcome and no choices: ' + id);
      }
      continue;
    }
    if (!Array.isArray(node.choices) || !node.choices.length) {
      fail('Nonterminal node has no choices: ' + id);
    }
    const choiceIds = new Set();
    for (const choice of node.choices) {
      if (!plain(choice) || !nonempty(choice.id) || !nonempty(choice.label) ||
          !nonempty(choice.next) || !Object.hasOwn(episode.nodes, choice.next)) {
        fail('Invalid choice in node: ' + id);
      }
      if (choiceIds.has(choice.id)) fail('Duplicate choice: ' + choice.id);
      choiceIds.add(choice.id);
      if (choice.effects !== undefined) {
        if (!plain(choice.effects)) fail('Invalid effects: ' + choice.id);
        for (const [key, delta] of Object.entries(choice.effects)) {
          if (!EFFECT_KEYS.has(key) || !Number.isSafeInteger(delta) || Math.abs(delta) > 100) {
            fail('Invalid effect for choice: ' + choice.id);
          }
        }
      }
    }
  }

  const reachable = new Set();
  const visit = (id) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const choice of episode.nodes[id].choices ?? []) visit(choice.next);
  };
  visit(episode.start);
  if (reachable.size !== entries.length) fail('Unreachable episode node');

  // For every node, some path must eventually lead to a terminal outcome.
  const canFinish = (id, visiting = new Set()) => {
    if (episode.nodes[id].outcome !== undefined) return true;
    if (visiting.has(id)) return false;
    const next = new Set(visiting);
    next.add(id);
    return episode.nodes[id].choices.some((choice) => canFinish(choice.next, next));
  };
  for (const [id] of entries) {
    if (!canFinish(id)) fail('Node cannot reach an outcome: ' + id);
  }
  return true;
}

export function startEpisode(episode) {
  validateEpisode(episode);
  return {
    schemaVersion: 1,
    episodeId: episode.id,
    nodeId: episode.start,
    stats: { science: 0, diplomacy: 0, shipDamage: 0 },
    log: [],
  };
}

export function currentNode(episode, state) {
  if (!plain(state) || state.schemaVersion !== 1 || state.episodeId !== episode.id ||
      !nonempty(state.nodeId) || !Object.hasOwn(episode.nodes, state.nodeId)) {
    fail('Invalid episode state');
  }
  return episode.nodes[state.nodeId];
}

export function choose(episode, state, choiceId) {
  const node = currentNode(episode, state);
  if (node.outcome !== undefined) fail('Episode already finished');
  const selected = node.choices.find((choice) => choice.id === choiceId);
  if (!selected) fail('Choice is not available');
  const stats = { ...state.stats };
  for (const [key, delta] of Object.entries(selected.effects ?? {})) {
    stats[key] += delta;
  }
  return {
    ...state,
    nodeId: selected.next,
    stats,
    log: [...state.log, {
      nodeId: state.nodeId,
      choiceId: selected.id,
      next: selected.next,
      effects: { ...(selected.effects ?? {}) },
    }],
  };
}
