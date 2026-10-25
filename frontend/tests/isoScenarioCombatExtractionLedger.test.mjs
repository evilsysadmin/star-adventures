import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readCombatExtractionLedger, recordCombatExtractionInLedger,
  COMBAT_EXTRACTION_LEDGER_KEY, MAX_EXTRACTION_LEDGER_ENTRIES,
} from '../src/isoScenarioCombatExtractionLedger.ts';
import { COMBAT_EXTRACTION_RECEIPT_KEY } from '../src/isoScenarioCombatExtractionReceipt.ts';
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

const completed = extractedOrders();
const checkpoint = (extraTurns = 0) => serializeCombatReplay('relay', [
  ...completed.slice(0, -1),
  ...Array.from({ length: extraTurns }, () => ({ type: 'end-turn' })),
  completed.at(-1),
]);

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
  };
}

test('only an actual extraction is appended; F5 and identical replay are idempotent', () => {
  const raw = checkpoint();
  const storage = memory({
    [COMBAT_REPLAY_SAVE_KEY]: raw,
    'shadowops.star-adventures.border-signal.v2': 'untouched',
  });
  assert.equal(readCombatExtractionLedger(storage).status, 'missing');
  const first = recordCombatExtractionInLedger(storage);
  assert.equal(first.status, 'recorded');
  assert.equal(first.count, 1);
  assert.equal(first.report.status, 'mission-extracted');
  assert.deepEqual(storage.writes, [COMBAT_EXTRACTION_LEDGER_KEY]);
  assert.deepEqual(JSON.parse(storage.values.get(COMBAT_EXTRACTION_LEDGER_KEY)), {
    version: 2, checkpoints: [raw],
  });
  assert.equal(storage.values.get(COMBAT_REPLAY_SAVE_KEY), raw);
  assert.equal(storage.values.get('shadowops.star-adventures.border-signal.v2'), 'untouched');
  const reloaded = readCombatExtractionLedger(storage);
  assert.equal(reloaded.status, 'ready');
  assert.equal(reloaded.entries.length, 1);
  assert.equal(reloaded.entries[0].report.objectives.extracted, true);
  assert.ok(Object.isFrozen(reloaded.entries));
  assert.equal(recordCombatExtractionInLedger(storage).status, 'already-recorded');
  assert.deepEqual(storage.writes, [COMBAT_EXTRACTION_LEDGER_KEY]);
});

test('distinct validated missions append without replacing prior evidence', () => {
  const first = checkpoint();
  const second = checkpoint(1);
  const storage = memory({ [COMBAT_REPLAY_SAVE_KEY]: first });
  assert.equal(recordCombatExtractionInLedger(storage).status, 'recorded');
  storage.values.set(COMBAT_REPLAY_SAVE_KEY, second);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'recorded');
  assert.deepEqual(JSON.parse(storage.values.get(COMBAT_EXTRACTION_LEDGER_KEY)).checkpoints,
    [first, second]);
  assert.equal(readCombatExtractionLedger(storage).entries.length, 2);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'already-recorded');
  assert.equal(storage.writes.length, 2);
});

test('v1 receipt is read and preserved without migration writes or double counting', () => {
  const first = checkpoint();
  const second = checkpoint(1);
  const oldRaw = JSON.stringify({ version: 1, checkpoint: first });
  const storage = memory({
    [COMBAT_EXTRACTION_RECEIPT_KEY]: oldRaw,
    [COMBAT_REPLAY_SAVE_KEY]: first,
  });
  const old = readCombatExtractionLedger(storage);
  assert.equal(old.status, 'ready');
  assert.deepEqual(old.entries.map(entry => entry.checkpoint), [first]);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'already-recorded');
  assert.deepEqual(storage.writes, [], 'reading v1 must not create v2 automatically');
  storage.values.set(COMBAT_REPLAY_SAVE_KEY, second);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'recorded');
  assert.deepEqual(readCombatExtractionLedger(storage).entries.map(entry => entry.checkpoint),
    [first, second]);
  assert.equal(storage.values.get(COMBAT_EXTRACTION_RECEIPT_KEY), oldRaw);
  assert.deepEqual(storage.writes, [COMBAT_EXTRACTION_LEDGER_KEY]);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'already-recorded');
});

