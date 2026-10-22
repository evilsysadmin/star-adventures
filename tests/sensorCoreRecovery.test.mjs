import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew } from '../src/crew.mjs';
import { startAwayTeam, selectAwayOfficer } from '../src/awayTeam.mjs';
import { validateWorld } from '../src/spatial.mjs';
import {
  MandateError, startMandate, applyMandateAction, publicMandateReport,
  classifiedMandateReport, serializeMandateCheckpoint, deserializeMandateCheckpoint,
} from '../src/dualMandate.mjs';
import { recoverSensorCore, CORE_STATION_ACTION, CORE_INCIDENT } from '../src/sensorCoreRecovery.mjs';

const definition = JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json', import.meta.url)));
const originalWorld = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const world = structuredClone(originalWorld);
// Use a presently blocked tile: no old saved position is displaced when authored.
world.scenes.surface.walls = world.scenes.surface.walls.filter(tile => tile.x !== 2 || tile.y !== 2);
world.scenes.surface.objects.push({
  id: 'sensor-vault', label: 'Archivo de sensores del puesto', type: 'station',
  action: CORE_STATION_ACTION, x: 2, y: 2,
});
const atCore = { version: 1, area: 'surface', x: 2, y: 3, heading: 'N', pending: null };
const bridge = { version: 1, area: 'bridge', x: 3, y: 5, heading: 'N', pending: null };
const perform = (mandate = startMandate(definition), squad = startAwayTeam(), position = atCore, scene = world) =>
  recoverSensorCore(definition, mandate, scene, position, startCrew(), squad);

test('a successful physical retrieval is classified, witnessed, replayable and cannot leak publicly', () => {
  assert.equal(validateWorld(world), true);
  const before = startMandate(definition);
  const retrieved = perform(before);
  assert.deepEqual(retrieved.report, { result: 'core-recovered', officerId: 'venn', skill: 4 });
  assert.equal(retrieved.state.orders['recover-core'], 'completed');
  assert.equal(retrieved.state.incidents[0].id, CORE_INCIDENT);
  assert.equal(retrieved.state.incidents[0].public, false);
  assert.deepEqual(classifiedMandateReport(definition, retrieved.state).incidents[0].knownBy, ['captain', 'venn']);
  assert.equal(publicMandateReport(definition, retrieved.state).incidents.length, 0);
  assert.equal(publicMandateReport(definition, retrieved.state).orders.some(o => o.id === 'recover-core'), false);
  const restored = deserializeMandateCheckpoint(definition, serializeMandateCheckpoint(definition, retrieved.state));
  assert.deepEqual(restored, retrieved.state);
  assert.deepEqual(before.actions, []);
});

test('retrieval genuinely requires a technically skilled deployed officer', () => {
  let away = startAwayTeam();
  away = selectAwayOfficer(away, 0, 'varela', bridge);
  away = selectAwayOfficer(away, 2, 'solan', bridge);
  const unchanged = startMandate(definition);
  const denied = perform(unchanged, away);
  assert.deepEqual(denied.report, { result: 'insufficient-technical', officerId: 'dorn', skill: 2 });
  assert.equal(denied.state, unchanged);
  assert.deepEqual(denied.state.incidents, []);
  const expert = selectAwayOfficer(away, 2, 'rhee', bridge);
  const restored = perform(startMandate(definition), expert);
  assert.deepEqual(restored.report, { result: 'core-recovered', officerId: 'rhee', skill: 4 });
});

test('remote retrieval, wrong heading, wrong station and pending transport cannot mint evidence', () => {
  const initial = startMandate(definition);
  const noStation = structuredClone(world);
  noStation.scenes.surface.objects = noStation.scenes.surface.objects.filter(x => x.action !== CORE_STATION_ACTION);
  for (const [place, location] of [
    [world, bridge], [world, { ...atCore, heading: 'E' }],
    [noStation, atCore], [world, { ...atCore, pending: { id: 'beam-out', to: 'bridge' } }],
  ]) {
    assert.throws(() => perform(initial, startAwayTeam(), location, place));
  }
  assert.deepEqual(initial.actions, []);
});

test('prior simulated core is preserved without pretending to be physically extracted', () => {
  let old = startMandate(definition);
  old = applyMandateAction(definition, old, {
    type: 'record', incidentId: 'sensor-core-recovered', orderId: 'recover-core',
    kind: 'evidence', witnesses: ['venn'], public: false,
  });
  old = applyMandateAction(definition, old, {
    type: 'resolve', orderId: 'recover-core',
    incidentId: 'sensor-core-recovered', status: 'completed',
  });
  const restored = deserializeMandateCheckpoint(definition, serializeMandateCheckpoint(definition, old));
  assert.deepEqual(restored, old);
  assert.notEqual(old.incidents[0].id, CORE_INCIDENT);
  assert.throws(() => perform(old), MandateError);
  const physical = perform();
  assert.equal(physical.state.incidents[0].id, CORE_INCIDENT);
  assert.throws(() => perform(physical.state), MandateError, 'duplicate recovery is impossible');
  const fabricated = { ...startMandate(definition), orders: { ...startMandate(definition).orders, 'recover-core': 'completed' } };
  assert.throws(() => perform(fabricated), MandateError);
});

test('classified retrieval and public rescue are independent, regardless of order', () => {
  const retrieved = perform().state;
  assert.equal(retrieved.orders.evacuate, 'active');
  const rescued = applyMandateAction(definition, retrieved, {
    type: 'record', incidentId: 'rescued-later', orderId: 'evacuate',
    kind: 'rescue', public: true, witnesses: ['mira'],
  });
  const both = applyMandateAction(definition, rescued, {
    type: 'resolve', orderId: 'evacuate', incidentId: 'rescued-later', status: 'completed',
  });
  assert.equal(both.orders.evacuate, 'completed');
  assert.equal(both.orders['recover-core'], 'completed');
  assert.deepEqual(publicMandateReport(definition, both).incidents,
    [{ id: 'rescued-later', kind: 'rescue', orderId: 'evacuate' }]);
});
