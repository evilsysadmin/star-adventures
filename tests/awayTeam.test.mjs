import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCrew } from '../src/crew.mjs';
import { startExploration } from '../src/spatial.mjs';
import { startAwayTeam, validateAwayTeam, selectAwayOfficer, investigateProbe, AwayTeamError, PROBE_FINDING } from '../src/awayTeam.mjs';
import { serializeAwayTeam, deserializeAwayTeam, recoverAwayTeam, AwayCheckpointError } from '../src/awayCheckpoint.mjs';

const world = JSON.parse(readFileSync(new URL('../content/scenes/meridian.json', import.meta.url)));
const bridge = startExploration(world);
const probe = { version:1, area:'surface', x:4, y:3, heading:'N', pending:null };
test('default team has distinct real officers and validated state', () => {
  assert.deepEqual(startAwayTeam().squad, ['venn','dorn','mira']);
  assert.equal(validateAwayTeam(startAwayTeam()),true);
});
test('can select exactly three unique officers, and only from the ship', () => {
  const initial = startAwayTeam();
  const changed = selectAwayOfficer(initial,0,'rhee',bridge);
  assert.deepEqual(changed.squad,['rhee','dorn','mira']);
  assert.deepEqual(initial.squad,['venn','dorn','mira']);
  assert.throws(()=>selectAwayOfficer(initial,0,'dorn',bridge),AwayTeamError);
  assert.throws(()=>selectAwayOfficer(initial,0,'fake',bridge),AwayTeamError);
  assert.throws(()=>selectAwayOfficer(initial,3,'rhee',bridge),AwayTeamError);
  assert.throws(()=>selectAwayOfficer(initial,0,'rhee',probe),AwayTeamError);
  assert.throws(()=>selectAwayOfficer(initial,0,'rhee',{...bridge,pending:{id:'transporter',to:'surface'}}),AwayTeamError);
});
test('real probe inspection uses best deployed scientist and discovers evidence once', () => {
  const start = startAwayTeam();
  const outcome = investigateProbe(world,probe,startCrew(),start);
  assert.deepEqual(outcome.report,{officerId:'venn',skill:4,result:'success'});
  assert.deepEqual(outcome.state.findings,[PROBE_FINDING]);
  assert.equal(outcome.state.attempts,1);
  assert.deepEqual(start.findings,[]);
  assert.throws(()=>investigateProbe(world,probe,startCrew(),outcome.state),AwayTeamError);
});
test('deploying undertrained officers fails probe without making up a discovery', () => {
  let squad=startAwayTeam();
  squad=selectAwayOfficer(squad,0,'varela',bridge);
  squad=selectAwayOfficer(squad,2,'solan',bridge);
  const result=investigateProbe(world,probe,startCrew(),squad);
  assert.equal(result.report.result,'insufficient-science');
  assert.equal(result.state.findings.length,0);
  assert.equal(result.report.officerId,'solan');
  assert.equal(result.report.skill,2);
  assert.deepEqual(squad.findings,[]);
});
test('remote scans from bridge, wrong heading, and unadjacent tile are rejected', () => {
  for(const position of [bridge,{...probe,heading:'S'},{...probe,y:5}]) {
    assert.throws(()=>investigateProbe(world,position,startCrew(),startAwayTeam()),AwayTeamError);
  }
});
test('away snapshot survives F5, invalid shape/future versions recover safely', () => {
  const completed=investigateProbe(world,probe,startCrew(),startAwayTeam()).state;
  assert.deepEqual(deserializeAwayTeam(serializeAwayTeam(completed)),completed);
  for(const raw of ['{','x'.repeat(2049),'{"saveVersion":99}',JSON.stringify({...JSON.parse(serializeAwayTeam(completed)),findings:['made-up']})]){
    assert.throws(()=>deserializeAwayTeam(raw),AwayCheckpointError);
    assert.deepEqual(recoverAwayTeam(raw).state,startAwayTeam());
  }
  assert.equal(recoverAwayTeam(null).notice,'fresh');
  assert.equal(recoverAwayTeam(serializeAwayTeam(completed)).notice,'restored');
});
