import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew } from '../src/crew.mjs';
import { startAwayTeam, selectAwayOfficer } from '../src/awayTeam.mjs';
import { validateWorld } from '../src/spatial.mjs';
import {
  MandateError, startMandate, publicMandateReport, classifiedMandateReport,
  serializeMandateCheckpoint, deserializeMandateCheckpoint,
} from '../src/dualMandate.mjs';
import {
  performMedicalEvacuation, EVACUATION_STATION_ACTION, EVACUATION_INCIDENT,
} from '../src/medicalEvacuation.mjs';

const definition = JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json', import.meta.url)));
const originalWorld = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const world = originalWorld;
const noReliefStation = structuredClone(world);
noReliefStation.scenes.surface.objects = noReliefStation.scenes.surface.objects.filter(
  item => item.action !== EVACUATION_STATION_ACTION
);
const front = { version: 1, area: 'surface', x: 5, y: 4, heading: 'E', pending: null };
const onBridge = { ...front, area: 'bridge' };
const fromOtherSide = { ...front, heading: 'W' };

test('one real medical intervention rescues civilians and persists official + classified truth', () => {
  assert.equal(validateWorld(world), true);
  const starting = startMandate(definition);
  const attempt = performMedicalEvacuation(definition, starting, world, front, startCrew(), startAwayTeam());
  assert.deepEqual(attempt.report, { result: 'evacuated', officerId: 'mira', skill: 4 });
  assert.equal(attempt.state.orders.evacuate, 'completed');
  assert.deepEqual(publicMandateReport(definition, attempt.state).incidents.find(x => x.id === EVACUATION_INCIDENT), {
    id: EVACUATION_INCIDENT, kind: 'rescue', orderId: 'evacuate',
  });
  const classified = classifiedMandateReport(definition, attempt.state);
  assert.deepEqual(classified.incidents.find(x => x.id === EVACUATION_INCIDENT).knownBy, ['captain', 'mira']);
  assert.deepEqual(starting.actions, []);
  const replayed = deserializeMandateCheckpoint(definition,
    serializeMandateCheckpoint(definition, attempt.state));
  assert.deepEqual(replayed, attempt.state);
  assert.deepEqual(publicMandateReport(definition, replayed), publicMandateReport(definition, attempt.state));
});

test('underqualified squad cannot turn a rescue request into reported success', () => {
  const bridge = { version: 1, area: 'bridge', x: 3, y: 5, heading: 'N', pending: null };
  let away = startAwayTeam();
  away = selectAwayOfficer(away, 0, 'varela', bridge);
  away = selectAwayOfficer(away, 1, 'solan', bridge);
  away = selectAwayOfficer(away, 2, 'dorn', bridge);
  const state = startMandate(definition);
  const result = performMedicalEvacuation(definition, state, world, front, startCrew(), away);
  assert.deepEqual(result.report, { result: 'insufficient-medical', officerId: 'varela', skill: 1 });
  assert.equal(result.state, state, 'failed competence check must not mutate existing events');
  assert.deepEqual(result.state.incidents, []);
  assert.equal(publicMandateReport(definition, state).orders.find(x => x.id === 'evacuate').status, 'active');
});

test('bridge, incorrect orientation, missing relief station and pending transition fail closed', () => {
  const baseline = startMandate(definition);
  for (const [scene, position] of [
    [world, onBridge], [world, fromOtherSide], [noReliefStation, front],
    [world, { ...front, pending: { id:'beam-out', to:'bridge' } }],
  ]) {
    assert.throws(() => performMedicalEvacuation(definition, baseline, scene, position,
      startCrew(), startAwayTeam()));
  }
  assert.deepEqual(baseline.actions, []);
});

test('duplicate awards, inconsistent history and wrong source schema are rejected', () => {
  const initial = startMandate(definition);
  const first = performMedicalEvacuation(definition, initial, world, front,
    startCrew(), startAwayTeam()).state;
  assert.throws(() => performMedicalEvacuation(definition, first, world, front,
    startCrew(), startAwayTeam()), MandateError);
  const forged = { ...initial, orders: { ...initial.orders, evacuate: 'completed' } };
  assert.throws(() => performMedicalEvacuation(definition, forged, world, front,
    startCrew(), startAwayTeam()), MandateError);
  const withoutEvacuation = { ...definition, orders: definition.orders.filter(x => x.id !== 'evacuate') };
  assert.throws(() => performMedicalEvacuation(withoutEvacuation, startMandate(withoutEvacuation),
    world, front, startCrew(), startAwayTeam()), MandateError);
});
