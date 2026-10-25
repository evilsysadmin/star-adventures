import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordCombatExtraction, COMBAT_EXTRACTION_RECEIPT_KEY,
} from '../src/isoScenarioCombatExtractionReceipt.ts';
import {
  COMBAT_REPLAY_SAVE_KEY, serializeCombatReplay, replayCombatCommands,
} from '../src/isoScenarioCombatReplay.ts';
import { missionPath } from '../src/isoScenarioCampaign.ts';

const victory = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'end-turn' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

function extractedOrders() {
  const actions = [...victory];
  const mission = () => replayCombatCommands('relay', actions).combat.encounter.mission;
  const order = action => {
    if (action.type !== 'end-turn' && mission().ap === 0) actions.push({ type: 'end-turn' });
    actions.push(action);
    replayCombatCommands('relay', actions);
  };
  const travel = (officer, destination) => {
    let path = missionPath(mission(), officer, destination);
    assert.ok(path);
    while (path.length > 1) {
      order({ type: 'move', officer, cell: path[Math.min(5, path.length - 1)] });
      path = missionPath(mission(), officer, destination);
      assert.ok(path);
    }
  };
  travel('science', '9:1');
  order({ type: 'scan', officer: 'science' });
  travel('security', '9:7');
  order({ type: 'operate', officer: 'security' });
  travel('security', '9:9');
  order({ type: 'extract', officer: 'security' });
  return actions;
}

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
  };
}

test('only a replay-verified extraction produces one durable, versioned receipt', () => {
  const checkpoint = serializeCombatReplay('relay', extractedOrders());
  const storage = memory({
    [COMBAT_REPLAY_SAVE_KEY]: checkpoint,
    'shadowops.star-adventures.border-signal.v2': 'legacy-save-untouched',
  });
  const first = recordCombatExtraction(storage);
  assert.equal(first.status, 'recorded');
  assert.equal(first.report.status, 'mission-extracted');
  assert.equal(first.report.objectives.scanned, true);
  assert.equal(first.report.objectives.operated, true);
  assert.deepEqual(storage.writes, [COMBAT_EXTRACTION_RECEIPT_KEY]);
  assert.deepEqual(JSON.parse(storage.values.get(COMBAT_EXTRACTION_RECEIPT_KEY)), {
    version: 1, checkpoint,
  });
  assert.equal(storage.values.get(COMBAT_REPLAY_SAVE_KEY), checkpoint);
  assert.equal(storage.values.get('shadowops.star-adventures.border-signal.v2'),
    'legacy-save-untouched');
  const afterReload = recordCombatExtraction(storage);
  assert.equal(afterReload.status, 'already-recorded');
  assert.deepEqual(storage.writes, [COMBAT_EXTRACTION_RECEIPT_KEY],
    'F5/retry must not write or grant anything twice');
});

test('firefight victory, active mission and missing save never produce a receipt', () => {
  for (const actions of [[], victory]) {
    const storage = memory({ [COMBAT_REPLAY_SAVE_KEY]: serializeCombatReplay('relay', actions) });
    assert.equal(recordCombatExtraction(storage).status, 'not-extracted');
    assert.equal(storage.writes.length, 0);
  }
  const missing = memory();
  assert.equal(recordCombatExtraction(missing).status, 'not-extracted');
  assert.equal(missing.writes.length, 0);
});

test('incompatible checkpoints and receipts fail closed without overwriting saves', () => {
  const valid = serializeCombatReplay('relay', extractedOrders());
  const badSources = [
    '{',
    JSON.stringify({ version: 999, scenarioId: 'relay', actions: [] }),
    JSON.stringify({ version: 4, scenarioId: 'relay', actions: [], completed: true }),
  ];
  for (const raw of badSources) {
    const storage = memory({ [COMBAT_REPLAY_SAVE_KEY]: raw });
    assert.equal(recordCombatExtraction(storage).status, 'incompatible');
    assert.deepEqual(storage.writes, []);
  }
  for (const raw of [
    '{',
    JSON.stringify({ version: 999, checkpoint: valid }),
    JSON.stringify({ version: 1, checkpoint: serializeCombatReplay('relay', victory) }),
    JSON.stringify({ version: 1, checkpoint: valid, claimedXp: 9000 }),
  ]) {
    const storage = memory({
      [COMBAT_REPLAY_SAVE_KEY]: valid, [COMBAT_EXTRACTION_RECEIPT_KEY]: raw,
    });
    assert.equal(recordCombatExtraction(storage).status, 'incompatible');
    assert.equal(storage.values.get(COMBAT_EXTRACTION_RECEIPT_KEY), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('a different extracted history cannot silently replace a recorded mission', () => {
  const first = serializeCombatReplay('relay', extractedOrders());
  const second = serializeCombatReplay('relay', [
    ...extractedOrders().slice(0, -1), { type: 'end-turn' },
    { type: 'extract', officer: 'security' },
  ]);
  const storage = memory({ [COMBAT_REPLAY_SAVE_KEY]: first });
  assert.equal(recordCombatExtraction(storage).status, 'recorded');
  storage.values.set(COMBAT_REPLAY_SAVE_KEY, second);
  assert.equal(recordCombatExtraction(storage).status, 'occupied');
  assert.equal(storage.writes.length, 1);
  assert.equal(JSON.parse(storage.values.get(COMBAT_EXTRACTION_RECEIPT_KEY)).checkpoint, first);
});

test('blocked, quota-limited and silently discarded storage cannot claim persistence', () => {
  assert.equal(recordCombatExtraction(null).status, 'unavailable');
  const checkpoint = serializeCombatReplay('relay', extractedOrders());
  const blocked = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
  };
  assert.equal(recordCombatExtraction(blocked).status, 'unavailable');
  const quota = {
    getItem(key) { return key === COMBAT_REPLAY_SAVE_KEY ? checkpoint : null; },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.equal(recordCombatExtraction(quota).status, 'unavailable');
  const silent = {
    getItem(key) { return key === COMBAT_REPLAY_SAVE_KEY ? checkpoint : null; },
    setItem() {},
  };
  assert.equal(recordCombatExtraction(silent).status, 'unavailable');
});
