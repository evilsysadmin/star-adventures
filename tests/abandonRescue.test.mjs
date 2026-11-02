import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startMandate, serializeMandateCheckpoint, deserializeMandateCheckpoint, publicMandateReport } from '../src/dualMandate.mjs';
import { abandonRescue, returnAfterAbandonedRescue } from '../src/abandonRescue.mjs';
import { startExploration } from '../src/spatial.mjs';

const definition = JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json', import.meta.url)));

test('abandoning the rescue records a public refusal and survives replay', () => {
  const initial = startMandate(definition);
  const state = abandonRescue(definition, initial);
  assert.equal(initial.orders.evacuate, 'active');
  assert.equal(state.orders.evacuate, 'refused');
  assert.equal(state.orders['recover-core'], 'active');
  assert.deepEqual(publicMandateReport(definition, state).incidents, [
    { id: 'rescue-abandoned', kind: 'refusal', orderId: 'evacuate' },
  ]);
  assert.deepEqual(deserializeMandateCheckpoint(definition, serializeMandateCheckpoint(definition, state)), state);
  assert.throws(() => abandonRescue(definition, state));
});

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));

test('recorded abandonment extracts the team to the authored bridge spawn', () => {
  const active = startMandate(definition);
  const refused = abandonRescue(definition, active);
  const surface = { version: 1, area: 'surface', ...world.scenes.surface.spawn, pending: null };
  assert.throws(() => returnAfterAbandonedRescue(world, surface, definition, active));
  const returned = returnAfterAbandonedRescue(world, surface, definition, refused);
  assert.deepEqual(returned, startExploration(world));
  assert.equal(surface.area, 'surface');
  assert.equal(refused.orders['recover-core'], 'active');
  assert.throws(() => returnAfterAbandonedRescue(world, returned, definition, refused));
  assert.throws(() => returnAfterAbandonedRescue(world, { ...surface, pending: { id: 'beam-out', to: 'bridge' } }, definition, refused));
});