test('missing, active and merely neutralized missions cannot create ledger entries', () => {
  for (const raw of [null, serializeCombatReplay('relay', []),
    serializeCombatReplay('relay', victory)]) {
    const storage = memory(raw === null ? {} : { [COMBAT_REPLAY_SAVE_KEY]: raw });
    assert.equal(recordCombatExtractionInLedger(storage).status, 'not-extracted');
    assert.deepEqual(storage.writes, []);
  }
});

test('future, malformed, duplicate and forged records fail closed without overwriting', () => {
  const good = checkpoint();
  const invalid = [
    '{',
    JSON.stringify({ version: 999, checkpoints: [good] }),
    JSON.stringify({ version: 2, checkpoints: [good, good] }),
    JSON.stringify({ version: 2, checkpoints: [serializeCombatReplay('relay', victory)] }),
    JSON.stringify({ version: 2, checkpoints: [good], xp: 9000 }),
    JSON.stringify({ version: 2, checkpoints: 'fake' }),
  ];
  for (const ledgerRaw of invalid) {
    const storage = memory({
      [COMBAT_REPLAY_SAVE_KEY]: good,
      [COMBAT_EXTRACTION_LEDGER_KEY]: ledgerRaw,
    });
    assert.equal(readCombatExtractionLedger(storage).status, 'incompatible');
    assert.equal(recordCombatExtractionInLedger(storage).status, 'incompatible');
    assert.equal(storage.values.get(COMBAT_EXTRACTION_LEDGER_KEY), ledgerRaw);
    assert.deepEqual(storage.writes, []);
  }
  for (const oldRaw of ['{', JSON.stringify({ version: 1, checkpoint: good, xp: 1 })]) {
    const storage = memory({
      [COMBAT_REPLAY_SAVE_KEY]: good,
      [COMBAT_EXTRACTION_RECEIPT_KEY]: oldRaw,
    });
    assert.equal(recordCombatExtractionInLedger(storage).status, 'incompatible');
    assert.deepEqual(storage.writes, []);
  }
  for (const replayRaw of ['{', JSON.stringify({
    version: 4, scenarioId: 'relay', actions: completed, completed: true,
  })]) {
    const storage = memory({ [COMBAT_REPLAY_SAVE_KEY]: replayRaw });
    assert.equal(recordCombatExtractionInLedger(storage).status, 'incompatible');
    assert.deepEqual(storage.writes, []);
  }
});

test('bounded history refuses a 25th entry rather than silently discarding older ones', () => {
  const existing = Array.from({ length: MAX_EXTRACTION_LEDGER_ENTRIES },
    (_, index) => checkpoint(index));
  const original = JSON.stringify({ version: 2, checkpoints: existing });
  const storage = memory({
    [COMBAT_EXTRACTION_LEDGER_KEY]: original,
    [COMBAT_REPLAY_SAVE_KEY]: checkpoint(MAX_EXTRACTION_LEDGER_ENTRIES),
  });
  assert.equal(readCombatExtractionLedger(storage).entries.length, MAX_EXTRACTION_LEDGER_ENTRIES);
  assert.equal(recordCombatExtractionInLedger(storage).status, 'full');
  assert.equal(storage.values.get(COMBAT_EXTRACTION_LEDGER_KEY), original);
  assert.deepEqual(storage.writes, []);
});

test('blocked, quota-limited and silently discarded storage cannot claim success', () => {
  assert.equal(readCombatExtractionLedger(null).status, 'unavailable');
  assert.equal(recordCombatExtractionInLedger(null).status, 'unavailable');
  const blocked = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
  };
  assert.equal(readCombatExtractionLedger(blocked).status, 'unavailable');
  assert.equal(recordCombatExtractionInLedger(blocked).status, 'unavailable');
  const quota = {
    getItem(key) { return key === COMBAT_REPLAY_SAVE_KEY ? checkpoint() : null; },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.equal(recordCombatExtractionInLedger(quota).status, 'unavailable');
  const silent = {
    getItem(key) { return key === COMBAT_REPLAY_SAVE_KEY ? checkpoint() : null; },
    setItem() {},
  };
  assert.equal(recordCombatExtractionInLedger(silent).status, 'unavailable');
});
