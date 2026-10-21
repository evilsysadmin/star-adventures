import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentNode } from '../src/episode.mjs';
import { replayCommands, serializeSave } from '../src/save.mjs';
import { applyCrewAction, startCrewSession, replayCrewActions, serializeCrewCheckpoint, deserializeCrewCheckpoint, migrateLegacyCheckpoint, CrewSaveError } from '../src/crewSession.mjs';

const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url), 'utf8'));
const order = choiceId => ({ type: 'order', choiceId });

test('crew staffing, XP and mission outcome round-trip through a command-only v2 checkpoint', () => {
  const commands = [{ type: 'assign', station: 'science', officerId: 'dorn' }, order('scan'), order('broadcast')];
  const session = replayCrewActions(episode, commands);
  assert.equal(currentNode(episode, session.episodeState).outcome, 'withdrawal');
  assert.equal(session.crew.assignments.science, 'dorn');
  assert.equal(session.crew.progression.dorn.xp, 50);
  const raw = serializeCrewCheckpoint(episode, session);
  assert.deepEqual(deserializeCrewCheckpoint(episode, raw), session);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['actions', 'episodeId', 'saveVersion']);
  assert.equal(JSON.parse(raw).saveVersion, 2);
});

test('restart keeps crew progression and assignments while opening a new episode', () => {
  const session = replayCrewActions(episode, [order('scan'), order('broadcast'), { type: 'restart' }, order('hail')]);
  assert.equal(session.crew.progression.venn.xp, 75);
  assert.equal(session.episodeState.nodeId, 'parley');
  assert.equal(session.episodeState.log.length, 1);
  assert.deepEqual(deserializeCrewCheckpoint(episode, serializeCrewCheckpoint(episode, session)), session);
});

test('v1 checkpoint migration preserves exact old mission without retroactive skill bonuses', () => {
  const original = replayCommands(episode, ['scan', 'broadcast']);
  const migrated = migrateLegacyCheckpoint(episode, serializeSave(episode, original));
  assert.deepEqual(migrated.episodeState, original);
  assert.equal(migrated.crew.progression.venn.xp, 0);
  const continued = applyCrewAction(episode, migrated, { type: 'restart' });
  assert.equal(continued.episodeState.nodeId, episode.start);
  assert.deepEqual(deserializeCrewCheckpoint(episode, serializeCrewCheckpoint(episode, continued)), continued);
});

test('tampered derived XP or ship statistics are rejected', () => {
  const session = replayCrewActions(episode, [order('intercept'), order('disable')]);
  assert.throws(() => serializeCrewCheckpoint(episode, { ...session, episodeState: { ...session.episodeState, stats: { ...session.episodeState.stats, shipDamage: 999 } } }), CrewSaveError);
  assert.throws(() => serializeCrewCheckpoint(episode, { ...session, crew: { ...session.crew, progression: { ...session.crew.progression, dorn: { xp: 999, level: 5 } } } }), CrewSaveError);
});

test('unknown orders, invalid actors, bogus versions and oversized checkpoint data fail closed', () => {
  const initial = startCrewSession(episode);
  for (const action of [{ type: 'nope' }, { type: 'assign', station: 'warp', officerId: 'venn' }, { type: 'order', choiceId: 'fake' }, { type: 'restart', extra: true }]) {
    assert.throws(() => applyCrewAction(episode, initial, action), CrewSaveError);
  }
  for (const raw of ['{', '', 'x'.repeat(65537), JSON.stringify({ saveVersion: 99, episodeId: episode.id, actions: [] }), JSON.stringify({ saveVersion: 2, episodeId: 'other', actions: [] })]) {
    assert.throws(() => deserializeCrewCheckpoint(episode, raw), CrewSaveError);
  }
  assert.throws(() => replayCrewActions(episode, Array(513).fill({ type: 'restart' })), CrewSaveError);
  assert.deepEqual(initial.actions, []);
});
