import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startMandate, serializeMandateCheckpoint, deserializeMandateCheckpoint, publicMandateReport } from '../src/dualMandate.mjs';
import { abandonRescue } from '../src/abandonRescue.mjs';

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
