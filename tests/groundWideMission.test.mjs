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
 startWideMission,validateWideMission,validateWideMissionTargets,
 wideMissionConsequences,wideMissionOfficerInRange,applyWideMissionAction,
 WIDE_MISSION_TARGETS,
} from '../src/groundWideMission.mjs';
import {
 serializeGroundWideTrial,restoreGroundWideTrial,restoreGroundWideCampaign,
 groundWideTopologyFingerprint,
} from '../src/groundWideTrialSave.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const original=read('../content/scenes/meridian.json');
const plan=read('../content/scenes/k47-wide-plan.json');
const world=composeGroundExpansion(original,plan);
const away={...startAwayTeam(),squad:['venn','dorn','mira']};
const legacy=startGroundSquadPositions(world,
 {version:1,area:'surface',...world.scenes.surface.spawn,pending:null},away);
const spawn=()=>startGroundRealtimeWorld(world,away,legacy);
function go(state,to){
 let next=orderGroundRealtimeWorld(world,state,'venn',to);
 for(let i=0;i<800&&next.motion.officers.find(o=>o.id==='venn').route.length;i++){
   next=advanceGroundRealtimeWorld(world,next,80);
 }
 const officer=next.motion.officers.find(o=>o.id==='venn');
 assert.equal(officer.route.length,0,'physically completed route');
 assert.ok(Math.hypot(officer.x-to.x,officer.y-to.y)<.01);
 return next;
}

test('real trial has exactly 2 live physical interaction points, no effect on canonical rescue',()=>{
 assert.equal(validateWideMissionTargets(world,plan),true);
 assert.deepEqual(WIDE_MISSION_TARGETS['relay-power'],{x:18,y:15});
 assert.deepEqual(WIDE_MISSION_TARGETS['lab-evidence'],{x:27,y:13});
 const before=JSON.stringify(original),old=JSON.stringify(legacy);
 const initial=startWideMission();
 assert.deepEqual(wideMissionConsequences(initial),{
  relayRestored:false,lifeSupportBacked:false,laboratoryPowered:false,
  samplesPreserved:false,evidenceVerified:false,complete:false,
 });
 assert.equal(JSON.stringify(original),before);
 assert.equal(JSON.stringify(legacy),old);
 assert.equal(world.scenes.surface.width*world.scenes.surface.height,640);
});

test('remote activation, diagonals, walking actors and lab-before-power are impossible',()=>{
 const start=spawn(),mission=startWideMission();
 assert.equal(wideMissionOfficerInRange(start,'venn',WIDE_MISSION_TARGETS['relay-power']),false);
 assert.throws(()=>applyWideMissionAction(world,plan,start,mission,'venn','relay.research'),/selected officer/);
 assert.throws(()=>applyWideMissionAction(world,plan,start,mission,'venn','lab.collect'),/selected officer/);
 const moving=orderGroundRealtimeWorld(world,start,'venn',{x:18,y:15});
 assert.throws(()=>applyWideMissionAction(world,plan,moving,mission,'venn','relay.research'),/selected officer/);
 const reached=go(start,{x:18,y:15});
 assert.throws(()=>applyWideMissionAction(world,plan,reached,mission,'dorn','relay.research'),/selected officer/);
 assert.throws(()=>applyWideMissionAction(world,plan,reached,mission,'venn','lab.collect'),/selected officer/);
 assert.throws(()=>applyWideMissionAction(world,plan,reached,mission,'venn','relay.hacked'),/unknown order/);
 const relay=applyWideMissionAction(world,plan,reached,mission,'venn','relay.life-support');
 assert.throws(()=>applyWideMissionAction(world,plan,reached,relay,'venn','relay.research'),/final/);
 assert.deepEqual(mission,startWideMission(),'invalid actions cannot mutate input');
});

test('civilian life support and science funding are irrevocable meaningful alternative branches',()=>{
 const atRelay=go(spawn(),{x:18,y:15});
 const support=applyWideMissionAction(world,plan,atRelay,startWideMission(),
  'venn','relay.life-support');
 const science=applyWideMissionAction(world,plan,atRelay,startWideMission(),
  'venn','relay.research');
 assert.deepEqual(support.journal,[{code:'relay.life-support',officerId:'venn'}]);
 assert.deepEqual(science.journal,[{code:'relay.research',officerId:'venn'}]);
 const supportEffects=wideMissionConsequences(support);
 assert.equal(supportEffects.lifeSupportBacked,true);
 assert.equal(supportEffects.laboratoryPowered,false);
 assert.equal(supportEffects.complete,false);
 const scienceEffects=wideMissionConsequences(science);
 assert.equal(scienceEffects.lifeSupportBacked,false);
 assert.equal(scienceEffects.laboratoryPowered,true);
 assert.equal(scienceEffects.complete,false);
 assert.deepEqual(startWideMission().journal,[]);
});

