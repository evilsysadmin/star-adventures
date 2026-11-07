// Authoritative world-facing view of the future continuous surface runtime.
// No browser clock, React, storage, networking or franchise-specific data.
// This module intentionally does not replace the current v1 campaign flow yet.
import {groundFogOfWar,groundVisionCells} from './groundFogOfWar.mjs';
import {applyExploration} from './spatial.mjs';
import {
  advanceRealtimeExploration,orderRealtimeExplorationMove,
  serializeRealtimeExploration,
} from './groundRealtimeExploration.mjs';
import {
  initialRealtimeFromLegacy,restoreGroundRealtimeSave,
  serializeGroundRealtimeSave,
} from './groundRealtimeSave.mjs';

const MAX_FRAME_MS=1000;
const VISION_STEP_MS=80;
const key=(x,y)=>x+','+y;
const DIRECTIONS=[
  {dx:0,dy:-1,heading:'N'},{dx:1,dy:0,heading:'E'},
  {dx:0,dy:1,heading:'S'},{dx:-1,dy:0,heading:'W'},
];

function verify(world,state){
  const scene=world?.scenes?.surface;
  if(!scene||state?.version!==1||!Array.isArray(state.explored))
    throw new TypeError('Invalid realtime world snapshot');
  // Use the canonical motion validation rather than trusting a render pose.
  serializeRealtimeExploration(scene,state.motion);
  if(state.explored.length>scene.width*scene.height)
    throw new TypeError('Unbounded realtime terrain memory');
  const tiles=new Set();
  for(const id of state.explored){
    if(typeof id!=='string'||! /^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(id)||
       tiles.has(id))throw new TypeError('Invalid realtime terrain memory');
    const [x,y]=id.split(',').map(Number);
    if(x<0||y<0||x>=scene.width||y>=scene.height)
      throw new TypeError('Realtime remembered cell outside surface');
    tiles.add(id);
  }
  return {scene,tiles};
}

function eyesFromMotion(motion){
  // The physical footprint determines visibility, never a route endpoint.
  return motion.officers.map(unit=>({x:Math.round(unit.x),y:Math.round(unit.y)}));
}

export function startGroundRealtimeWorld(world,away,legacy){
  const motion=initialRealtimeFromLegacy(world,away,legacy);
  const explored=[...groundFogOfWar(world,away,legacy).explored].sort();
  const result={version:1,motion,explored};
  verify(world,result);
  return result;
}

export function restoreGroundRealtimeWorld(world,away,legacy,raw){
  const restored=restoreGroundRealtimeSave(world,away,legacy,raw);
  const baseline=groundFogOfWar(world,away,legacy).explored;
  const explored=new Set([...baseline,...(restored.explored??[])]);
  const result={version:1,motion:restored.state,explored:[...explored].sort()};
  verify(world,result);
  return {state:result,source:restored.source};
}

export function serializeGroundRealtimeWorld(world,away,legacy,state){
  verify(world,state);
  return serializeGroundRealtimeSave(world,away,legacy,state.motion,state.explored);
}

export function orderGroundRealtimeWorld(world,state,id,destination){
  const {scene}=verify(world,state);
  const motion=orderRealtimeExplorationMove(scene,state.motion,id,destination);
  return {...state,motion,explored:[...state.explored]};
}

export function groundRealtimeVision(world,state){
  const {scene,tiles}=verify(world,state);
  return {visible:groundVisionCells(scene,eyesFromMotion(state.motion)),explored:tiles};
}

// The caller supplies elapsed time. Short steps record every sightline
// traversed, including in a large frame, without revealing the destination
// early. Tab suspension must be handled by the caller (pause instead of catchup).
export function advanceGroundRealtimeWorld(world,state,deltaMs,{paused=false}={}){
  const {scene,tiles}=verify(world,state);
  if(!Number.isFinite(deltaMs)||deltaMs<0||deltaMs>MAX_FRAME_MS)
    throw new RangeError('Invalid realtime frame interval');
  if(paused||deltaMs===0)return {
    version:1,motion:state.motion,explored:[...state.explored],
  };
  let motion=state.motion;
  let remaining=deltaMs;
  while(remaining>0){
    const step=Math.min(remaining,VISION_STEP_MS);
    motion=advanceRealtimeExploration(scene,motion,step);
    for(const id of groundVisionCells(scene,eyesFromMotion(motion)))tiles.add(id);
    remaining-=step;
  }
  return {version:1,motion,explored:[...tiles].sort()};
}

// Interactions are authorized from the *actual* body position only. The
// nearest old grid-command destination is never consulted. Require the
// officer to have stopped close to a real adjacent station cell, then reuse
// the canonical station command to preserve mission effects.
export function groundRealtimeStationUse(world,state,officerId,stationId){
  const {scene}=verify(world,state);
  if(typeof officerId!=='string'||typeof stationId!=='string')
    throw new TypeError('Invalid ground station request');
  const officer=state.motion.officers.find(unit=>unit.id===officerId);
  const station=scene.objects.find(item=>
    item.id===stationId&&item.type==='station');
  if(!officer||!station)throw new RangeError('Unknown officer or station');
  if(officer.route.length)
    throw new RangeError('Officer must stop before interacting');
  const x=Math.round(officer.x),y=Math.round(officer.y);
  if(Math.hypot(officer.x-x,officer.y-y)>0.2)
    throw new RangeError('Officer has not reached station position');
  const step=DIRECTIONS.find(d=>
    x+d.dx===station.x&&y+d.dy===station.y);
  if(!step)throw new RangeError('Officer not adjacent to station');
  const pose={version:1,area:'surface',x,y,heading:step.heading,pending:null};
  const result=applyExploration(world,pose,{type:'use'});
  if(result.event.type!=='station'||result.event.stationId!==stationId)
    throw new RangeError('Station action not accepted');
  return {pose,event:result.event};
}
