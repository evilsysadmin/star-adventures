import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startEpisode, currentNode } from '../src/episode.mjs';
import { CrewError, STATIONS, OFFICERS, startCrew, validateCrew, assignOfficer, officerAt, issueCrewOrder } from '../src/crew.mjs';

const episode = JSON.parse(readFileSync(new URL('../content/episodes/border-signal.json', import.meta.url), 'utf8'));
const run = (commands, crew = startCrew()) => commands.reduce((state, choiceId) => {
  const result = issueCrewOrder(episode, state.episodeState, state.crew, choiceId);
  return { episodeState: result.episodeState, crew: result.crew };
}, { episodeState: startEpisode(episode), crew });

test('six distinct named officers occupy six unique stations', () => {
  const crew = startCrew();
  assert.equal(STATIONS.length, 6);
  assert.equal(OFFICERS.length, 6);
  assert.equal(new Set(STATIONS.map(station => crew.assignments[station])).size, 6);
  assert.equal(validateCrew(crew), true);
});

test('assigning an officer swaps station occupants without mutating prior state', () => {
  const before = startCrew();
  const after = assignOfficer(before, 'science', 'dorn');
  assert.equal(before.assignments.science, 'venn');
  assert.equal(after.assignments.science, 'dorn');
  assert.equal(after.assignments.tactical, 'venn');
  assert.equal(new Set(Object.values(after.assignments)).size, 6);
  assert.throws(() => assignOfficer(after, 'unknown', 'mira'), CrewError);
  assert.throws(() => assignOfficer(after, 'science', 'bogus'), CrewError);
});

test('science and diplomacy can win the mission with a skilled station officer', () => {
  const science = run(['scan', 'broadcast']);
  const peace = run(['hail', 'mediate']);
  assert.equal(currentNode(episode, science.episodeState).outcome, 'peaceful-resolution');
  assert.equal(currentNode(episode, peace.episodeState).outcome, 'peaceful-resolution');
  assert.equal(science.episodeState.stats.science, 5);
  assert.equal(peace.episodeState.stats.diplomacy, 5);
  assert.equal(science.episodeState.log[1].officerId, 'venn');
  assert.equal(peace.episodeState.log[1].check, 'passed');
});

test('underqualified scientist fails critical broadcast and changes outcome', () => {
  const crew = assignOfficer(startCrew(), 'science', 'dorn');
  const result = run(['scan', 'broadcast'], crew);
  assert.equal(currentNode(episode, result.episodeState).outcome, 'withdrawal');
  assert.equal(result.episodeState.log[1].check, 'failed');
  assert.equal(result.episodeState.log[1].skill, 1);
});

test('diplomatic incompetence and weak tactical command have different consequences', () => {
  const diplomatic = run(['hail', 'mediate'], assignOfficer(startCrew(), 'diplomacy', 'dorn'));
  const tactical = run(['intercept', 'disable'], assignOfficer(startCrew(), 'tactical', 'venn'));
  assert.equal(currentNode(episode, diplomatic.episodeState).outcome, 'withdrawal');
  assert.equal(currentNode(episode, tactical.episodeState).outcome, 'withdrawal');
  assert.equal(tactical.episodeState.stats.shipDamage, 4);
  assert.equal(tactical.episodeState.log[1].check, 'failed');
});

test('a trained tactical officer prevents damage, but the mission still records a tactical ending', () => {
  const result = run(['intercept', 'disable']);
  assert.equal(currentNode(episode, result.episodeState).outcome, 'tactical-resolution');
  assert.equal(result.episodeState.stats.shipDamage, 1);
});

test('repeated orders accumulate XP, levels and a bounded skill increase deterministically', () => {
  let crew = startCrew();
  let last;
  for (let i = 0; i < 4; i++) {
    last = issueCrewOrder(episode, startEpisode(episode), crew, 'scan');
    crew = last.crew;
  }
  assert.equal(crew.progression.venn.xp, 100);
  assert.equal(officerAt(crew, 'science').level, 2);
  assert.equal(officerAt(crew, 'science').skill, 4);
  assert.deepEqual(last.crew, crew);
});

test('invalid progression, duplicate staffing and fabricated unavailable choices fail safely', () => {
  const crew = startCrew();
  crew.assignments.science = 'varela';
  assert.throws(() => validateCrew(crew), CrewError);
  const original = startCrew();
  assert.throws(() => issueCrewOrder(episode, startEpisode(episode), original, 'broadcast'), CrewError);
  original.progression.venn.level = 99;
  assert.throws(() => validateCrew(original), CrewError);
});
