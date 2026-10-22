// Binds existing campaign commands to *actually faced* shipboard stations.
// Pure rules: the UI cannot authorize remote orders by opening a panel.
import { validateExploration, faceTile } from './spatial.mjs';
import { currentNode } from './episode.mjs';
import { applyCrewAction } from './crewSession.mjs';

export class ConsoleOrderError extends Error {
  constructor(message) { super(message); this.name = 'ConsoleOrderError'; }
}

export const CONSOLE_ORDERS = Object.freeze({
  science: Object.freeze(['scan', 'broadcast']),
  communications: Object.freeze(['hail', 'mediate']),
  tactical: Object.freeze(['intercept', 'disable']),
  helm: Object.freeze(['withdraw', 'disengage']),
  command: Object.freeze(['ultimatum']),
});

export function facedConsole(world, exploration) {
  validateExploration(world, exploration);
  if (exploration.area !== 'bridge' || exploration.pending !== null) return null;
  const ahead = faceTile(exploration);
  const station = world.scenes[exploration.area].objects.find(item =>
    item.type === 'station' && item.x === ahead.x && item.y === ahead.y
  );
  if (!station || !Object.hasOwn(CONSOLE_ORDERS, station.action)) return null;
  return { id: station.id, action: station.action, label: station.label };
}

export function availableConsoleOrders(world, exploration, episode, episodeState) {
  const console = facedConsole(world, exploration);
  if (!console) return { console: null, choices: [] };
  const node = currentNode(episode, episodeState);
  const valid = CONSOLE_ORDERS[console.action];
  return {
    console,
    choices: (node.choices ?? []).filter(choice => valid.includes(choice.id)),
  };
}

export function issueConsoleOrder(world, exploration, episode, session, choiceId) {
  if (typeof choiceId !== 'string') throw new ConsoleOrderError('Invalid command');
  const { console, choices } = availableConsoleOrders(world, exploration, episode, session.episodeState);
  if (!console || !choices.some(choice => choice.id === choiceId)) {
    throw new ConsoleOrderError('You must face the appropriate bridge station to issue this order');
  }
  return applyCrewAction(episode, session, { type: 'order', choiceId });
}
