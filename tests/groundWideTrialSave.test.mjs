import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeGroundExpansion} from '../src/groundWideLayout.mjs';
import {startAwayTeam} from '../src/awayTeam.mjs';
import {startGroundSquadPositions} from '../src/groundSquadPositions.mjs';
import {
 startGroundRealtimeWorld,orderGroundRealtimeWorld,advanceGroundRealtimeWorld,
 groundRealtimeVision,
} from '../src/groundRealtimeWorld.mjs';
import {
 K47_WIDE_TRIAL_ACTIVE_KEY,K47_WIDE_TRIAL_SAVE_KEY,
 groundWideTopologyFingerprint,serializeGroundWideTrial,restoreGroundWideTrial,
} from '../src/groundWideTrialSave.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const original=read('../content/scenes/meridian.json');
const candidate=composeGroundExpansion(original,read('../content/scenes/k47-wide-plan.json'));
const away={...startAwayTeam(),squad:['venn','dorn','mira']};
const legacy=startGroundSquadPositions(candidate,
 {version:1,area:'surface',...candidate.scenes.surface.spawn,pending:null},away);

test('trial always uses a different persistent key and immutable candidate world',()=>{
 assert.notEqual(K47_WIDE_TRIAL_ACTIVE_KEY,K47_WIDE_TRIAL_SAVE_KEY);
 assert.ok(K47_WIDE_TRIAL_SAVE_KEY.includes('k47-wide-trial'));
 assert.equal(original.scenes.surface.width,18);
 assert.equal(candidate.scenes.surface.width,32);
 assert.equal(original.scenes.surface.height,12);
 assert.equal(candidate.scenes.surface.height,20);
});

test('long continuous order, physical fog, 32x20 save/F5 restore never rewrite classic',()=>{
 const start=startGroundRealtimeWorld(candidate,away,legacy);
 const ordered=orderGroundRealtimeWorld(candidate,start,'venn',{x:26,y:4});
 assert.equal(groundRealtimeVision(candidate,ordered).explored.has('26,4'),false,
  'accepted distant route cannot reveal unseen target');
 let mid=ordered;
 for(let i=0;i<24;i++)mid=advanceGroundRealtimeWorld(candidate,mid,80);
 assert.ok(mid.motion.officers[0].x!==start.motion.officers[0].x||
   mid.motion.officers[0].y!==start.motion.officers[0].y);
 assert.equal(groundRealtimeVision(candidate,mid).explored.has('26,4'),false);
 const bytes=serializeGroundWideTrial(candidate,away,legacy,mid);
 const parsed=JSON.parse(bytes);
 assert.equal(parsed.version,1);
 assert.equal(parsed.mapId,'k47-outer-array');
 assert.equal(parsed.topology,groundWideTopologyFingerprint(candidate.scenes.surface));
 assert.deepEqual(restoreGroundWideTrial(candidate,away,legacy,bytes),mid);
 assert.deepEqual(legacy.commands,[]);
 assert.equal(original.scenes.surface.width,18);
});

test('a changed wall map, wrong roster, corrupt save and unrelated mission cannot restore',()=>{
 const initial=startGroundRealtimeWorld(candidate,away,legacy);
 const encoded=serializeGroundWideTrial(candidate,away,legacy,initial);
 const mutate=fn=>{const obj=JSON.parse(encoded);fn(obj);return JSON.stringify(obj);};
 assert.throws(()=>restoreGroundWideTrial(candidate,away,legacy,mutate(x=>x.mapId='meridian')),/Stale/);
 assert.throws(()=>restoreGroundWideTrial(candidate,away,legacy,mutate(x=>x.topology='00000000')),/Stale/);
 assert.throws(()=>restoreGroundWideTrial(candidate,away,legacy,mutate(x=>x.motion='{}')),/Corrupt/);
 assert.throws(()=>restoreGroundWideTrial(candidate,away,legacy,'not-json'));
 assert.throws(()=>restoreGroundWideTrial(candidate,away,legacy,JSON.stringify({version:1})),/Stale/);
 const changed=structuredClone(candidate);
 changed.scenes.surface.walls.push({x:20,y:2});
 assert.notEqual(groundWideTopologyFingerprint(changed.scenes.surface),
  groundWideTopologyFingerprint(candidate.scenes.surface));
 assert.throws(()=>restoreGroundWideTrial(changed,away,legacy,encoded),/Stale/);
});
