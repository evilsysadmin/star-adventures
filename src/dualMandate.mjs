// Generic, dependency-free dual-track campaign record: no franchise or UI imports.
// The true event sequence is canonical; reports are derived views, never parallel truth.
export class MandateError extends Error {
  constructor(message) { super(message); this.name = 'MandateError'; }
}
export const MANDATE_SAVE_VERSION = 1;
export const MAX_MANDATE_ACTIONS = 128;
export const MAX_MANDATE_SAVE_BYTES = 32768;
const fail = message => { throw new MandateError(message); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(x);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const channels = ['official', 'covert'];
const statuses = ['completed', 'refused', 'failed'];
const kinds = ['rescue', 'evidence', 'support', 'harm', 'refusal', 'failure'];

export function validateMandate(definition) {
  if (!exact(definition, ['version', 'id', 'actors', 'orders']) ||
      definition.version !== 1 || !id(definition.id) ||
      !Array.isArray(definition.actors) || definition.actors.length < 2 ||
      definition.actors.length > 16 || !definition.actors.every(id) ||
      new Set(definition.actors).size !== definition.actors.length ||
      !definition.actors.includes('captain') ||
      !Array.isArray(definition.orders) || definition.orders.length < 2 ||
      definition.orders.length > 12) fail('Invalid mandate definition');
  const seen = new Set();
  const tracks = new Set();
  for (const order of definition.orders) {
    if (!exact(order, ['id', 'channel', 'title']) ||
        !id(order.id) || seen.has(order.id) ||
        !channels.includes(order.channel) ||
        typeof order.title !== 'string' || !order.title.trim() ||
        order.title.length > 160) fail('Invalid or duplicate mandate order');
    seen.add(order.id);
    tracks.add(order.channel);
  }
  if (tracks.size !== 2) fail('A mandate requires real official and covert orders');
  return true;
}

export function startMandate(definition) {
  validateMandate(definition);
  return {
    version: 1, mandateId: definition.id,
    orders: Object.fromEntries(definition.orders.map(order => [order.id, 'active'])),
    incidents: [],
    knowledge: Object.fromEntries(definition.actors.map(actor => [actor, []])),
    actions: [],
  };
}

function validateAction(definition, action) {
  const orders = new Map(definition.orders.map(order => [order.id, order]));
  if (!object(action) || typeof action.type !== 'string') fail('Malformed mandate command');
  if (action.type === 'record') {
    if (!exact(action, ['type', 'incidentId', 'orderId', 'kind', 'witnesses', 'public']) ||
        !id(action.incidentId) || !orders.has(action.orderId) || !kinds.includes(action.kind) ||
        typeof action.public !== 'boolean' ||
        !Array.isArray(action.witnesses) ||
        action.witnesses.length > definition.actors.length ||
        action.witnesses.some(who => !definition.actors.includes(who)) ||
        new Set(action.witnesses).size !== action.witnesses.length ||
        (action.public && orders.get(action.orderId).channel === 'covert')) {
      fail('Invalid or publicly leaked incident');
    }
  } else if (action.type === 'inform') {
    if (!exact(action, ['type', 'incidentId', 'from', 'to']) ||
        !id(action.incidentId) ||
        !definition.actors.includes(action.from) || !definition.actors.includes(action.to) ||
        action.from === action.to) fail('Invalid information transfer');
  } else if (action.type === 'resolve') {
    if (!exact(action, ['type', 'orderId', 'incidentId', 'status']) ||
        !orders.has(action.orderId) || !id(action.incidentId) ||
        !statuses.includes(action.status)) fail('Invalid order resolution');
  } else if (action.type === 'publish') {
    if (!exact(action, ['type', 'incidentId']) || !id(action.incidentId))
      fail('Invalid public disclosure');
  } else fail('Unknown mandate command');
}

function appendKnowledge(knowledge, actor, incidentId) {
  if (!knowledge[actor].includes(incidentId)) knowledge[actor].push(incidentId);
}

function applyCommand(definition, state, action) {
  validateAction(definition, action);
  if (state.actions.length >= MAX_MANDATE_ACTIONS) fail('Mandate history limit reached');
  const orders = { ...state.orders };
  const incidents = state.incidents.map(incident => ({ ...incident, witnesses: [...incident.witnesses] }));
  const knowledge = Object.fromEntries(Object.entries(state.knowledge).map(([actor, known]) => [actor, [...known]]));
  const event = { ...action };
  if (event.type === 'record') {
    if (incidents.some(item => item.id === event.incidentId)) fail('Duplicate incident');
    if (orders[event.orderId] !== 'active') fail('Incident after resolved order');
    incidents.push({
      id: event.incidentId, orderId: event.orderId, kind: event.kind,
      public: event.public, witnesses: [...event.witnesses],
    });
    appendKnowledge(knowledge, 'captain', event.incidentId);
    for (const witness of event.witnesses) appendKnowledge(knowledge, witness, event.incidentId);
    event.witnesses = [...event.witnesses];
  } else if (event.type === 'inform') {
    if (!incidents.some(item => item.id === event.incidentId) ||
        !knowledge[event.from].includes(event.incidentId) ||
        knowledge[event.to].includes(event.incidentId)) {
      fail('Information must originate from a real informed witness');
    }
    appendKnowledge(knowledge, event.to, event.incidentId);
  } else if (event.type === 'resolve') {
    const incident = incidents.find(item => item.id === event.incidentId);
    if (orders[event.orderId] !== 'active' || !incident ||
        incident.orderId !== event.orderId ||
        (event.status === 'completed' && ['failure', 'refusal'].includes(incident.kind)) ||
        (event.status === 'refused' && incident.kind !== 'refusal') ||
        (event.status === 'failed' && incident.kind !== 'failure')) {
      fail('Order outcome must reference a real compatible incident');
    }
    orders[event.orderId] = event.status;
  } else if (event.type === 'publish') {
    const incident = incidents.find(item => item.id === event.incidentId);
    if (!incident || incident.public) fail('Cannot publish a missing/already public incident');
    incident.public = true;
  }
  return {
    version: 1, mandateId: definition.id,
    orders, incidents, knowledge, actions: [...state.actions, event],
  };
}

export function replayMandateActions(definition, actions) {
  const start = startMandate(definition);
  if (!Array.isArray(actions) || actions.length > MAX_MANDATE_ACTIONS)
    fail('Invalid mandate history');
  return actions.reduce((state, action) => applyCommand(definition, state, action), start);
}

export function applyMandateAction(definition, state, action) {
  if (!object(state) || !Array.isArray(state.actions) ||
      JSON.stringify(replayMandateActions(definition, state.actions)) !== JSON.stringify(state)) {
    fail('Mandate state is not consistent with its recorded history');
  }
  return applyCommand(definition, state, action);
}

export function publicMandateReport(definition, state) {
  // Validate against canonical history before exposing information anywhere.
  const canonical = replayMandateActions(definition, state?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(state)) fail('Untrusted mandate state');
  const official = definition.orders.filter(order => order.channel === 'official');
  const publicIds = new Set(official.map(order => order.id));
  return {
    mandateId: definition.id,
    orders: official.map(order => ({ id: order.id, title: order.title, status: state.orders[order.id] })),
    incidents: state.incidents.filter(incident => incident.public).map(incident => ({
      id: incident.id, kind: incident.kind,
      // An intentional public disclosure does not expose the secret order name/ID.
      orderId: publicIds.has(incident.orderId) ? incident.orderId : null,
    })),
  };
}

export function classifiedMandateReport(definition, state) {
  const canonical = replayMandateActions(definition, state?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(state)) fail('Untrusted mandate state');
  return {
    mandateId: definition.id,
    orders: definition.orders.map(order => ({
      id: order.id, channel: order.channel, title: order.title,
      status: state.orders[order.id],
    })),
    incidents: state.incidents.map(incident => ({
      ...incident, witnesses: [...incident.witnesses],
      knownBy: definition.actors.filter(actor => state.knowledge[actor].includes(incident.id)),
    })),
  };
}

export function serializeMandateCheckpoint(definition, state) {
  const canonical = replayMandateActions(definition, state?.actions);
  if (JSON.stringify(canonical) !== JSON.stringify(state)) fail('Refusing fabricated mandate state');
  const raw = JSON.stringify({
    saveVersion: MANDATE_SAVE_VERSION, mandateId: definition.id,
    actions: canonical.actions,
  });
  if (raw.length > MAX_MANDATE_SAVE_BYTES) fail('Mandate checkpoint too large');
  return raw;
}

export function deserializeMandateCheckpoint(definition, raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MANDATE_SAVE_BYTES) fail('Invalid mandate checkpoint');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('Malformed mandate checkpoint'); }
  if (!exact(parsed, ['saveVersion', 'mandateId', 'actions']) ||
      parsed.saveVersion !== MANDATE_SAVE_VERSION || parsed.mandateId !== definition.id) {
    fail('Unsupported or mismatched mandate checkpoint');
  }
  return replayMandateActions(definition, parsed.actions);
}
