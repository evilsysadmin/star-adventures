import {useCallback, useEffect, useRef, useState} from 'react';
import world from '../../../content/scenes/meridian.json';
import {startAwayTeam} from '../../../src/awayTeam.mjs';
import {
  startGroundRealtimeWorld,restoreGroundRealtimeWorld,serializeGroundRealtimeWorld,
  orderGroundRealtimeWorld,advanceGroundRealtimeWorld,groundRealtimeVision,
  groundRealtimeStationUse,
} from '../../../src/groundRealtimeWorld.mjs';
import {GROUND_REALTIME_SAVE_KEY} from '../../../src/groundRealtimeSave.mjs';
import {localStorageOrNull} from '../session';
import type {GroundSnapshot} from '../groundSquadSession';

type Point={x:number;y:number};
type MotionOfficer={id:string;x:number;y:number;route:Point[]};
export type RealtimeSurface={
  version:number;
  motion:{version:number;officers:MotionOfficer[]};
  explored:string[];
};

const storage=()=>localStorageOrNull();
const deployed=(ids:string[])=>({...startAwayTeam(),squad:ids});

// First experimental gameplay slice: one officer can be ordered/retargeted
// during real time. The classic v1 squad remains available as rollback.
// Multiplayer/group collision avoidance is NOT enabled by this opt-in.
export function useGroundRealtime({
  legacy,ids,surface,showSquad,paused,
}:{
  legacy:GroundSnapshot|null;ids:string[];surface:boolean;
  showSquad:boolean;paused:boolean;
}){
  const rosterKey=ids.join('|');
  const [state,setState]=useState<RealtimeSurface|null>(null);
  const stateRef=useRef<RealtimeSurface|null>(null);
  const active=state!==null;
  const replace=useCallback((next:RealtimeSurface|null)=>{
    stateRef.current=next;
    setState(next);
  },[]);

  const save=useCallback((next:RealtimeSurface|null)=>{
    if(!legacy||!next)return false;
    try{
      const raw=serializeGroundRealtimeWorld(world,deployed(rosterKey.split('|')),legacy,next);
      const store=storage();
      if(!store)return false;
      store.setItem(GROUND_REALTIME_SAVE_KEY,raw);
      return true;
    }catch{return false;}
  },[legacy,rosterKey]);

  useEffect(()=>{
    if(!surface||!legacy){
      replace(null);
      if(!surface){try{storage()?.removeItem(GROUND_REALTIME_SAVE_KEY);}catch{/* blocked storage */}}
      return;
    }
    try{
      const raw=storage()?.getItem(GROUND_REALTIME_SAVE_KEY);
      if(raw){
        const restored=restoreGroundRealtimeWorld(world,deployed(rosterKey.split('|')),legacy,raw);
        if(restored.source==='realtime'){
          replace(restored.state as RealtimeSurface);
          return;
        }
        // Stale/foreign/corrupt sidecars never resurrect another mission.
        storage()?.removeItem(GROUND_REALTIME_SAVE_KEY);
      }
    }catch{/* storage may be disabled */}
    replace(null);
  },[legacy,rosterKey,surface,replace]);

  const enable=useCallback(()=>{
    if(!legacy||!surface||paused)return false;
    try{
      const initial=startGroundRealtimeWorld(world,deployed(rosterKey.split('|')),legacy);
      replace(initial as RealtimeSurface);
      save(initial as RealtimeSurface);
      return true;
    }catch{return false;}
  },[legacy,surface,paused,rosterKey,replace,save]);

  const disable=useCallback(()=>{
    replace(null);
    try{storage()?.removeItem(GROUND_REALTIME_SAVE_KEY);}catch{/* blocked storage */}
  },[replace]);

  const order=useCallback((point:Point,selection:string[])=>{
    // Do not pretend full-squad orders are safe while dynamic collisions
    // and formations are not implemented in the continuous engine.
    if(paused||!surface||!showSquad||selection.length!==1||!legacy||!stateRef.current)
      return false;
    try{
      const next=orderGroundRealtimeWorld(world,stateRef.current,selection[0],point) as RealtimeSurface;
      replace(next);
      save(next);
      return true;
    }catch{return false;}
  },[paused,surface,showSquad,legacy,replace,save]);

  const station=useCallback((id:string,stationId:string)=>{
    if(paused||!surface||!stateRef.current)
      throw new RangeError('Exploration unavailable');
    return groundRealtimeStationUse(world,stateRef.current,id,stationId);
  },[paused,surface]);

  useEffect(()=>{
    if(!active||!surface||!showSquad||paused)return;
    let raf=0,last=0,lastSaved=0;
    const tick=(now:number)=>{
      raf=requestAnimationFrame(tick);
      if(document.visibilityState==='hidden'){last=0;return;}
      if(last===0){last=now;return;}
      const elapsed=now-last;
      if(elapsed<40)return; // ~25 authoritative frames per second
      last=now;
      const current=stateRef.current;
      if(!current||!current.motion.officers.some(o=>o.route.length))return;
      const next=advanceGroundRealtimeWorld(world,current,Math.min(elapsed,80)) as RealtimeSurface;
      replace(next);
      if(now-lastSaved>240||next.motion.officers.every(o=>!o.route.length)){
        save(next);lastSaved=now;
      }
    };
    raf=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(raf);save(stateRef.current);};
  },[active,surface,showSquad,paused,replace,save]);

  useEffect(()=>{
    const flush=()=>save(stateRef.current);
    const hidden=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',hidden);
    return ()=>{
      window.removeEventListener('pagehide',flush);
      document.removeEventListener('visibilitychange',hidden);
    };
  },[save]);

  return {
    state,
    vision:state?groundRealtimeVision(world,state):null,
    enable,disable,order,station,
  };
}
