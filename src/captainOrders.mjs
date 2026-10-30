// Seated bridge command: station selection is explicit, never a fabricated walk.
import { validateExploration } from './spatial.mjs';
import { CONSOLE_ORDERS, ConsoleOrderError } from './consoleOrders.mjs';
import { currentNode } from './episode.mjs';
import { applyCrewAction } from './crewSession.mjs';

export function captainConsole(world, exploration, stationId) {
  validateExploration(world, exploration);
  const station = exploration.area === 'bridge' && exploration.pending === null
    ? world.scenes.bridge.objects.find(item => item.id === stationId && item.type === 'station' &&
      Object.hasOwn(CONSOLE_ORDERS, item.action)) : null;
  return station ? { id: station.id, action: station.action, label: station.label } : null;
}

export function captainOrders(world, exploration, episode, state, stationId) {
  const console = captainConsole(world, exploration, stationId);
  if (!console) return { console: null, choices: [] };
  return { console,
    choices: (currentNode(episode, state).choices ?? []).filter(choice =>
      CONSOLE_ORDERS[console.action].includes(choice.id)) };
}

export function issueCaptainOrder(world, exploration, episode, session, stationId, choiceId) {
  const access = captainOrders(world, exploration, episode, session.episodeState, stationId);
  if (!access.choices.some(choice => choice.id === choiceId))
    throw new ConsoleOrderError('This station cannot issue this captain order');
  return applyCrewAction(episode, session, { type: 'order', choiceId });
}

export function requestCaptainTransport(world, exploration) {
  validateExploration(world, exploration);
  if (exploration.area !== 'bridge' || exploration.pending !== null)
    throw new ConsoleOrderError('Transport requires an available bridge');
  const target = world.scenes.bridge.objects.find(item => item.type === 'transition' && item.to === 'surface');
  if (!target) throw new ConsoleOrderError('No surface transport available');
  return { state: { ...exploration, pending: { id: target.id, to: target.to } },
    event: { type: 'transition-offered', target: target.to, label: target.label } };
}
