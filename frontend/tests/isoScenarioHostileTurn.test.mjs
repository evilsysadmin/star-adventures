import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../src/isoScenarioCampaign.ts';
import { planHostileTurn } from '../src/isoScenarioHostileTurn.ts';

const original = scenario => Object.fromEntries(scenario.hostiles.map(h => [h.id, h.cell]));
const distance = (a, b) => a.split(':').map(Number)
  .reduce((sum, n, i) => sum + Math.abs(n - Number(b.split(':')[i])), 0);

for (const scenario of Object.values(SCENARIOS)) {
  test(`${scenario.id}: enemy turns are deterministic, bounded and never cross obstacles or occupants`, () => {
    const squad = { ...scenario.start };
    let positions = original(scenario);
    const terrain = new Set([
      ...scenario.walls, ...scenario.cover, scenario.sensor, scenario.extraction,
      ...(scenario.console ? [scenario.console] : []),
      ...(scenario.survivor ? [scenario.survivor] : []),
    ]);
    for (let turn = 0; turn < 20; turn++) {
      const before = JSON.stringify({ squad, positions });
      const result = planHostileTurn(scenario, squad, positions);
      assert.deepEqual(result, planHostileTurn(scenario, squad, positions));
      if (turn === 0) assert.ok(result.moves.length > 0, 'the first enemy turn must advance at least one hostile');
      assert.equal(JSON.stringify({ squad, positions }), before, 'planner cannot mutate caller state');
      assert.equal(new Set(Object.values(result.positions)).size, 2);
      for (const cell of Object.values(result.positions)) {
        assert.match(cell, /^(0|[1-9]\d*):(0|[1-9]\d*)$/);
        assert.equal(terrain.has(cell), false);
        assert.equal(Object.values(squad).includes(cell), false);
      }
      for (const move of result.moves) {
        assert.equal(move.from, positions[move.hostile]);
        assert.equal(move.to, result.positions[move.hostile]);
        assert.equal(distance(move.from, move.to), 1, 'one orthogonal cell per turn');
      }
      for (const threat of result.threats) {
        assert.equal(threat.cell, positions[threat.hostile]);
        assert.equal(distance(threat.cell, squad[threat.officer]), 1);
        assert.equal(result.moves.some(move => move.hostile === threat.hostile), false);
      }
      positions = result.positions;
    }
  });
}
test('adjacent hostile threatens without inventing damage or moving into a squad tile', () => {
  const scenario = SCENARIOS.relay;
  const positions = { aegis: '1:2', veil: '8:5' };
  const turn = planHostileTurn(scenario, scenario.start, positions);
  assert.deepEqual(turn.threats, [{ hostile: 'aegis', officer: 'science', cell: '1:2' }]);
  assert.equal(turn.positions.aegis, '1:2');
  assert.equal(turn.moves.some(move => move.hostile === 'aegis'), false);
});
test('invalid, overlapping and forged positions fail closed', () => {
  const scenario = SCENARIOS.relay;
  const squad = { ...scenario.start };
  const positions = original(scenario);
  for (const hostile of [
    { ...positions, aegis: '4:1' }, // wall
    { ...positions, aegis: squad.science }, // friendly occupied
    { ...positions, aegis: positions.veil }, // enemy occupied
    { ...positions, aegis: '12:2' }, // off board
    { ...positions, aegis: '01:2' }, // noncanonical
    { ...positions, extra: '0:0' }, // forged actor
  ]) assert.throws(() => planHostileTurn(scenario, squad, hostile), TypeError);
  assert.throws(() => planHostileTurn(scenario, { ...squad, medic: squad.science }, positions), TypeError);
  assert.throws(() => planHostileTurn(scenario, squad, null), TypeError);
});
