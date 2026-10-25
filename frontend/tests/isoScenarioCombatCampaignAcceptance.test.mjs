import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptCombatCampaignMission, readCombatCampaignAcceptances,
  COMBAT_CAMPAIGN_ACCEPTANCE_KEY, MAX_COMBAT_CAMPAIGN_ACCEPTANCES,
} from '../src/isoScenarioCombatCampaignAcceptance.ts';
import { COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY } from '../src/isoScenarioCombatExtractionAttemptLedger.ts';
import { COMBAT_REPLAY_SAVE_KEY, replayCombatCommands, serializeCombatReplay } from '../src/isoScenarioCombatReplay.ts';
import { COMBAT_MISSION_INSTANCE_SAVE_KEY } from '../src/isoScenarioCombatMissionInstanceSession.ts';
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
const checkpoint = serializeCombatReplay('relay', extractedOrders());
const source = attempts => JSON.stringify({ version: 3, attempts });
const acceptance = accepted => JSON.stringify({ version: 1, accepted });
const entry = (instanceId, raw = checkpoint) => ({ instanceId, checkpoint: raw });
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
  };
}
const tracked = (attempts = [entry(first)], extra = {}) => memory({
  [COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY]: source(attempts),
  [COMBAT_REPLAY_SAVE_KEY]: 'combat v4 untouched',
  [COMBAT_MISSION_INSTANCE_SAVE_KEY]: 'identity untouched',
  ...extra,
});

test('explicit acceptance is durable, replay-derived and idempotent after reload', () => {
  const store = tracked([entry(first), entry(second)]);
  assert.equal(readCombatCampaignAcceptances(store).status, 'missing');
  assert.deepEqual(acceptCombatCampaignMission(store, first), { status: 'accepted', count: 1 });
  assert.equal(acceptCombatCampaignMission(store, first).status, 'already-accepted');
  assert.deepEqual(acceptCombatCampaignMission(store, second), { status: 'accepted', count: 2 });
  const saved = store.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY);
  assert.deepEqual(JSON.parse(saved), { version: 1, accepted: [entry(first), entry(second)] });
  const restored = readCombatCampaignAcceptances(store);
  assert.equal(restored.status, 'ready');
  assert.deepEqual(restored.entries.map(item => item.instanceId), [first, second]);
  assert.ok(restored.entries.every(item => item.report.status === 'mission-extracted'));
  assert.ok(Object.isFrozen(restored.entries));
  assert.deepEqual(store.writes, [COMBAT_CAMPAIGN_ACCEPTANCE_KEY, COMBAT_CAMPAIGN_ACCEPTANCE_KEY]);
  assert.equal(store.getItem(COMBAT_REPLAY_SAVE_KEY), 'combat v4 untouched');
  assert.equal(store.getItem(COMBAT_MISSION_INSTANCE_SAVE_KEY), 'identity untouched');
  assert.equal(store.getItem(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY), source([entry(first), entry(second)]));
});

test('only an already-verified v3 extraction can be accepted', () => {
  const store = tracked();
  assert.deepEqual(acceptCombatCampaignMission(store, second), { status: 'not-recorded', count: 0 });
  assert.equal(acceptCombatCampaignMission(store, 'made-up').status, 'not-recorded');
  assert.equal(acceptCombatCampaignMission(memory(), first).status, 'not-recorded');
  const falseVictory = tracked([entry(first, serializeCombatReplay('relay', victory))]);
  assert.equal(readCombatCampaignAcceptances(falseVictory).status, 'incompatible');
  assert.equal(acceptCombatCampaignMission(falseVictory, first).status, 'incompatible');
  assert.deepEqual(falseVictory.writes, []);
});

