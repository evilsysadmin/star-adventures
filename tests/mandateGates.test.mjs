import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MandateError, startMandate, applyMandateAction, serializeMandateCheckpoint,
  deserializeMandateCheckpoint,
} from '../src/dualMandate.mjs';
import { evaluateMandateGate, eligibleMandateBranches } from '../src/mandateGates.mjs';

const definition = {
  version: 1, id: 'outpost', actors: ['captain', 'medic', 'first-officer'],
  orders: [
    { id: 'evacuate', channel: 'official', title: 'Civilian rescue' },
    { id: 'recover', channel: 'covert', title: 'Secure evidence' },
  ],
};
const rescue = { type: 'record', incidentId: 'evacuees', orderId: 'evacuate',
  kind: 'rescue', witnesses: ['medic'], public: true };
const evidence = { type: 'record', incidentId: 'core', orderId: 'recover',
  kind: 'evidence', witnesses: [], public: false };
const run = actions => actions.reduce((state, action) =>
  applyMandateAction(definition, state, action), startMandate(definition));
const orderGate = (orderId, status) => ({ type: 'order-status', orderId, status });
const incidentGate = (orderId, kind, published) => ({
  type: 'incident', orderId, kind, public: published,
});

test('a branch remains unavailable until an actual compatible event and order resolution exist', () => {
  const gate = { type: 'all', gates: [
    orderGate('evacuate', 'completed'), incidentGate('evacuate', 'rescue', true),
  ] };
  assert.equal(evaluateMandateGate(definition, startMandate(definition), gate), false);
  assert.equal(evaluateMandateGate(definition, run([rescue]), gate), false);
  const saved = run([rescue, {
    type: 'resolve', orderId: 'evacuate', incidentId: 'evacuees', status: 'completed',
  }]);
  assert.equal(evaluateMandateGate(definition, saved, gate), true);
  assert.equal(evaluateMandateGate(definition,
    deserializeMandateCheckpoint(definition, serializeMandateCheckpoint(definition, saved)), gate), true);
});

test('knowledge and publication only unlock branches after genuine disclosure', () => {
  const known = { type: 'actor-knows', actorId: 'first-officer', incidentId: 'core' };
  const published = { type: 'published', incidentId: 'core' };
  const initial = run([evidence]);
  assert.equal(evaluateMandateGate(definition, initial, known), false);
  assert.equal(evaluateMandateGate(definition, initial, published), false);
  const informed = applyMandateAction(definition, initial, {
    type: 'inform', incidentId: 'core', from: 'captain', to: 'first-officer',
  });
  assert.equal(evaluateMandateGate(definition, informed, known), true);
  assert.equal(evaluateMandateGate(definition, informed, published), false);
  const disclosed = applyMandateAction(definition, informed,
    { type: 'publish', incidentId: 'core' });
  assert.equal(evaluateMandateGate(definition, disclosed, published), true);
  assert.deepEqual(initial.knowledge['first-officer'], []);
  assert.equal(initial.incidents[0].public, false);
});

test('explicit refusal creates a distinct sequel from completed relief and covert recovery', () => {
  const refusal = { type: 'record', incidentId: 'refused', orderId: 'recover',
    kind: 'refusal', witnesses: [], public: false };
  const state = run([rescue,
    { type: 'resolve', orderId: 'evacuate', incidentId: 'evacuees', status: 'completed' },
    refusal,
    { type: 'resolve', orderId: 'recover', incidentId: 'refused', status: 'refused' },
  ]);
  const branches = [
    { id: 'relief-report', audience: 'official', when: orderGate('evacuate', 'completed') },
    { id: 'handler-refusal', audience: 'classified', when: orderGate('recover', 'refused') },
    { id: 'handler-delivery', audience: 'classified', when: orderGate('recover', 'completed') },
  ];
  assert.deepEqual(eligibleMandateBranches(definition, state, branches, 'official'), ['relief-report']);
  assert.deepEqual(eligibleMandateBranches(definition, state, branches, 'classified'), ['handler-refusal']);
  assert.deepEqual(eligibleMandateBranches(definition, startMandate(definition), branches, 'classified'), []);
});

test('compound alternatives preserve deterministic semantics and do not treat lack of evidence as harm', () => {
  const gate = { type: 'any', gates: [
    incidentGate('evacuate', 'harm', true),
    orderGate('evacuate', 'failed'),
  ] };
  assert.equal(evaluateMandateGate(definition, run([rescue]), gate), false);
  const harm = { type: 'record', incidentId: 'injuries', orderId: 'evacuate',
    kind: 'harm', witnesses: ['medic'], public: true };
  assert.equal(evaluateMandateGate(definition, run([harm]), gate), true);
  assert.equal(evaluateMandateGate(definition, run([evidence]), gate), false);
});

test('malformed, unknown, unbounded and covert-in-public gates fail closed', () => {
  const state = run([evidence]);
  const invalid = [
    { type: 'order-status', orderId: 'not-an-order', status: 'completed' },
    { type: 'order-status', orderId: 'evacuate', status: 'invented' },
    { type: 'published', incidentId: '__proto__' },
    { type: 'actor-knows', actorId: 'outsider', incidentId: 'core' },
    { type: 'all', gates: [] },
    { type: 'any', gates: Array(9).fill(orderGate('evacuate', 'active')) },
    { type: 'order-status', orderId: 'evacuate', status: 'active', injected: true },
    { type: 'all', gates: [{ type: 'all', gates: [{ type: 'all', gates: [
      { type: 'all', gates: [{ type: 'all', gates: [{ type: 'all', gates: [orderGate('evacuate', 'active')] }] }] },
    ] }] }] },
  ];
  for (const gate of invalid) assert.throws(() => evaluateMandateGate(definition, state, gate), MandateError);
  assert.throws(() => eligibleMandateBranches(definition, state, [{
    id: 'leak', audience: 'official', when: orderGate('recover', 'completed'),
  }], 'official'), MandateError);
  assert.throws(() => eligibleMandateBranches(definition, state, [
    { id: 'same', audience: 'official', when: orderGate('evacuate', 'active') },
    { id: 'same', audience: 'classified', when: orderGate('recover', 'active') },
  ], 'official'), MandateError);
});

test('fabricated state cannot influence a future branch despite a plausible status', () => {
  const state = run([rescue]);
  const forged = { ...state, orders: { ...state.orders, recover: 'completed' } };
  assert.throws(() => evaluateMandateGate(definition, forged,
    orderGate('recover', 'completed')), MandateError);
  assert.throws(() => eligibleMandateBranches(definition, forged, [], 'classified'), MandateError);
});