test('same physical lab entry completes distinct research or rescue outcomes, persists after F5',()=>{
 const relay=go(spawn(),{x:18,y:15});
 const lab=go(relay,{x:27,y:13});
 assert.ok(groundRealtimeVision(world,lab).explored.has('27,13'));
 for(const [route,evidence] of [['life-support','sealed'],['research','verified']]){
   const cmd='relay.'+route;
   const first=applyWideMissionAction(world,plan,relay,startWideMission(),'venn',cmd);
   assert.throws(()=>applyWideMissionAction(world,plan,lab,startWideMission(),'venn','lab.collect'),/requires restored power/);
   const completed=applyWideMissionAction(world,plan,lab,first,'venn','lab.collect');
   assert.equal(completed.evidence,evidence);
   assert.equal(completed.journal.length,2);
   assert.equal(completed.journal[1].code,'lab.'+evidence);
   assert.equal(wideMissionConsequences(completed).complete,true);
   assert.equal(wideMissionConsequences(completed).evidenceVerified,evidence==='verified');
   assert.equal(wideMissionConsequences(completed).lifeSupportBacked,route==='life-support');
   assert.throws(()=>applyWideMissionAction(world,plan,lab,completed,'venn','lab.collect'),/cannot be repeated/);
   const bytes=serializeGroundWideTrial(world,away,legacy,lab,completed);
   const envelope=JSON.parse(bytes);
   assert.equal(envelope.version,2);
   assert.equal(envelope.topology,groundWideTopologyFingerprint(world.scenes.surface));
   assert.deepEqual(restoreGroundWideCampaign(world,away,legacy,bytes),{
      motion:lab,mission:completed,
   });
   assert.deepEqual(restoreGroundWideTrial(world,away,legacy,bytes),lab,
     'legacy motion-only API still correctly restores V2');
 }
});

test('old V1 saves migrate losslessly with a new empty objective journal',()=>{
 const previous=go(spawn(),{x:11,y:5});
 const v1=serializeGroundWideTrial(world,away,legacy,previous);
 assert.equal(JSON.parse(v1).version,1);
 const restored=restoreGroundWideCampaign(world,away,legacy,v1);
 assert.deepEqual(restored,{motion:previous,mission:startWideMission()});
 const v2=serializeGroundWideTrial(world,away,legacy,restored.motion,restored.mission);
 assert.equal(JSON.parse(v2).version,2);
 assert.deepEqual(restoreGroundWideCampaign(world,away,legacy,v2),restored);
});

test('forged events, fabricated verification, changed topology and extra schema fields fail closed',()=>{
 const relay=go(spawn(),{x:18,y:15});
 const saved=serializeGroundWideTrial(world,away,legacy,relay,applyWideMissionAction(
   world,plan,relay,startWideMission(),'venn','relay.life-support'));
 const mutate=fn=>{const o=JSON.parse(saved);fn(o);return JSON.stringify(o);};
 const throws=raw=>assert.throws(()=>restoreGroundWideCampaign(world,away,legacy,raw),/Invalid|Stale|foreign/);
 throws(mutate(x=>x.mission.powerRoute='research'));
 throws(mutate(x=>x.mission.evidence='verified'));
 throws(mutate(x=>x.mission.journal.push({code:'lab.verified',officerId:'venn'})));
 throws(mutate(x=>x.mission.journal[0].officerId='outsider'));
 throws(mutate(x=>x.mission.extra='forged'));
 throws(mutate(x=>x.something='forged'));
 throws(mutate(x=>x.mapId='meridian'));
 throws(mutate(x=>x.topology='not-a-real-topology'));
 throws(mutate(x=>x.motion='{}'));
 const changed=structuredClone(world);changed.scenes.surface.walls.push({x:18,y:15});
 assert.throws(()=>restoreGroundWideCampaign(changed,away,legacy,saved),/Stale/);
 assert.equal(original.scenes.surface.width,18);
});
