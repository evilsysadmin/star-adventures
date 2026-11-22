// The 32x20 candidate is not the canonical 18x12 campaign. Never reuse its
// motion sidecar or old-world command journal: the prototype's identity,
// topology and storage are deliberately independent. No browser imports.
import {restoreGroundRealtimeWorld,serializeGroundRealtimeWorld} from './groundRealtimeWorld.mjs';
import {startWideMission,validateWideMission} from './groundWideMission.mjs';

export const K47_WIDE_TRIAL_ACTIVE_KEY='shadowops.star-adventures.k47-wide-trial.active.v1';
export const K47_WIDE_TRIAL_SAVE_KEY='shadowops.star-adventures.k47-wide-trial.motion.v1';

export function groundWideTopologyFingerprint(scene){
  if(!Number.isSafeInteger(scene?.width)||!Number.isSafeInteger(scene?.height)||
      !Array.isArray(scene.walls)||!Array.isArray(scene.objects))
    throw new TypeError('Invalid wide trial topology');
  // Stable canonical wall/object coordinates: any change invalidates an old
  // in-progress route, rather than silently interpreting it on a new map.
  const cells=items=>items.map(({x,y})=>x+','+y).sort().join(';');
  const source=[scene.width,scene.height,cells(scene.walls),
    cells(scene.objects),scene.spawn.x,scene.spawn.y].join('|');
  let hash=2166136261;
  for(let i=0;i<source.length;i++){
    hash=Math.imul(hash^source.charCodeAt(i),16777619)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}

// Writing a campaign produces one atomic V2 envelope. Historic V1 640-cell
// exploration sidecars remain readable and acquire an empty mission snapshot
// without ever reverting to the original 18x12 K-47 save.
/** @typedef {{
 *   version: 1,
 *   powerRoute: 'life-support'|'research'|null,
 *   evidence: 'sealed'|'verified'|null,
 *   journal: Array<{code:string,officerId:string}>
 * }} WideMissionSnapshot
 */
/** @param {WideMissionSnapshot | null} [mission] */
export function serializeGroundWideTrial(world,away,legacy,state,mission=null){
  const fingerprint=groundWideTopologyFingerprint(world.scenes.surface);
  const motion=serializeGroundRealtimeWorld(world,away,legacy,state);
  if(mission===null)
    return JSON.stringify({version:1,mapId:'k47-outer-array',topology:fingerprint,motion});
  validateWideMission(mission,away.squad);
  return JSON.stringify({
    version:2,mapId:'k47-outer-array',topology:fingerprint,
    motion,mission,
  });
}

export function restoreGroundWideCampaign(world,away,legacy,raw){
  if(typeof raw!=='string'||raw.length>250000)
    throw new TypeError('Invalid wide trial save');
  const data=JSON.parse(raw);
  const v1=data?.version===1&&
    Object.keys(data).sort().join('|')==='mapId|motion|topology|version';
  const v2=data?.version===2&&
    Object.keys(data).sort().join('|')==='mapId|mission|motion|topology|version';
  if(!data||Array.isArray(data)||(!v1&&!v2)||
      data.mapId!=='k47-outer-array'||
      data.topology!==groundWideTopologyFingerprint(world.scenes.surface)||
      typeof data.motion!=='string')
    throw new TypeError('Stale or foreign wide trial save');
  const restored=restoreGroundRealtimeWorld(world,away,legacy,data.motion);
  if(restored.source!=='realtime')throw new TypeError('Corrupt wide trial motion');
  const mission=v1?startWideMission():data.mission;
  validateWideMission(mission,away.squad);
  return {
    motion:restored.state,
    mission:{
      version:mission.version,powerRoute:mission.powerRoute,
      evidence:mission.evidence,journal:mission.journal.map(e=>({...e})),
    },
  };
}

// Backwards-compatible motion-only API used by existing historical callers.
export function restoreGroundWideTrial(world,away,legacy,raw){
  return restoreGroundWideCampaign(world,away,legacy,raw).motion;
}
