import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateEpisode, startEpisode, currentNode, choose, EpisodeError } from '../src/episode.mjs';

const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url), 'utf8'));
const run = (...commands) => commands.reduce((state, command) => choose(episode, state, command), startEpisode(episode));

test('episode graph is structurally valid and complete', () => {
  assert.equal(validateEpisode(episode), true);
  assert.equal(Object.keys(episode.nodes).length, 7);
});

test('science, diplomacy and tactical decisions reach three endings', () => {
  const science = run('scan', 'broadcast');
  const diplomacy = run('hail', 'mediate');
  const tactical = run('intercept', 'disable');
  assert.equal(currentNode(episode, science).outcome, 'peaceful-resolution');
  assert.equal(currentNode(episode, diplomacy).outcome, 'peaceful-resolution');
  assert.equal(currentNode(episode, tactical).outcome, 'tactical-resolution');
  assert.equal(currentNode(episode, run('hail', 'ultimatum', 'disengage')).outcome, 'withdrawal');
  assert.deepEqual(science.stats, { science: 3, diplomacy: 0, shipDamage: 0 });
  assert.deepEqual(diplomacy.stats, { science: 0, diplomacy: 3, shipDamage: 0 });
  assert.deepEqual(tactical.stats, { science: 0, diplomacy: 0, shipDamage: 3 });
});

test('choices are deterministic and do not mutate previous state', () => {
  const initial = startEpisode(episode);
  const first = choose(episode, initial, 'scan');
  assert.equal(initial.nodeId, 'distress');
  assert.deepEqual(initial.log, []);
  assert.deepEqual(run('scan', 'broadcast'), run('scan', 'broadcast'));
  assert.deepEqual(first.log, [{ nodeId: 'distress', choiceId: 'scan', next: 'analysis', effects: { science: 1 } }]);
});

test('unavailable choices and completed runs are rejected', () => {
  assert.throws(() => run('not-a-choice'), EpisodeError);
  assert.throws(() => choose(episode, run('scan', 'broadcast'), 'scan'), EpisodeError);
  assert.throws(() => currentNode(episode, { schemaVersion: 1, episodeId: 'wrong', nodeId: 'distress' }), EpisodeError);
});

test('dangling destinations, unreachable nodes, and invalid effects fail validation', () => {
  const copy = () => structuredClone(episode);
  const dangling = copy();
  dangling.nodes.distress.choices[0].next = 'missing';
  assert.throws(() => validateEpisode(dangling), EpisodeError);
  const unreachable = copy();
  unreachable.nodes.orphan = { text: 'No route leads here', outcome: 'orphan' };
  assert.throws(() => validateEpisode(unreachable), EpisodeError);
  const invalid = copy();
  invalid.nodes.distress.choices[0].effects = { __proto__: 1, science: 0.5 };
  assert.throws(() => validateEpisode(invalid), EpisodeError);
  const trap = copy();
  trap.nodes.analysis.choices = [{ id: 'loop', label: 'Endless loop', next: 'analysis' }];
  assert.throws(() => validateEpisode(trap), EpisodeError);
});

test('a terminal outcome is always reachable from each node', () => {
  const terminals = new Set();
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = episode.nodes[id];
    if (node.outcome) terminals.add(node.outcome);
    for (const choice of node.choices ?? []) visit(choice.next);
  };
  visit(episode.start);
  assert.deepEqual([...terminals].sort(), ['peaceful-resolution', 'tactical-resolution', 'withdrawal']);
});
