import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startExploration, applyExploration } from '../src/spatial.mjs';
import { startCrewSession } from '../src/crewSession.mjs';
import { ConsoleOrderError, availableConsoleOrders, issueConsoleOrder, facedConsole } from '../src/consoleOrders.mjs';
import { currentNode } from '../src/episode.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url)));
const at = (x, y, heading = 'N', area = 'bridge') => ({...startExploration(world),x,y,heading,area});
const available = (position, session) => availableConsoleOrders(world, position, episode, session.episodeState).choices.map(x => x.id);

test('initial commands are partitioned by stations, not available globally', () => {
  const session = startCrewSession(episode);
  assert.deepEqual(available(at(1,4),session),['scan']); // science at 1,3
  assert.deepEqual(available(at(5,3),session),['hail']); // comms at 5,2
  assert.deepEqual(available(at(6,3,'E'),session),['intercept']); // tactical at 7,3
  assert.deepEqual(available(at(3,3),session),[]); // helm at 3,2, no retreat yet
  assert.deepEqual(available(at(4,5),session),[]); // command only handles ultimatum
  assert.deepEqual(available(at(3,5),session),[]);
});

test('science order uses real crew skill/XP and becomes a second command at science console', () => {
  const science = at(1,4);
  const start = startCrewSession(episode);
  const scanned = issueConsoleOrder(world,science,episode,start,'scan');
  assert.equal(scanned.episodeState.nodeId,'analysis');
  assert.equal(scanned.crew.progression.venn.xp,25);
  assert.deepEqual(available(science,scanned),['broadcast']);
  const resolved = issueConsoleOrder(world,science,episode,scanned,'broadcast');
  assert.equal(currentNode(episode,resolved.episodeState).outcome,'peaceful-resolution');
  assert.equal(resolved.crew.progression.venn.xp,75);
  assert.equal(start.episodeState.nodeId,'distress');
});

test('comms and tactics remain distinct from helm and command, even when player knows choice ID', () => {
  const start = startCrewSession(episode);
  assert.throws(()=>issueConsoleOrder(world,at(5,3),episode,start,'scan'),ConsoleOrderError);
  assert.throws(()=>issueConsoleOrder(world,at(6,3,'E'),episode,start,'hail'),ConsoleOrderError);
  const hailed = issueConsoleOrder(world,at(5,3),episode,start,'hail');
  assert.deepEqual(available(at(5,3),hailed),['mediate']);
  assert.deepEqual(available(at(4,5),hailed),['ultimatum']);
  assert.deepEqual(available(at(3,3),hailed),[]);
  const offered = issueConsoleOrder(world,at(4,5),episode,hailed,'ultimatum');
  assert.deepEqual(available(at(3,3),offered),['disengage']);
  assert.deepEqual(available(at(6,3,'E'),offered),['disable']);
});

test('away scene and unaligned positions cannot issue starship orders', () => {
  const session = startCrewSession(episode);
  assert.equal(facedConsole(world,at(4,3,'N','surface')),null);
  assert.deepEqual(available(at(4,3,'N','surface'),session),[]);
  assert.throws(()=>issueConsoleOrder(world,at(4,3,'N','surface'),episode,session,'scan'),ConsoleOrderError);
  assert.throws(()=>issueConsoleOrder(world,at(1,4,'W'),episode,session,'scan'),ConsoleOrderError);
  const offered=applyExploration(world,at(4,5,'S'),{type:'use'}).state;
  assert.equal(facedConsole(world,offered),null);
  assert.throws(()=>issueConsoleOrder(world,offered,episode,session,'hail'),ConsoleOrderError);
});

test('terminating mission leaves no orders and refused choices do not change state', () => {
  const science=at(1,4),start=startCrewSession(episode);
  const done=issueConsoleOrder(world,science,episode,issueConsoleOrder(world,science,episode,start,'scan'),'broadcast');
  assert.deepEqual(available(science,done),[]);
  assert.throws(()=>issueConsoleOrder(world,science,episode,done,'scan'),ConsoleOrderError);
  assert.deepEqual(start.actions,[]);
});
