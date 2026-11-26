import {useCallback, useEffect, useRef, useState} from 'react';
import world from '../../../content/scenes/meridian.json';
import {startAwayTeam} from '../../../src/awayTeam.mjs';
import {
  startGroundRealtimeWorld,restoreGroundRealtimeWorld,serializeGroundRealtimeWorld,
  orderGroundRealtimeWorld,appendGroundRealtimeWorld,orderGroundRealtimeFormation,appendGroundRealtimeFormation,stopGroundRealtimeWorld,
  advanceGroundRealtimeWorld,groundRealtimeVision,
  groundRealtimeStationUse,
} from '../../../src/groundRealtimeWorld.mjs';
import {GROUND_REALTIME_SAVE_KEY} from '../../../src/groundRealtimeSave.mjs';
import {localStorageOrNull} from '../session';
import {createRealtimeFrameClock} from '../realtimeFrameClock';
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

// Opt-in continuous movement: solo or 2–3 officer formation orders preserve
// physical positions and reserve paths. Classic v1 remains the rollback.
export function useGroundRealtime({
  legacy,ids,surface,showSquad,paused,
}:{
  legacy:GroundSnapshot|null;ids:string[];surface:boolean;
  showSquad:boolean;paused:boolean;
}){
  const rosterKey=ids.join('|');
  const [state,setState]=useState<RealtimeSurface|null>(null);
  const stateRef=useRef<RealtimeSurface|null>(null);
  const moving=state?.motion.officers.some(o=>o.route.length>0)??false;
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

  const order=useCallback((point:Point,selection:string[],append=false)=>{
    if(paused||!surface||!showSquad||selection.length<1||selection.length>3||!legacy||!stateRef.current)
      return false;
    try{
      const next=(selection.length===1
        ? (append?appendGroundRealtimeWorld:orderGroundRealtimeWorld)(world,stateRef.current,selection[0],point)
        : (append?appendGroundRealtimeFormation:orderGroundRealtimeFormation)(world,stateRef.current,selection,point)) as RealtimeSurface;
      replace(next);
      save(next);
      return true;
    }catch{return false;}
  },[paused,surface,showSquad,legacy,replace,save]);

  // Apply the entire selection to one authoritative snapshot, then save
  // once. No intermediate partial cancellation or rendered pose input.
  const stop=useCallback((selection:string[])=>{
    const current=stateRef.current;
    if(paused||!surface||!showSquad||!legacy||!current||
       !current.motion.officers.some(o=>selection.includes(o.id)&&o.route.length))
      return false;
    try{
      const next=stopGroundRealtimeWorld(world,current,selection) as RealtimeSurface;
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
    if(!moving||!surface||!showSquad||paused)return;
    let raf=0,lastSaved=0;
    const clock=createRealtimeFrameClock();
    const tick=(now:number)=>{
      const current=stateRef.current;
      if(!current||!current.motion.officers.some(o=>o.route.length))return;
      if(document.visibilityState==='hidden'){clock.reset();return;}
      const elapsed=clock.step(now);
      if(elapsed===null){raf=requestAnimationFrame(tick);return;}
      const next=advanceGroundRealtimeWorld(world,current,elapsed) as RealtimeSurface;
      replace(next);
      const finished=next.motion.officers.every(o=>!o.route.length);
      if(now-lastSaved>240||finished){
        save(next);lastSaved=now;
      }
      if(!finished)raf=requestAnimationFrame(tick);
    };
    const resume=()=>{
      // Hidden tabs may receive no RAF callbacks at all. Reset on the
      // actual visibility event, never advance using background time.
      cancelAnimationFrame(raf);
      clock.reset();
      if(document.visibilityState!=='hidden')raf=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',resume);
    resume();
    return ()=>{
      document.removeEventListener('visibilitychange',resume);
      cancelAnimationFrame(raf);
      save(stateRef.current);
    };
  },[moving,surface,showSquad,paused,replace,save]);

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
    enable,disable,order,stop,station,
  };
}
