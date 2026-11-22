// The 32x20 candidate is not the canonical 18x12 campaign. Never reuse its
// motion sidecar or old-world command journal: the prototype's identity,
// topology and storage are deliberately independent. No browser imports.
import {restoreGroundRealtimeWorld,serializeGroundRealtimeWorld} from './groundRealtimeWorld.mjs';

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

export function serializeGroundWideTrial(world,away,legacy,state){
  const fingerprint=groundWideTopologyFingerprint(world.scenes.surface);
  const motion=serializeGroundRealtimeWorld(world,away,legacy,state);
  return JSON.stringify({version:1,mapId:'k47-outer-array',topology:fingerprint,motion});
}

export function restoreGroundWideTrial(world,away,legacy,raw){
  if(typeof raw!=='string'||raw.length>250000)
    throw new TypeError('Invalid wide trial save');
  const data=JSON.parse(raw);
  if(!data||Array.isArray(data)||data.version!==1||
      Object.keys(data).sort().join('|')!=='mapId|motion|topology|version'||
      data.mapId!=='k47-outer-array'||
      data.topology!==groundWideTopologyFingerprint(world.scenes.surface)||
      typeof data.motion!=='string')
    throw new TypeError('Stale or foreign wide trial save');
  const restored=restoreGroundRealtimeWorld(world,away,legacy,data.motion);
  if(restored.source!=='realtime')throw new TypeError('Corrupt wide trial motion');
  return restored.state;
}
