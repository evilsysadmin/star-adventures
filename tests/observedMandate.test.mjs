import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew, assignOfficer } from '../src/crew.mjs';
import { startAwayTeam, selectAwayOfficer, investigateProbe } from '../src/awayTeam.mjs';
import { startMandate, publicMandateReport, classifiedMandateReport, serializeMandateCheckpoint, deserializeMandateCheckpoint } from '../src/dualMandate.mjs';
import { reconcileObservedProbe, PROBE_SURVEY_INCIDENT, PROBE_SURVEY_ORDER } from '../src/observedMandate.mjs';

const definition = JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json', import.meta.url), 'utf8'));
const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url), 'utf8'));
const bridge = { version:1, area:'bridge', x:3, y:5, heading:'N', pending:null };
const nextToProbe = { version:1, area:'surface', x:4, y:3, heading:'N', pending:null };

test('observed scientific discovery appears in public log only after physically valid investigation', () => {
  const before = startMandate(definition);
  const squad = startAwayTeam();
  const untouched = reconcileObservedProbe(definition, before, squad);
  assert.equal(untouched, before);
  assert.equal(publicMandateReport(definition, before).orders.find(x => x.id === PROBE_SURVEY_ORDER).status, 'active');
  const field = investigateProbe(world, nextToProbe, startCrew(), squad);
  assert.equal(field.report.result, 'success');
  const after = reconcileObservedProbe(definition, before, field.state);
  assert.equal(publicMandateReport(definition, after).orders.find(x => x.id === PROBE_SURVEY_ORDER).status, 'completed');
  assert.deepEqual(publicMandateReport(definition, after).incidents, [
    { id: PROBE_SURVEY_INCIDENT, kind:'evidence', orderId:PROBE_SURVEY_ORDER },
  ]);
  assert.equal(after.actions.length, 2);
  assert.equal(after.incidents[0].witnesses[0], field.report.officerId);
  assert.deepEqual(classifiedMandateReport(definition, after).incidents[0].knownBy, ['captain', field.report.officerId]);
  assert.equal(reconcileObservedProbe(definition, after, field.state), after, 'same discovery must never be awarded twice');
  const restored = deserializeMandateCheckpoint(definition, serializeMandateCheckpoint(definition, after));
  assert.deepEqual(restored, after, 'discovery survives F5 via event replay');
  assert.deepEqual(before.incidents, [], 'domain does not mutate previous history');
});

test('a squad without science competency produces no official discovery or fabricated evidence', () => {
  let squad = startAwayTeam();
  squad = selectAwayOfficer(squad, 0, 'varela', bridge);
  squad = selectAwayOfficer(squad, 2, 'solan', bridge);
  const field = investigateProbe(world, nextToProbe, startCrew(), squad);
  assert.equal(field.report.result, 'insufficient-science');
  const before = startMandate(definition);
  assert.equal(reconcileObservedProbe(definition, before, field.state), before);
  assert.deepEqual(publicMandateReport(definition, before).incidents, []);
});

test('an invalid spatial interaction cannot fabricate an official science record', () => {
  const before = startMandate(definition);
  assert.throws(() => investigateProbe(world, bridge, startCrew(), startAwayTeam()));
  assert.equal(reconcileObservedProbe(definition, before, startAwayTeam()), before);
  assert.throws(() => reconcileObservedProbe(definition, before, {
    ...startAwayTeam(), findings:['probe-mineral-signature'], lastReport:null,
  }));
  assert.deepEqual(before.actions, []);
});

test('history discrepancies, wrong witnesses and missing official orders are rejected', () => {
  const field = investigateProbe(world, nextToProbe, startCrew(), startAwayTeam());
  const initial = startMandate(definition);
  const fake = { ...initial, orders:{ ...initial.orders, [PROBE_SURVEY_ORDER]:'completed' } };
  assert.throws(() => reconcileObservedProbe(definition, fake, field.state));
  const wrongWitness = {
    ...field.state, lastReport:{ ...field.state.lastReport, officerId:'not-a-real-officer' },
  };
  assert.throws(() => reconcileObservedProbe(definition, initial, wrongWitness));
  const noOrder = {
    ...definition, orders:definition.orders.filter(order => order.id !== PROBE_SURVEY_ORDER),
  };
  assert.throws(() => reconcileObservedProbe(noOrder, startMandate(noOrder), field.state));
});
