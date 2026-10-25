import test from 'node:test';
import assert from 'node:assert/strict';
import { readCombatBridgeDebrief } from '../src/isoScenarioCombatBridgeDebrief.ts';
import { COMBAT_REPLAY_SAVE_KEY, serializeCombatReplay, replayCombatCommands } from '../src/isoScenarioCombatReplay.ts';
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
const from = raw => readCombatBridgeDebrief({
  getItem(key) {
    assert.equal(key, COMBAT_REPLAY_SAVE_KEY, 'never inspect legacy or campaign saves');
    return raw;
  },
});

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

test('bridge debrief distinguishes missing, blocked and incompatible checkpoints without writes', () => {
  assert.deepEqual(readCombatBridgeDebrief(null), {
    source: 'combat-v4-sandbox', status: 'unavailable', report: null, campaignApplied: false,
  });
  assert.equal(from(null).status, 'missing');
  assert.equal(from('{').status, 'incompatible');
  assert.equal(from(JSON.stringify({ version: 999, scenarioId: 'relay', actions: [] })).status, 'incompatible');
  assert.equal(readCombatBridgeDebrief({
    getItem() { throw new Error('SecurityError'); },
  }).status, 'unavailable');
  const blank = from(serializeCombatReplay('relay', []));
  assert.equal(blank.status, 'active');
  assert.equal(blank.report.objectives.extracted, false);
  assert.equal(blank.campaignApplied, false);
  assert.ok(Object.isFrozen(blank));
});

test('firefight victory is not an extracted mission or campaign credit', () => {
  const result = from(serializeCombatReplay('relay', victory));
  assert.equal(result.status, 'threats-neutralized');
  assert.equal(result.report.hostilesNeutralized, 2);
  assert.equal(result.report.objectives.extracted, false);
  assert.equal(result.report.scope, 'experimental-sandbox');
  assert.equal(result.campaignApplied, false);
  assert.ok(Object.isFrozen(result.report));
});

test('only replay-validated science, console and extraction yield a completed debrief', () => {
  const actions = extractedOrders();
  const raw = serializeCombatReplay('relay', actions);
  const result = from(raw);
  assert.equal(result.status, 'mission-extracted');
  assert.deepEqual(result.report.objectives, {
    scanned: true, operated: true, rescued: false, extracted: true,
  });
  assert.equal(result.report.hostilesNeutralized, 2);
  assert.equal(result.campaignApplied, false);
  assert.deepEqual(from(raw), result, 'reload yields the same report');
  const forged = JSON.parse(raw);
  forged.completed = true;
  assert.equal(from(JSON.stringify(forged)).status, 'incompatible',
    'a forged outcome must never become a debrief');
  assert.equal(from(serializeCombatReplay('relay', actions.slice(0, -1))).status,
    'threats-neutralized', 'extraction is required, not inferred from nearby officers');
});

test('an incapacitated squad is not reported as an extracted mission', () => {
  const actions = [];
  for (let i = 0; i < 50; i++) {
    actions.push({ type: 'end-turn' });
    if (replayCombatCommands('relay', actions).combat.encounter.failed) break;
  }
  const result = from(serializeCombatReplay('relay', actions));
  assert.equal(result.status, 'squad-incapacitated');
  assert.equal(result.report.objectives.extracted, false);
  assert.equal(result.campaignApplied, false);
});
