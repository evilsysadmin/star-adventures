import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, createMission, missionPath, applyMissionAction } from '../src/isoScenarioCampaign.ts';
import { planHostileTurn } from '../src/isoScenarioHostileTurn.ts';
import { replayHostileEncounter } from '../src/isoScenarioHostileEncounter.ts';
import {
  serializeScenarioCheckpoint, deserializeScenarioCheckpoint, MAX_SCENARIO_COMMANDS,
} from '../src/isoScenarioCheckpoint.ts';

const startPositions = scenario => Object.fromEntries(
  scenario.hostiles.map(hostile => [hostile.id, hostile.cell]),
);
const distance = (a, b) => a.split(':').map(Number)
  .reduce((sum, n, i) => sum + Math.abs(n - Number(b.split(':')[i])), 0);

for (const scenario of Object.values(SCENARIOS)) {
  test(`${scenario.id}: end-turn advances real enemy cells deterministically`, () => {
    const commands = [{ type: 'end-turn' }];
    const before = JSON.stringify(commands);
    const expected = planHostileTurn(scenario, scenario.start, startPositions(scenario));
    const result = replayHostileEncounter(scenario.id, commands);
    assert.deepEqual(result.positions, expected.positions);
    assert.deepEqual(result.moves, expected.moves);
    assert.deepEqual(result.threats, expected.threats);
    assert.equal(result.enemyTurns, 1);
    assert.equal(result.mission.round, 2);
    assert.equal(result.mission.ap, 3);
    assert.ok(result.moves.length > 0);
    assert.deepEqual(result, replayHostileEncounter(scenario.id, commands));
    assert.equal(JSON.stringify(commands), before, 'input history must not be mutated');
  });
  test(`${scenario.id}: replaying many rounds keeps both hostiles legal`, () => {
    const commands = Array.from({ length: 20 }, () => ({ type: 'end-turn' }));
    const result = replayHostileEncounter(scenario.id, commands);
    const terrain = new Set([
      ...scenario.walls, ...scenario.cover, scenario.sensor, scenario.extraction,
      ...(scenario.console ? [scenario.console] : []),
      ...(scenario.survivor ? [scenario.survivor] : []),
      ...Object.values(scenario.start),
    ]);
    assert.equal(result.enemyTurns, 20);
    assert.equal(result.mission.round, 21);
    assert.equal(new Set(Object.values(result.positions)).size, 2);
    for (const cell of Object.values(result.positions))
      assert.equal(terrain.has(cell), false);
  });
}

test('a hostile on the shortest route forces a legal detour instead of blocking movement', () => {
  const mission = createMission('relay');
  const direct = missionPath(mission, 'science', '3:1');
  assert.deepEqual(direct, ['1:1', '2:1', '3:1']);
  const detour = missionPath(mission, 'science', '3:1', ['2:1']);
  assert.deepEqual(detour, ['1:1', '1:0', '2:0', '3:0', '3:1']);
  const moved = applyMissionAction(mission, { type: 'move', officer: 'science', cell: '3:1' }, ['2:1']);
  assert.equal(moved.locations.science, '3:1');
  assert.match(moved.events.at(-1), /4 casillas/);
  assert.equal(mission.locations.science, '1:1', 'the source mission stays immutable');
  assert.equal(missionPath(mission, 'science', '3:1', ['2:1', '1:2', '1:0', '0:1']), null);
  assert.throws(() => applyMissionAction(mission, { type: 'move', officer: 'science', cell: '3:1' },
    ['2:1', '1:2', '1:0', '0:1']), /Destination blocked/);
  assert.deepEqual(missionPath(mission, 'science', '3:1'), direct, 'v1 route is unchanged');
});

test('enemy occupancy rejects player movement without altering legacy v1 saves', () => {
  const commands = [];
  let contact;
  for (let round = 0; round < 40; round++) {
    const result = replayHostileEncounter('relay', commands);
    for (const [officer, cell] of Object.entries(result.mission.locations)) {
      const enemy = Object.values(result.positions).find(at => distance(at, cell) === 1);
      if (enemy) { contact = { officer, enemy }; break; }
    }
    if (contact) break;
    commands.push({ type: 'end-turn' });
  }
  assert.ok(contact, 'authored hostiles must eventually approach an officer');
  assert.throws(() => replayHostileEncounter('relay', [
    ...commands, { type: 'move', officer: contact.officer, cell: contact.enemy },
  ]), /Hostile contact blocks/);

  const oldCommands = [{ type: 'end-turn' }, { type: 'move', officer: 'science', cell: '2:1' }];
  const raw = serializeScenarioCheckpoint('relay', oldCommands);
  assert.equal(JSON.parse(raw).version, 1);
  assert.equal(deserializeScenarioCheckpoint(raw).state.round, 2);
  assert.equal(deserializeScenarioCheckpoint(raw).state.locations.science, '2:1');
  assert.equal(replayHostileEncounter('relay', oldCommands).mission.locations.science, '2:1');
});

test('encounter rejects malformed histories and illegal player commands', () => {
  assert.throws(() => replayHostileEncounter('missing', []), RangeError);
  assert.throws(() => replayHostileEncounter('relay', null), TypeError);
  assert.throws(() => replayHostileEncounter('relay', Array(MAX_SCENARIO_COMMANDS + 1).fill({ type: 'end-turn' })), TypeError);
  assert.throws(() => replayHostileEncounter('relay', [null]), TypeError);
  assert.throws(() => replayHostileEncounter('relay', [{ type: 'scan', officer: 'science' }]), RangeError);
});
