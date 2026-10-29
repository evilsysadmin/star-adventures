import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startExploration, applyExploration } from '../src/spatial.mjs';
import { startCrewSession } from '../src/crewSession.mjs';
import { captainOrders, issueCaptainOrder, requestCaptainTransport } from '../src/captainOrders.mjs';
const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url)));
test('captain resolves the conflict through science without moving, with real crew progression', () => {
  const pose = startExploration(world), initial = startCrewSession(episode);
  const scanned = issueCaptainOrder(world, pose, episode, initial, 'science', 'scan');
  const done = issueCaptainOrder(world, pose, episode, scanned, 'science', 'broadcast');
  assert.equal(done.episodeState.nodeId, 'peace');
  assert.equal(done.crew.progression.venn.xp, 75);
  assert.deepEqual(pose, startExploration(world));
  assert.equal(initial.episodeState.nodeId, 'distress');
  assert.deepEqual(captainOrders(world, pose, episode, done.episodeState, 'science').choices, []);
});
test('station, area and pending transport authorize orders independently of UI', () => {
  const pose = startExploration(world), session = startCrewSession(episode);
  for (const station of ['comms', 'captain', 'transporter', null])
    assert.throws(() => issueCaptainOrder(world, pose, episode, session, station, 'scan'));
  const pending = requestCaptainTransport(world, pose).state;
  assert.throws(() => issueCaptainOrder(world, pending, episode, session, 'science', 'scan'));
  assert.deepEqual(applyExploration(world, pending, { type: 'decline' }).state, pose);
  const surface = applyExploration(world, pending, { type: 'confirm' }).state;
  assert.equal(surface.area, 'surface');
  assert.throws(() => issueCaptainOrder(world, surface, episode, session, 'science', 'scan'));
  assert.throws(() => requestCaptainTransport(world, surface));
});
