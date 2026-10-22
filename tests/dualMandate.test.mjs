import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MandateError, MAX_MANDATE_ACTIONS, startMandate, validateMandate,
  applyMandateAction, replayMandateActions, publicMandateReport,
  classifiedMandateReport, serializeMandateCheckpoint, deserializeMandateCheckpoint,
} from '../src/dualMandate.mjs';

const definition = {
  version: 1, id: 'outpost-incident', actors: ['captain', 'medic', 'science', 'first-officer'],
  orders: [
    { id: 'evacuate', channel: 'official', title: 'Evacuate civilian outpost' },
    { id: 'recover-core', channel: 'covert', title: 'Recover classified sensor core' },
  ],
};
const act = (actions, def = definition) => actions.reduce(
  (state, action) => applyMandateAction(def, state, action), startMandate(def)
);
const publicRescue = {
  type: 'record', incidentId: 'survivors-evacuated', orderId: 'evacuate',
  kind: 'rescue', witnesses: ['medic'], public: true,
};
const covertEvidence = {
  type: 'record', incidentId: 'sensor-data-taken', orderId: 'recover-core',
  kind: 'evidence', witnesses: ['science'], public: false,
};

test('a valid mission genuinely has separate public and covert orders', () => {
  assert.equal(validateMandate(definition), true);
  const state = startMandate(definition);
  assert.deepEqual(state.orders, { evacuate: 'active', 'recover-core': 'active' });
  assert.deepEqual(state.incidents, []);
  assert.deepEqual(state.knowledge.medic, []);
  assert.deepEqual(state.actions, []);
  assert.equal(publicMandateReport(definition, state).orders.length, 1);
  assert.equal(classifiedMandateReport(definition, state).orders.length, 2);
});

test('rescuing civilians and recovering evidence create different auditable service records', () => {
  const before = startMandate(definition);
  const events = [
    publicRescue, covertEvidence,
    { type: 'resolve', orderId: 'evacuate', incidentId: 'survivors-evacuated', status: 'completed' },
    { type: 'resolve', orderId: 'recover-core', incidentId: 'sensor-data-taken', status: 'completed' },
  ];
  const state = act(events);
  assert.deepEqual(before.orders, { evacuate: 'active', 'recover-core': 'active' });
  assert.equal(before.actions.length, 0);
  assert.equal(state.actions.length, 4);
  assert.deepEqual(state.knowledge.medic, ['survivors-evacuated']);
  assert.deepEqual(state.knowledge.science, ['sensor-data-taken']);
  assert.deepEqual(state.knowledge['first-officer'], []);
  assert.deepEqual(state.knowledge.captain, ['survivors-evacuated', 'sensor-data-taken']);
  assert.deepEqual(publicMandateReport(definition, state), {
    mandateId: 'outpost-incident',
    orders: [{ id: 'evacuate', title: 'Evacuate civilian outpost', status: 'completed' }],
    incidents: [{ id: 'survivors-evacuated', kind: 'rescue', orderId: 'evacuate' }],
  });
  const hidden = classifiedMandateReport(definition, state);
  assert.equal(hidden.orders[1].status, 'completed');
  assert.deepEqual(hidden.incidents[1].knownBy, ['captain', 'science']);
  assert.equal(hidden.incidents[1].orderId, 'recover-core');
  assert.deepEqual(replayMandateActions(definition, events), state);
});

test('an incident only reaches another officer after a sourced information transfer', () => {
  const before = act([covertEvidence]);
  assert.deepEqual(before.knowledge['first-officer'], []);
  assert.throws(() => applyMandateAction(definition, before, {
    type: 'inform', incidentId: 'sensor-data-taken', from: 'medic', to: 'first-officer',
  }), MandateError);
  const informed = applyMandateAction(definition, before, {
    type: 'inform', incidentId: 'sensor-data-taken', from: 'science', to: 'first-officer',
  });
  assert.deepEqual(informed.knowledge['first-officer'], ['sensor-data-taken']);
  assert.deepEqual(before.knowledge['first-officer'], []);
  assert.deepEqual(classifiedMandateReport(definition, informed).incidents[0].knownBy,
    ['captain', 'science', 'first-officer']);
  assert.throws(() => applyMandateAction(definition, informed, {
    type: 'inform', incidentId: 'sensor-data-taken', from: 'science', to: 'first-officer',
  }), MandateError);
  assert.equal(publicMandateReport(definition, informed).incidents.length, 0);
});

test('captain can intentionally disclose evidence without automatically publishing classified orders', () => {
  const state = act([covertEvidence, { type: 'publish', incidentId: 'sensor-data-taken' }]);
  assert.deepEqual(publicMandateReport(definition, state), {
    mandateId: 'outpost-incident',
    orders: [{ id: 'evacuate', title: 'Evacuate civilian outpost', status: 'active' }],
    incidents: [{ id: 'sensor-data-taken', kind: 'evidence', orderId: null }],
  });
  assert.equal(classifiedMandateReport(definition, state).orders[1].title, 'Recover classified sensor core');
  assert.throws(() => act([covertEvidence, { type: 'publish', incidentId: 'sensor-data-taken' },
    { type: 'publish', incidentId: 'sensor-data-taken' }]), MandateError);
  assert.throws(() => act([{ ...covertEvidence, public: true }]), MandateError);
});

