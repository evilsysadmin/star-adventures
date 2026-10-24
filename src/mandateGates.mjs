// Pure, deterministic eligibility conditions for future narrative branches.
// Only canonical, replay-verified dual-mandate history can unlock a branch.
import { MandateError, classifiedMandateReport, validateMandate } from './dualMandate.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, keys) => isObject(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(value);
const statuses = ['active', 'completed', 'failed', 'refused'];
const kinds = ['rescue', 'evidence', 'support', 'harm', 'refusal', 'failure'];
const channels = ['official', 'classified'];
const fail = message => { throw new MandateError(message); };

function validateGate(gate, context, depth, budget) {
  if (++budget.nodes > 32 || depth > 4 || !isObject(gate)) fail('Invalid or oversized mandate gate');
  if (gate.type === 'all' || gate.type === 'any') {
    if (!keysAre(gate, ['type', 'gates']) || !Array.isArray(gate.gates) ||
        gate.gates.length === 0 || gate.gates.length > 8) fail('Invalid compound mandate gate');
    for (const child of gate.gates) validateGate(child, context, depth + 1, budget);
  } else if (gate.type === 'order-status') {
    if (!keysAre(gate, ['type', 'orderId', 'status']) || !context.orders.has(gate.orderId) ||
        !statuses.includes(gate.status)) fail('Invalid order-status gate');
  } else if (gate.type === 'incident') {
    if (!keysAre(gate, ['type', 'orderId', 'kind', 'public']) ||
        !context.orders.has(gate.orderId) || !kinds.includes(gate.kind) ||
        typeof gate.public !== 'boolean') fail('Invalid incident gate');
  } else if (gate.type === 'actor-knows') {
    if (!keysAre(gate, ['type', 'actorId', 'incidentId']) ||
        !context.actors.has(gate.actorId) || !isId(gate.incidentId)) fail('Invalid knowledge gate');
  } else if (gate.type === 'published') {
    if (!keysAre(gate, ['type', 'incidentId']) || !isId(gate.incidentId))
      fail('Invalid publication gate');
  } else fail('Unknown mandate gate');
}

function matches(gate, report, state) {
  switch (gate.type) {
    case 'all': return gate.gates.every(child => matches(child, report, state));
    case 'any': return gate.gates.some(child => matches(child, report, state));
    case 'order-status': return report.orders.some(order =>
      order.id === gate.orderId && order.status === gate.status);
    case 'incident': return report.incidents.some(incident =>
      incident.orderId === gate.orderId && incident.kind === gate.kind &&
      incident.public === gate.public);
    case 'actor-knows': return state.knowledge[gate.actorId].includes(gate.incidentId);
    case 'published': return report.incidents.some(incident =>
      incident.id === gate.incidentId && incident.public);
    default: throw new MandateError('Unknown mandate gate');
  }
}

function assertContext(definition, state) {
  validateMandate(definition);
  const report = classifiedMandateReport(definition, state); // Replays every event; rejects fabricated state.
  return { report, context: {
    orders: new Map(definition.orders.map(order => [order.id, order.channel])),
    actors: new Set(definition.actors),
  } };
}

/** True only for events actually established in this mandate history. */
export function evaluateMandateGate(definition, state, gate) {
  const { report, context } = assertContext(definition, state);
  validateGate(gate, context, 0, { nodes: 0 });
  return matches(gate, report, state);
}

/** Return stable IDs only: the caller owns the actual UI and action implementation.
 * Official branches must never depend on the status of a classified order.
 * No branch creates an incident, changes reputation or invents an outcome.
 */
export function eligibleMandateBranches(definition, state, branches, audience) {
  const { report, context } = assertContext(definition, state);
  if (!channels.includes(audience) || !Array.isArray(branches) || branches.length > 24)
    fail('Invalid mandate branch catalogue or audience');
  const seen = new Set();
  for (const branch of branches) {
    if (!keysAre(branch, ['id', 'audience', 'when']) || !isId(branch.id) ||
        seen.has(branch.id) || !channels.includes(branch.audience)) fail('Invalid mandate branch');
    seen.add(branch.id);
    validateGate(branch.when, context, 0, { nodes: 0 });
    if (branch.audience === 'official' && referencesClassifiedOrder(branch.when, context))
      fail('Public branch cannot test a classified order');
  }
  return branches.filter(branch => branch.audience === audience &&
    matches(branch.when, report, state)).map(branch => branch.id);
}

function referencesClassifiedOrder(gate, context) {
  if (gate.type === 'all' || gate.type === 'any')
    return gate.gates.some(child => referencesClassifiedOrder(child, context));
  return (gate.type === 'order-status' || gate.type === 'incident') &&
    context.orders.get(gate.orderId) === 'covert';
}
