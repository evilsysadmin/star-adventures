import test from 'node:test';
import assert from 'node:assert/strict';
import { replayCombatCommands, serializeCombatReplay, deserializeCombatReplay,
  COMBAT_REPLAY_VERSION, COMBAT_REPLAY_SAVE_KEY } from '../src/isoScenarioCombatReplay.ts';
import { serializeCombatEncounterCheckpoint, deserializeCombatEncounterCheckpoint } from '../src/isoScenarioCombatCheckpoint.ts';
import { serializeHostileEncounterCheckpoint } from '../src/isoScenarioHostileCheckpoint.ts';
import { serializeScenarioCheckpoint, MAX_SCENARIO_COMMANDS, MAX_SCENARIO_CHECKPOINT_BYTES } from '../src/isoScenarioCheckpoint.ts';

// Authored route: security crosses the southern opening in two legal 5-tile moves.
const approach = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
];
const firstHit = [...approach, { type: 'fire', officer: 'security', hostile: 'aegis' }];
const retaliation = [...firstHit, { type: 'end-turn' }];
const win = [...retaliation,
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

test('v4 replays movement, fire and enemy retaliation deterministically', () => {
  const input = structuredClone(retaliation);
  const initial = replayCombatCommands('relay', []);
  const history = replayCombatCommands('relay', retaliation);
  assert.deepEqual(history, replayCombatCommands('relay', retaliation));
  assert.deepEqual(retaliation, input, 'replay never changes the caller commands');
  assert.deepEqual(initial.combat.hostileHealth, { aegis: 2, veil: 2 });
  assert.deepEqual(initial.combat.encounter.health, { science: 3, security: 3, medic: 3 });
  assert.equal(history.combat.encounter.mission.round, 2);
  assert.equal(history.combat.encounter.mission.ap, 3);
  assert.equal(history.combat.encounter.enemyTurns, 1);
  assert.equal(history.combat.shots.length, 1);
  assert.equal(history.combat.shots[0].remainingHp, 1);
  assert.equal(history.combat.encounter.health.security, 2, 'adjacent living hostile retaliates');
  assert.deepEqual(history.combat.encounter.hits.map(hit => hit.hostile), ['aegis']);
});

test('defeated contacts stop moving, threatening and blocking movement', () => {
  const killed = [...retaliation, { type: 'fire', officer: 'security', hostile: 'aegis' }];
  const state = replayCombatCommands('relay', killed);
  assert.equal(state.combat.hostileHealth.aegis, 0);
  assert.equal(state.combat.hostileHealth.veil, 2);
  assert.throws(() => replayCombatCommands('relay',
    [...killed, { type: 'fire', officer: 'security', hostile: 'aegis' }]), /eliminated/);
  const moved = replayCombatCommands('relay',
    [...killed, { type: 'move', officer: 'security', cell: state.combat.encounter.positions.aegis }]);
  assert.equal(moved.combat.encounter.mission.locations.security,
    state.combat.encounter.positions.aegis, 'fallen contact no longer blocks its tile');
  const next = replayCombatCommands('relay', [...killed, { type: 'end-turn' }]);
  assert.equal(next.combat.encounter.positions.aegis, state.combat.encounter.positions.aegis);
  assert.equal(next.combat.encounter.moves.some(move => move.hostile === 'aegis'), false);
  assert.equal(next.combat.encounter.threats.some(threat => threat.hostile === 'aegis'), false);
});

test('all hostiles eliminated ends firing, but not mission objectives', () => {
  const history = replayCombatCommands('relay', win);
  assert.equal(history.combat.victory, true);
  assert.deepEqual(history.combat.hostileHealth, { aegis: 0, veil: 0 });
  assert.equal(history.combat.encounter.mission.ap, 0);
  assert.equal(history.combat.shots.length, 4);
  const continued = replayCombatCommands('relay', [...win, { type: 'end-turn' }]);
  assert.equal(continued.combat.victory, true);
  assert.equal(continued.combat.encounter.mission.round, 3);
  assert.equal(continued.combat.encounter.mission.ap, 3);
  assert.equal(continued.combat.encounter.enemyTurns, history.combat.encounter.enemyTurns,
    'no phantom retaliation after every hostile has fallen');
  assert.deepEqual(continued.combat.encounter.health, history.combat.encounter.health);
  assert.deepEqual(continued.combat.encounter.moves, []);
  assert.deepEqual(continued.combat.encounter.threats, []);
  assert.throws(() => replayCombatCommands('relay',
    [...win, { type: 'fire', officer: 'security', hostile: 'veil' }]), /already ended/);
});

test('v4 checkpoint round-trips without changing any historical save version', () => {
  const raw = serializeCombatReplay('relay', win);
  assert.deepEqual(JSON.parse(raw), { version: 4, scenarioId: 'relay', actions: win });
  assert.equal(COMBAT_REPLAY_VERSION, 4);
  assert.notEqual(COMBAT_REPLAY_SAVE_KEY, 'shadowops.star-adventures.combat-encounter.v3');
  assert.deepEqual(deserializeCombatReplay(raw), replayCombatCommands('relay', win));
  assert.equal(serializeCombatReplay('relay', win), raw);
  assert.equal(JSON.parse(serializeCombatEncounterCheckpoint('relay', [{ type: 'end-turn' }])).version, 3);
  assert.equal(JSON.parse(serializeHostileEncounterCheckpoint('relay', [{ type: 'end-turn' }])).version, 2);
  assert.equal(JSON.parse(serializeScenarioCheckpoint('relay', [{ type: 'end-turn' }])).version, 1);
  assert.throws(() => deserializeCombatEncounterCheckpoint(raw), /Incompatible/);
  assert.throws(() => deserializeCombatReplay(serializeCombatEncounterCheckpoint('relay', [])), /Incompatible/);
});

test('v4 rejects forged state, malformed actions, invalid shots and oversized histories', () => {
  const base = JSON.parse(serializeCombatReplay('relay', []));
  for (const extra of [
    { hostileHealth: { aegis: 0 } }, { victory: true },
    { positions: { aegis: '0:0' } }, { health: { security: 999 } },
  ]) assert.throws(() => deserializeCombatReplay(JSON.stringify({ ...base, ...extra })), /Incompatible/);
  for (const changed of [
    { ...base, version: 5 }, { ...base, scenarioId: '__proto__' },
    { ...base, actions: {} },
  ]) assert.throws(() => deserializeCombatReplay(JSON.stringify(changed)), /Incompatible/);
  for (const actions of [
    [null],
    [{ type: 'fire', officer: 'security', hostile: 'aegis', damage: 99 }],
    [{ type: 'fire', officer: 'captain', hostile: 'aegis' }],
    [{ type: 'fire', officer: 'security', hostile: 'unknown' }],
    [{ type: 'end-turn', forged: true }],
    [{ type: 'move', officer: 'science', cell: '01:2' }],
    [{ type: 'fire', officer: 'security', hostile: 'aegis' }],
  ]) assert.throws(() => deserializeCombatReplay(JSON.stringify({ ...base, actions })));
  assert.throws(() => deserializeCombatReplay('{'), /Malformed/);
  assert.throws(() => deserializeCombatReplay('x'.repeat(MAX_SCENARIO_CHECKPOINT_BYTES + 1)), /size/);
  assert.throws(() => replayCombatCommands('relay', Array.from(
    { length: MAX_SCENARIO_COMMANDS + 1 }, () => ({ type: 'end-turn' }))), /oversized/);
  assert.throws(() => replayCombatCommands('relay', [...retaliation, { type: 'move', officer: 'security', cell: '8:5' }]));
});

test('sustained unopposed enemy attacks cause replay-derived defeat', () => {
  const actions = [];
  let failed = false;
  for (let i = 0; i < 50; i++) {
    actions.push({ type: 'end-turn' });
    const state = replayCombatCommands('relay', actions);
    if (state.combat.encounter.failed) { failed = true; break; }
  }
  assert.equal(failed, true);
  assert.throws(() => replayCombatCommands('relay', [...actions, { type: 'end-turn' }]),
    /already ended/);
});

test('security can negotiate a nonlethal ceasefire only when adjacent before shooting', () => {
  const parley = [...approach, { type: 'parley', officer: 'security' }];
  const state = replayCombatCommands('relay', parley);
  assert.equal(state.combat.truce, true);
  assert.equal(state.combat.victory, false, 'ceasefire is not a lethal victory');
  assert.deepEqual(state.combat.hostileHealth, { aegis: 2, veil: 2 });
  assert.deepEqual(state.combat.shots, []);
  assert.equal(state.combat.encounter.mission.ap, 0);
  assert.match(state.combat.encounter.mission.events.at(-1), /alto el fuego/);
  const next = replayCombatCommands('relay', [...parley, { type: 'end-turn' }]);
  assert.equal(next.combat.encounter.mission.round, 2);
  assert.equal(next.combat.encounter.mission.ap, 3);
  assert.equal(next.combat.encounter.enemyTurns, 0);
  assert.deepEqual(next.combat.encounter.moves, []);
  assert.deepEqual(next.combat.encounter.threats, []);
  assert.deepEqual(next.combat.encounter.hits, []);
  assert.deepEqual(next.combat.encounter.health, state.combat.encounter.health);
  assert.deepEqual(next.combat.encounter.positions, state.combat.encounter.positions);
  assert.deepEqual(deserializeCombatReplay(serializeCombatReplay('relay', [...parley, { type: 'end-turn' }])), next);
  assert.throws(() => replayCombatCommands('relay', [...parley, { type: 'fire', officer: 'security', hostile: 'aegis' }]), /Ceasefire/);
  assert.throws(() => replayCombatCommands('relay', [...parley, { type: 'parley', officer: 'security' }]), /Parley/);
  assert.throws(() => replayCombatCommands('relay', [{ type: 'parley', officer: 'security' }]), /Parley/);
  assert.throws(() => replayCombatCommands('relay', [...firstHit, { type: 'parley', officer: 'security' }]), /Parley/);
  assert.throws(() => replayCombatCommands('relay', [...approach, { type: 'parley', officer: 'science' }]));
  assert.throws(() => replayCombatCommands('relay', [...approach, { type: 'parley', officer: 'security', success: true }]));
});
