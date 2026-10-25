import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readCombatExtractionAttemptLedger, recordCombatExtractionAttempt,
  COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, MAX_EXTRACTION_ATTEMPT_ENTRIES,
} from '../src/isoScenarioCombatExtractionAttemptLedger.ts';
import {
  COMBAT_MISSION_INSTANCE_SAVE_KEY,
} from '../src/isoScenarioCombatMissionInstanceSession.ts';
import {
  createCombatMissionInstance, serializeCombatMissionInstance,
} from '../src/isoScenarioCombatMissionInstance.ts';
import {
  COMBAT_REPLAY_SAVE_KEY, serializeCombatReplay, deserializeCombatReplay, replayCombatCommands,
} from '../src/isoScenarioCombatReplay.ts';
import { COMBAT_EXTRACTION_LEDGER_KEY } from '../src/isoScenarioCombatExtractionLedger.ts';
import { COMBAT_EXTRACTION_RECEIPT_KEY } from '../src/isoScenarioCombatExtractionReceipt.ts';
import { missionPath } from '../src/isoScenarioCampaign.ts';

const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';
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
const identity = (id, raw) => serializeCombatMissionInstance(
  createCombatMissionInstance(id, deserializeCombatReplay(raw)),
);
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
  };
}
const tracked = (id, raw = checkpoint(), extra = {}) => memory({
  [COMBAT_REPLAY_SAVE_KEY]: raw,
  [COMBAT_MISSION_INSTANCE_SAVE_KEY]: identity(id, raw),
  ...extra,
});

test('separate attempt IDs can record identical extracted commands; F5 is idempotent', () => {
  const raw = checkpoint();
  const store = tracked(first, raw, {
    [COMBAT_EXTRACTION_LEDGER_KEY]: 'legacy v2 untouched',
    [COMBAT_EXTRACTION_RECEIPT_KEY]: 'legacy v1 untouched',
  });
  assert.equal(readCombatExtractionAttemptLedger(store).status, 'missing');
  assert.deepEqual(recordCombatExtractionAttempt(store), { status: 'recorded', count: 1 });
  assert.equal(recordCombatExtractionAttempt(store).status, 'already-recorded');
  store.values.set(COMBAT_MISSION_INSTANCE_SAVE_KEY, identity(second, raw));
  assert.deepEqual(recordCombatExtractionAttempt(store), { status: 'recorded', count: 2 });
  const restored = readCombatExtractionAttemptLedger(store);
  assert.equal(restored.status, 'ready');
  assert.deepEqual(restored.entries.map(entry => entry.instanceId), [first, second]);
  assert.deepEqual(restored.entries.map(entry => entry.checkpoint), [raw, raw]);
  assert.equal(restored.entries[0].report.status, 'mission-extracted');
  assert.ok(Object.isFrozen(restored.entries));
  assert.deepEqual(store.writes, [
    COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY,
  ]);
  assert.equal(store.getItem(COMBAT_EXTRACTION_LEDGER_KEY), 'legacy v2 untouched');
  assert.equal(store.getItem(COMBAT_EXTRACTION_RECEIPT_KEY), 'legacy v1 untouched');
  assert.equal(store.getItem(COMBAT_REPLAY_SAVE_KEY), raw);
});

test('missing identity, incomplete missions and unsynchronized checkpoints grant no credit', () => {
  const raw = checkpoint();
  const untracked = memory({ [COMBAT_REPLAY_SAVE_KEY]: raw });
  assert.equal(recordCombatExtractionAttempt(untracked).status, 'untracked');
  assert.equal(recordCombatExtractionAttempt(memory()).status, 'not-extracted');
  for (const orders of [[], victory]) {
    const partial = serializeCombatReplay('relay', orders);
    assert.equal(recordCombatExtractionAttempt(tracked(first, partial)).status, 'not-extracted');
  }
  const outOfSync = tracked(first, raw);
  outOfSync.values.set(COMBAT_MISSION_INSTANCE_SAVE_KEY, identity(first, checkpoint(1)));
  assert.equal(recordCombatExtractionAttempt(outOfSync).status, 'out-of-sync');
  assert.deepEqual(outOfSync.writes, []);
});