test('accepted events reject missing, changed or forged source evidence without mutation', () => {
  const store = tracked();
  assert.equal(acceptCombatCampaignMission(store, first).status, 'accepted');
  const saved = store.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY);
  store.values.set(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, source([]));
  assert.equal(readCombatCampaignAcceptances(store).status, 'incompatible');
  assert.equal(acceptCombatCampaignMission(store, first).status, 'incompatible');
  store.values.set(COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, source([entry(first)]));
  const invalid = [
    '{', 'null', JSON.stringify({ version: 99, accepted: [] }),
    JSON.stringify({ version: 1, accepted: [], xp: 500 }),
    acceptance([entry(first), entry(first)]),
    acceptance([entry(second)]),
    acceptance([{ instanceId: first, checkpoint: 'forged' }]),
  ];
  for (const raw of invalid) {
    store.values.set(COMBAT_CAMPAIGN_ACCEPTANCE_KEY, raw);
    assert.equal(readCombatCampaignAcceptances(store).status, 'incompatible');
    assert.equal(acceptCombatCampaignMission(store, first).status, 'incompatible');
    assert.equal(store.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY), raw);
  }
  store.values.set(COMBAT_CAMPAIGN_ACCEPTANCE_KEY, saved);
  assert.equal(readCombatCampaignAcceptances(store).status, 'ready');
  assert.deepEqual(store.writes, [COMBAT_CAMPAIGN_ACCEPTANCE_KEY]);
});

test('full acceptance history never silently evicts previous mission events', () => {
  const attempts = Array.from({ length: MAX_COMBAT_CAMPAIGN_ACCEPTANCES + 1 }, (_, i) =>
    entry(i.toString(16).padStart(8, '0') + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
  // Source v3 itself is bounded to 24, so a 25th event must fail closed.
  const overfull = tracked(attempts);
  assert.equal(acceptCombatCampaignMission(overfull, first).status, 'incompatible');
  const full = tracked(attempts.slice(0, MAX_COMBAT_CAMPAIGN_ACCEPTANCES), {
    [COMBAT_CAMPAIGN_ACCEPTANCE_KEY]: acceptance(attempts.slice(0, MAX_COMBAT_CAMPAIGN_ACCEPTANCES)),
  });
  assert.equal(readCombatCampaignAcceptances(full).entries.length, MAX_COMBAT_CAMPAIGN_ACCEPTANCES);
  assert.equal(acceptCombatCampaignMission(full, first).status, 'not-recorded');
  assert.deepEqual(full.writes, []);
});

test('storage failures and dropped writes never claim an accepted event', () => {
  assert.equal(readCombatCampaignAcceptances(null).status, 'unavailable');
  assert.equal(acceptCombatCampaignMission(null, first).status, 'unavailable');
  const store = tracked();
  const silent = { getItem: store.getItem, setItem() {} };
  assert.equal(acceptCombatCampaignMission(silent, first).status, 'unavailable');
  const blocked = { getItem() { throw new Error('security'); }, setItem() {} };
  assert.equal(acceptCombatCampaignMission(blocked, first).status, 'unavailable');
  const quota = { getItem: store.getItem, setItem() { throw new Error('quota'); } };
  assert.equal(acceptCombatCampaignMission(quota, first).status, 'unavailable');
  assert.equal(store.getItem(COMBAT_CAMPAIGN_ACCEPTANCE_KEY), null);
});

test('concurrent changes to either ledger block stale acceptance writes', () => {
  for (const changedKey of [COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, COMBAT_CAMPAIGN_ACCEPTANCE_KEY]) {
    const store = tracked();
    let reads = 0;
    const racing = {
      getItem(key) {
        if (key === changedKey && ++reads === 2) {
          store.values.set(key, changedKey === COMBAT_CAMPAIGN_ACCEPTANCE_KEY
            ? acceptance([]) : source([entry(first), entry(second)]));
        }
        return store.getItem(key);
      },
      setItem: store.setItem,
    };
    assert.equal(acceptCombatCampaignMission(racing, first).status, 'conflict');
    assert.deepEqual(store.writes, []);
  }
});
