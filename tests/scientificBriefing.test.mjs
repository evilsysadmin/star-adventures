import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew } from '../src/crew.mjs';
import { startAwayTeam, investigateProbe } from '../src/awayTeam.mjs';
import {
  MandateError, startMandate, classifiedMandateReport, serializeMandateCheckpoint,
  deserializeMandateCheckpoint,
} from '../src/dualMandate.mjs';
import { reconcileObservedProbe, PROBE_SURVEY_INCIDENT } from '../src/observedMandate.mjs';
import { canBriefScientificFinding, briefScientificFinding } from '../src/scientificBriefing.mjs';

const def = JSON.parse(readFileSync(new URL('../content/mandates/outpost-orders.json', import.meta.url)));
const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const onSurface = { version: 1, area: 'surface', x: 4, y: 3, heading: 'N', pending: null };
const atChair = { version: 1, area: 'bridge', x: 4, y: 5, heading: 'N', pending: null };
const wrongDirection = { ...atChair, heading: 'S' };
const awayFromChair = { ...atChair, x: 3 };
function realSurvey() {
  const away = investigateProbe(world, onSurface, startCrew(), startAwayTeam()).state;
  const mandate = reconcileObservedProbe(def, startMandate(def), away);
  return { away, mandate };
}

test('a valid discovery can be briefed once only at the physically accessed captain chair', () => {
  const { away, mandate } = realSurvey();
  assert.equal(canBriefScientificFinding(def, mandate, away, world, atChair, null), false);
  assert.equal(canBriefScientificFinding(def, mandate, away, world, awayFromChair, 'captain'), false);
  assert.equal(canBriefScientificFinding(def, mandate, away, world, wrongDirection, 'captain'), false);
  assert.equal(canBriefScientificFinding(def, mandate, away, world, atChair, 'science'), false);
  assert.equal(canBriefScientificFinding(def, mandate, away, world, atChair, 'captain'), true);
  const after = briefScientificFinding(def, mandate, away, world, atChair, 'captain');
  assert.deepEqual(after.knowledge.solan, [PROBE_SURVEY_INCIDENT]);
  assert.deepEqual(mandate.knowledge.solan, []);
  assert.equal(after.actions.length, mandate.actions.length + 1);
  assert.equal(after.actions.at(-1).type, 'inform');
  assert.equal(after.actions.at(-1).from, 'captain');
  assert.equal(after.actions.at(-1).to, 'solan');
  assert.equal(classifiedMandateReport(def, after).incidents[0].knownBy.includes('solan'), true);
  assert.equal(canBriefScientificFinding(def, after, away, world, atChair, 'captain'), false);
  assert.throws(() => briefScientificFinding(def, after, away, world, atChair, 'captain'), MandateError);
});

test('no report, insufficient science, or unrecorded evidence cannot enable the debrief', () => {
  const untouched = startMandate(def);
  const emptyAway = startAwayTeam();
  assert.equal(canBriefScientificFinding(def, untouched, emptyAway, world, atChair, 'captain'), false);
  assert.throws(() => briefScientificFinding(def, untouched, emptyAway, world, atChair, 'captain'), MandateError);
  const { away } = realSurvey();
  assert.equal(canBriefScientificFinding(def, untouched, away, world, atChair, 'captain'), false,
    'awaiting reconciliation is not an already recorded discovery');
});

test('a real briefing and source witness remain identical after versioned save replay', () => {
  const { away, mandate } = realSurvey();
  const informed = briefScientificFinding(def, mandate, away, world, atChair, 'captain');
  const restored = deserializeMandateCheckpoint(def, serializeMandateCheckpoint(def, informed));
  assert.deepEqual(restored, informed);
  assert.equal(restored.incidents[0].witnesses.includes(away.lastReport.officerId), true);
  assert.equal(restored.knowledge.solan.includes(PROBE_SURVEY_INCIDENT), true);
  assert.equal(canBriefScientificFinding(def, restored, away, world, atChair, 'captain'), false);
});

test('invented mandate outcomes and invalid away reports cannot authorize briefing', () => {
  const { away, mandate } = realSurvey();
  const fake = { ...mandate, knowledge: { ...mandate.knowledge,
    solan: [PROBE_SURVEY_INCIDENT] } };
  assert.throws(() => canBriefScientificFinding(def, fake, away, world, atChair, 'captain'), MandateError);
  const wrongWitness = { ...away, lastReport: { ...away.lastReport, officerId: 'unknown' } };
  assert.throws(() => canBriefScientificFinding(def, mandate, wrongWitness, world, atChair, 'captain'));
  const wrongScene = { ...atChair, area: 'surface' };
  assert.equal(canBriefScientificFinding(def, mandate, away, world, wrongScene, 'captain'), false);
});
