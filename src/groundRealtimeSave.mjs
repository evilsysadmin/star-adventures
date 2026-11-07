// Safe bridge from authoritative v1 tile-command saves to the *future*
// continuous exploration runtime. Kept separate so the current game and its
// recovery flow remain untouched until the actual gameplay migration is QA'd.
import {
  replayGroundSquadPositions,
  serializeGroundSquadPositions,
} from './groundSquadPositions.mjs';
import {
  startRealtimeExploration,
  serializeRealtimeExploration,
  deserializeRealtimeExploration,
} from './groundRealtimeExploration.mjs';

export const GROUND_REALTIME_SAVE_KEY = 'shadowops.star-adventures.ground-realtime.v1';
const MAX_SAVE_LENGTH = 200_000;
const validRoster = (motion,ids) =>
  motion.officers.length === ids.length &&
  motion.officers.every((officer,index)=>officer.id===ids[index]);

function validExplored(scene,explored){
  if(!Array.isArray(explored)||explored.length>scene.width*scene.height)
    throw new TypeError('Invalid continuous terrain memory');
  const unique=new Set();
  for(const id of explored){
    if(typeof id!=='string'||! /^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(id)||
       unique.has(id))throw new TypeError('Invalid continuous terrain cell');
    const [x,y]=id.split(',').map(Number);
    if(x>=scene.width||y>=scene.height)
      throw new TypeError('Continuous terrain cell outside map');
    unique.add(id);
  }
  return [...unique].sort();
}

function legacyAnchor(world,away,legacy) {
  // Never accept an arbitrary origin or stale commands as a valid anchor:
  // this calls the canonical v1 replay validation before deriving new state.
  const fingerprint=serializeGroundSquadPositions(world,away,legacy);
  const replay=replayGroundSquadPositions(world,away,legacy);
  const officers=replay.officers.map(({id,x,y})=>({id,x,y}));
  return {fingerprint,officers};
}

export function initialRealtimeFromLegacy(world,away,legacy) {
  const {officers}=legacyAnchor(world,away,legacy);
  return startRealtimeExploration(world.scenes.surface,officers);
}

export function serializeGroundRealtimeSave(world,away,legacy,motion,explored=null) {
  const {fingerprint,officers}=legacyAnchor(world,away,legacy);
  // Re-parse through the continuous engine to reject forged waypoints, bad
  // coordinates, malformed IDs and invalid routes before writing any bytes.
  const checked=deserializeRealtimeExploration(world.scenes.surface,
    serializeRealtimeExploration(world.scenes.surface,motion));
  if(!validRoster(checked,officers.map(o=>o.id)))
    throw new TypeError('Realtime roster does not match saved away team');
  // The v1 command history remains a rollback anchor. It is NOT overwritten
  // by an incomplete walk or a destination that has not been reached.
  // Old v1 sidecars stay readable; new saves additionally persist real
  // terrain memory without rewriting the original mission command journal.
  const memory=explored===null?null:validExplored(world.scenes.surface,explored);
  const data=JSON.stringify(memory===null
    ? {version:1,legacy:fingerprint,motion:checked}
    : {version:2,legacy:fingerprint,motion:checked,explored:memory});
  if(data.length>MAX_SAVE_LENGTH)throw new RangeError('Realtime save is too large');
  return data;
}

export function restoreGroundRealtimeSave(world,away,legacy,raw) {
  const {fingerprint,officers}=legacyAnchor(world,away,legacy);
  const fresh=()=>startRealtimeExploration(world.scenes.surface,officers);
  if(typeof raw!=='string'||!raw.length)
    return {state:fresh(),source:'legacy'};
  try {
    if(raw.length>MAX_SAVE_LENGTH)throw new TypeError('Oversized save');
    const data=JSON.parse(raw);
    const v1=data?.version===1&&
      Object.keys(data).sort().join('|')==='legacy|motion|version';
    const v2=data?.version===2&&
      Object.keys(data).sort().join('|')==='explored|legacy|motion|version';
    if(!data||Array.isArray(data)||(!v1&&!v2)||data.legacy!==fingerprint)
      throw new TypeError('Stale or incompatible realtime save');
    const checked=deserializeRealtimeExploration(world.scenes.surface,
      JSON.stringify(data.motion));
    if(!validRoster(checked,officers.map(o=>o.id)))
      throw new TypeError('Realtime officer roster changed');
    const explored=v2?validExplored(world.scenes.surface,data.explored):null;
    return {state:checked,source:'realtime',explored};
  } catch {
    // A corrupt/stale sidecar must never replace the validated v1 snapshot.
    return {state:fresh(),source:'recovered-legacy'};
  }
}