test('refusing secret orders has a real documented consequence, not a false-choice button', () => {
  const refusal = {
    type: 'record', incidentId: 'declined-directive', orderId: 'recover-core',
    kind: 'refusal', witnesses: [], public: false,
  };
  const state = act([
    refusal,
    { type: 'resolve', orderId: 'recover-core', incidentId: 'declined-directive', status: 'refused' },
  ]);
  assert.equal(classifiedMandateReport(definition, state).orders[1].status, 'refused');
  assert.equal(publicMandateReport(definition, state).orders[0].status, 'active');
  assert.deepEqual(classifiedMandateReport(definition, state).incidents[0].knownBy, ['captain']);
  assert.throws(() => act([refusal, {
    type: 'resolve', orderId: 'recover-core', incidentId: 'declined-directive', status: 'completed',
  }]), MandateError);
});

test('resolve orders only against real compatible incidents; no fabricated history', () => {
  const invalid = [
    { type: 'resolve', orderId: 'evacuate', incidentId: 'absent', status: 'completed' },
    { type: 'resolve', orderId: 'recover-core', incidentId: 'survivors-evacuated', status: 'completed' },
  ];
  for (const action of invalid) {
    assert.throws(() => applyMandateAction(definition, act([publicRescue]), action), MandateError);
  }
  assert.throws(() => act([publicRescue, publicRescue]), MandateError);
  assert.throws(() => act([
    publicRescue, { type: 'resolve', orderId: 'evacuate', incidentId: 'survivors-evacuated', status: 'completed' },
    { type: 'record', incidentId: 'late-report', orderId: 'evacuate',
      kind: 'support', witnesses: [], public: true },
  ]), MandateError);
});

test('v1 checkpoint stores only events, restores both records and refuses altered statistics', () => {
  const state = act([
    publicRescue, covertEvidence,
    { type: 'inform', incidentId: 'sensor-data-taken', from: 'science', to: 'first-officer' },
    { type: 'resolve', orderId: 'evacuate', incidentId: 'survivors-evacuated', status: 'completed' },
  ]);
  const raw = serializeMandateCheckpoint(definition, state);
  assert.deepEqual(JSON.parse(raw), {
    saveVersion: 1, mandateId: 'outpost-incident', actions: state.actions,
  });
  const restored = deserializeMandateCheckpoint(definition, raw);
  assert.deepEqual(restored, state);
  assert.deepEqual(publicMandateReport(definition, restored), publicMandateReport(definition, state));
  assert.deepEqual(classifiedMandateReport(definition, restored), classifiedMandateReport(definition, state));
  const fabricated = { ...state, orders: { ...state.orders, 'recover-core': 'completed' } };
  assert.throws(() => serializeMandateCheckpoint(definition, fabricated), MandateError);
  assert.throws(() => applyMandateAction(definition, fabricated, {
    type: 'resolve', orderId: 'recover-core', incidentId: 'sensor-data-taken', status: 'completed',
  }), MandateError);
});

test('strict schema rejects invalid actors, duplicate order IDs and dangerous extra event fields', () => {
  const bad = [
    { ...definition, actors: ['captain', 'captain'] },
    { ...definition, actors: ['medic', 'science'] },
    { ...definition, orders: [definition.orders[0], definition.orders[0]] },
    { ...definition, orders: [definition.orders[0]] },
    { ...definition, id: '__proto__' },
    { ...definition, orders: [{ ...definition.orders[0], payload: 'invented' }, definition.orders[1]] },
  ];
  for (const def of bad) assert.throws(() => startMandate(def), MandateError);
  assert.throws(() => act([{ ...publicRescue, covertId: 'recover-core' }]), MandateError);
  assert.throws(() => act([{ ...publicRescue, witnesses: ['science', 'science'] }]), MandateError);
  assert.throws(() => act([{ ...publicRescue, witnesses: ['unknown'] }]), MandateError);
});

test('malformed, future and cross-mission saves fail without altering the existing Border Signal save', () => {
  const original = startMandate(definition);
  for (const raw of ['{', '{}', '', JSON.stringify({ saveVersion: 999, mandateId: definition.id, actions: [] }),
    JSON.stringify({ saveVersion: 1, mandateId: 'other', actions: [] }),
    JSON.stringify({ saveVersion: 1, mandateId: definition.id, actions: [{}] }),
    'x'.repeat(32769)]) {
    assert.throws(() => deserializeMandateCheckpoint(definition, raw), MandateError);
  }
  assert.deepEqual(original, startMandate(definition));
});

test('bounded event histories cannot grow indefinitely', () => {
  const events = [];
  for (let i = 0; i < MAX_MANDATE_ACTIONS; i++) {
    events.push({
      type: 'record', incidentId: 'event-' + i, orderId: 'evacuate',
      kind: 'support', witnesses: [], public: false,
    });
  }
  const final = replayMandateActions(definition, events);
  assert.equal(final.actions.length, MAX_MANDATE_ACTIONS);
  assert.throws(() => applyMandateAction(definition, final, {
    type: 'record', incidentId: 'extra-event', orderId: 'evacuate',
    kind: 'support', witnesses: [], public: false,
  }), MandateError);
});
