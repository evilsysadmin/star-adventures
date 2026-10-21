import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { choose, startEpisode } from '../src/episode.mjs';
import { deserializeSave, serializeSave, replayCommands, SaveError } from '../src/save.mjs';

const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url), 'utf8'));
const run = (...commands) => replayCommands(episode, commands);

test('round-trip restore replays science, diplomacy, battle and withdrawal outcomes', () => {
  for (const commands of [[], ['scan'], ['scan', 'broadcast'], ['hail', 'mediate'], ['intercept', 'disable'], ['hail', 'ultimatum', 'disengage']]) {
    const state = run(...commands);
    const restored = deserializeSave(episode, serializeSave(episode, state));
    assert.deepEqual(restored, state);
  }
});

test('saved checkpoint contains only version, episode id and player commands', () => {
  const obj = JSON.parse(serializeSave(episode, run('scan')));
  assert.deepEqual(obj, { saveVersion: 1, episodeId: 'border-signal', commands: ['scan'] });
});

test('tampered stats and altered event history are not accepted for serialization', () => {
  const good = run('scan');
  assert.throws(() => serializeSave(episode, { ...good, stats: { ...good.stats, science: 99 } }), SaveError);
  assert.throws(() => serializeSave(episode, { ...good, nodeId: 'parley' }), SaveError);
  assert.throws(() => serializeSave(episode, { ...good, log: [{ ...good.log[0], next: 'parley' }] }), SaveError);
});

test('malformed, wrong-version, wrong-episode, oversized and bogus commands fail closed', () => {
  const invalid = [
    '{', '', 'x'.repeat(32769), 'null', '[]',
    JSON.stringify({ saveVersion: 2, episodeId: episode.id, commands: [] }),
    JSON.stringify({ saveVersion: 1, episodeId: 'other', commands: [] }),
    JSON.stringify({ saveVersion: 1, episodeId: episode.id, commands: ['fake'] }),
    JSON.stringify({ saveVersion: 1, episodeId: episode.id, commands: ['scan', 'broadcast', 'scan'] }),
    JSON.stringify({ saveVersion: 1, episodeId: episode.id, commands: Array(257).fill('scan') }),
  ];
  for (const input of invalid) assert.throws(() => deserializeSave(episode, input), SaveError);
});

test('valid commands cannot mutate starting state', () => {
  const original = startEpisode(episode);
  const advanced = choose(episode, original, 'hail');
  assert.equal(original.nodeId, 'distress');
  assert.equal(advanced.nodeId, 'parley');
});