test('same identity with different extracted orders is a conflict, not a second reward', () => {
  const store = tracked(first);
  assert.equal(recordCombatExtractionAttempt(store).status, 'recorded');
  const before = store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
  const changed = checkpoint(1);
  store.values.set(COMBAT_REPLAY_SAVE_KEY, changed);
  store.values.set(COMBAT_MISSION_INSTANCE_SAVE_KEY, identity(first, changed));
  assert.equal(recordCombatExtractionAttempt(store).status, 'conflict');
  assert.equal(store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY), before);
  assert.deepEqual(store.writes, [COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY]);
});

test('malformed, future, duplicate and forged ledger evidence fails closed', () => {
  const raw = checkpoint();
  const invalid = [
    '{', 'null',
    JSON.stringify({ version: 99, attempts: [] }),
    JSON.stringify({ version: 3, attempts: 'invalid' }),
    JSON.stringify({ version: 3, attempts: [], xp: 999 }),
    JSON.stringify({ version: 3, attempts: [{ instanceId: first, checkpoint: raw, xp: 1 }] }),
    JSON.stringify({ version: 3, attempts: [
      { instanceId: first, checkpoint: raw }, { instanceId: first, checkpoint: raw },
    ] }),
    JSON.stringify({ version: 3, attempts: [{ instanceId: 'not-a-uuid', checkpoint: raw }] }),
    JSON.stringify({ version: 3, attempts: [{
      instanceId: first, checkpoint: serializeCombatReplay('relay', victory),
    }] }),
    JSON.stringify({ version: 3, attempts: [{
      instanceId: first, checkpoint: JSON.stringify({ version: 4, scenarioId: 'relay', actions: completed, won: true }),
    }] }),
  ];
  for (const ledgerRaw of invalid) {
    const store = tracked(second, raw, { [COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY]: ledgerRaw });
    assert.equal(readCombatExtractionAttemptLedger(store).status, 'incompatible');
    assert.equal(recordCombatExtractionAttempt(store).status, 'incompatible');
    assert.equal(store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY), ledgerRaw);
    assert.deepEqual(store.writes, []);
  }
  const brokenIdentity = tracked(first, raw);
  brokenIdentity.values.set(COMBAT_MISSION_INSTANCE_SAVE_KEY, '{');
  assert.equal(recordCombatExtractionAttempt(brokenIdentity).status, 'incompatible');
  assert.deepEqual(brokenIdentity.writes, []);
});

test('bounded ledger rejects the 25th attempt rather than dropping earlier evidence', () => {
  const raw = checkpoint();
  const attempts = Array.from({ length: MAX_EXTRACTION_ATTEMPT_ENTRIES }, (_, index) => ({
    instanceId: index.toString(16).padStart(8, '0') + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    checkpoint: raw,
  }));
  const original = JSON.stringify({ version: 3, attempts });
  const store = tracked(first, raw, { [COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY]: original });
  assert.equal(readCombatExtractionAttemptLedger(store).entries.length, MAX_EXTRACTION_ATTEMPT_ENTRIES);
  assert.equal(recordCombatExtractionAttempt(store).status, 'full');
  assert.equal(store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY), original);
  assert.deepEqual(store.writes, []);
});

test('blocked, quota-limited and silently discarded storage cannot claim durable success', () => {
  assert.equal(readCombatExtractionAttemptLedger(null).status, 'unavailable');
  assert.equal(recordCombatExtractionAttempt(null).status, 'unavailable');
  const blocked = { getItem() { throw new Error('security'); }, setItem() {} };
  assert.equal(readCombatExtractionAttemptLedger(blocked).status, 'unavailable');
  assert.equal(recordCombatExtractionAttempt(blocked).status, 'unavailable');
  const store = tracked(first);
  const silent = { getItem: store.getItem, setItem() {} };
  assert.equal(recordCombatExtractionAttempt(silent).status, 'unavailable');
  const quota = { getItem: store.getItem, setItem() { throw new Error('quota'); } };
  assert.equal(recordCombatExtractionAttempt(quota).status, 'unavailable');
  assert.equal(store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY), null);
});
