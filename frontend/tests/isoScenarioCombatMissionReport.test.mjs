import test from 'node:test';
import assert from 'node:assert/strict';
import { combatMissionReport } from '../src/isoScenarioCombatMissionReport.ts';
import { replayCombatCommands } from '../src/isoScenarioCombatReplay.ts';
import { missionPath } from '../src/isoScenarioCampaign.ts';

const approach = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
];
const retaliation = [
  ...approach,
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'end-turn' },
];
const victory = [
  ...retaliation,
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

test('report differentiates active combat from mission extraction without inventing credit', () => {
  const blank = combatMissionReport({ scenarioId: 'relay', actions: [] });
  assert.equal(blank.scope, 'experimental-sandbox');
  assert.equal(blank.status, 'active');
  assert.equal(blank.objectives.extracted, false);
  assert.equal(blank.hostilesNeutralized, 0);
  assert.equal(blank.wounds, 0);
  assert.equal(blank.shots, 0);
  assert.equal(blank.round, 1);
  assert.deepEqual(blank.officerHealth, { science: 3, security: 3, medic: 3 });
  assert.deepEqual(blank.hostileHealth, { aegis: 2, veil: 2 });

  const underFire = combatMissionReport({ scenarioId: 'relay', actions: retaliation });
  assert.equal(underFire.status, 'active');
  assert.equal(underFire.shots, 1);
  assert.equal(underFire.enemyTurns, 1);
  assert.equal(underFire.wounds, 1);
  assert.equal(underFire.officerHealth.security, 2);
  assert.equal(underFire.hostileHealth.aegis, 1);
});

test('neutralizing all contacts does not silently complete the mission', () => {
  const report = combatMissionReport({ scenarioId: 'relay', actions: victory });
  assert.equal(report.status, 'threats-neutralized');
  assert.equal(report.hostilesNeutralized, 2);
  assert.equal(report.shots, 4);
  assert.equal(report.orders, 6);
  assert.equal(report.objectives.scanned, false);
  assert.equal(report.objectives.operated, false);
  assert.equal(report.objectives.extracted, false);
  assert.equal(report.scope, 'experimental-sandbox');
  assert.deepEqual(report.hostileHealth, { aegis: 0, veil: 0 });
});

test('replay-derived incapacitation is distinct from victory and extraction', () => {
  const actions = [];
  let report;
  for (let i = 0; i < 50; i++) {
    actions.push({ type: 'end-turn' });
    report = combatMissionReport({ scenarioId: 'relay', actions });
    if (report.status === 'squad-incapacitated') break;
  }
  assert.equal(report.status, 'squad-incapacitated');
  assert.equal(report.objectives.extracted, false);
  assert.equal(report.hostilesNeutralized, 0);
  assert.ok(report.wounds >= 3);
  assert.equal(report.shots, 0);
});

test('neutralized contacts permit science, operations and actual extraction after victory', () => {
  const actions = [...victory];
  const state = () => replayCombatCommands('relay', actions).combat.encounter.mission;
  const order = action => {
    if (action.type !== 'end-turn' && state().ap === 0) actions.push({ type: 'end-turn' });
    actions.push(action);
    replayCombatCommands('relay', actions); // each new command must be legal
  };
  const travel = (officer, destination) => {
    let path = missionPath(state(), officer, destination);
    assert.ok(path, 'authored objective must be reachable');
    while (path.length > 1) {
      order({ type: 'move', officer, cell: path[Math.min(5, path.length - 1)] });
      path = missionPath(state(), officer, destination);
      assert.ok(path);
    }
  };

  travel('science', '9:1'); // adjacent to the relay sensor
  order({ type: 'scan', officer: 'science' });
  travel('security', '9:7'); // adjacent to the relay console
  order({ type: 'operate', officer: 'security' });
  travel('security', '9:9'); // extraction beacon
  order({ type: 'extract', officer: 'security' });

  const report = combatMissionReport({ scenarioId: 'relay', actions });
  assert.equal(report.status, 'mission-extracted');
  assert.deepEqual(report.objectives, {
    scanned: true, operated: true, rescued: false, extracted: true,
  });
  assert.equal(report.hostilesNeutralized, 2);
  assert.equal(report.enemyTurns, 1, 'defeated contacts never receive new turns');
  assert.equal(report.shots, 4);
  assert.deepEqual(report.officerHealth, combatMissionReport({
    scenarioId: 'relay', actions: victory,
  }).officerHealth, 'post-victory objective work cannot cause phantom wounds');
  assert.deepEqual(combatMissionReport({ scenarioId: 'relay', actions }),
    combatMissionReport({ scenarioId: 'relay', actions: structuredClone(actions) }));
  assert.throws(() => replayCombatCommands('relay', [...actions, { type: 'end-turn' }]),
    /already ended/, 'extraction remains terminal');
});

test('report replays untrusted commands and ignores forged derived results', () => {
  const history = replayCombatCommands('relay', victory);
  const forged = { ...history, combat: {
    ...history.combat, victory: false,
    hostileHealth: { aegis: 2, veil: 2 },
  } };
  assert.deepEqual(combatMissionReport(forged),
    combatMissionReport({ scenarioId: 'relay', actions: victory }));
  assert.throws(() => combatMissionReport({
    scenarioId: 'relay', actions: [{ type: 'fire', officer: 'science', hostile: 'aegis' }],
  }));
  assert.throws(() => combatMissionReport(null), /Invalid combat history/);
  assert.equal(Object.isFrozen(combatMissionReport(history).officerHealth), true);
});
