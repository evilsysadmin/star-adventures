// Continuous *exploration* locomotion contract. Pure, deterministic and
// intentionally separate from both the existing v1 grid snapshot and combat.
// The first PR proves the model; a later PR must wire it to actual gameplay.
export const REALTIME_WALK_TILES_PER_SECOND = 2.5;
const CLEARANCE = 0.16;
const MAX_WAYPOINTS = 256;
const DIRECTIONS = [[0,-1],[1,0],[0,1],[-1,0]];
const key = (x,y) => x + ',' + y;
const cell = point => ({x:Math.round(point.x),y:Math.round(point.y)});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const finite = n => Number.isFinite(n) && n >= 0;
const clone = state => ({
  version:1,
  officers:state.officers.map(o=>({
    id:o.id,x:o.x,y:o.y,route:o.route.map(p=>({...p})),
  })),
});

function topology(scene){
  if(!Number.isSafeInteger(scene?.width)||!Number.isSafeInteger(scene?.height)||
     scene.width<1||scene.height<1||scene.width>256||scene.height>256||
     !Array.isArray(scene.walls)||!Array.isArray(scene.objects))
    throw new TypeError('Invalid exploration scene');
  const blocked=new Set();
  for(const obstacle of [...scene.walls,...scene.objects]){
    if(!Number.isSafeInteger(obstacle?.x)||!Number.isSafeInteger(obstacle?.y)||
       obstacle.x<0||obstacle.y<0||obstacle.x>=scene.width||obstacle.y>=scene.height)
      throw new TypeError('Invalid exploration obstacle');
    blocked.add(key(obstacle.x,obstacle.y));
  }
  return blocked;
}

function free(scene,blocked,point){
  if(!point||!finite(point.x)||!finite(point.y)||
     point.x>scene.width-1||point.y>scene.height-1)return false;
  const center=cell(point);
  if(blocked.has(key(center.x,center.y)))return false;
  // A circle of radius CLEARANCE may not intersect solid cell footprints.
  for(let y=Math.max(0,Math.floor(point.y-1));y<=Math.min(scene.height-1,Math.ceil(point.y+1));y++)
    for(let x=Math.max(0,Math.floor(point.x-1));x<=Math.min(scene.width-1,Math.ceil(point.x+1));x++){
      if(!blocked.has(key(x,y)))continue;
      const nearestX=Math.max(x-.5,Math.min(point.x,x+.5));
      const nearestY=Math.max(y-.5,Math.min(point.y,y+.5));
      if(Math.hypot(point.x-nearestX,point.y-nearestY)<CLEARANCE)return false;
    }
  return true;
}

// Endpoints alone do not prove a swept circle clears a solid corner.
// Only nearby blocked cells need checking. Endpoint clearance is already
// established by free(); for the segment interior, test rectangle contact
// and the four corner projections (the remaining closest-feature cases).
function segmentClear(scene,blocked,from,to){
  const dx=to.x-from.x,dy=to.y-from.y,length2=dx*dx+dy*dy;
  if(length2===0)return true;
  for(let y=Math.max(0,Math.floor(Math.min(from.y,to.y)-1));
      y<=Math.min(scene.height-1,Math.ceil(Math.max(from.y,to.y)+1));y++)
    for(let x=Math.max(0,Math.floor(Math.min(from.x,to.x)-1));
        x<=Math.min(scene.width-1,Math.ceil(Math.max(from.x,to.x)+1));x++){
      if(!blocked.has(key(x,y)))continue;
      const left=x-.5,right=x+.5,top=y-.5,bottom=y+.5;
      // Slab intersection, including tangencies with the solid footprint.
      let enter=0,exit=1,intersects=true;
      for(const [origin,delta,min,max] of [[from.x,dx,left,right],[from.y,dy,top,bottom]]){
        if(delta===0){if(origin<min||origin>max)intersects=false;continue;}
        const a=(min-origin)/delta,b=(max-origin)/delta;
        enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
      }
      if(intersects&&enter<=exit)return false;
      for(const cx of [left,right])for(const cy of [top,bottom]){
        const t=Math.max(0,Math.min(1,((cx-from.x)*dx+(cy-from.y)*dy)/length2));
        if(Math.hypot(from.x+t*dx-cx,from.y+t*dy-cy)<CLEARANCE)return false;
      }
    }
  return true;
}

function checkState(scene,state,blocked=topology(scene)){
  if(!state||state.version!==1||!Array.isArray(state.officers)||
     state.officers.length<1||state.officers.length>16)
    throw new TypeError('Invalid exploration motion state');
  const ids=new Set();
  for(const officer of state.officers){
    if(typeof officer?.id!=='string'||!officer.id||officer.id.length>64||ids.has(officer.id)||
       !free(scene,blocked,officer)||!Array.isArray(officer.route)||
       officer.route.length>MAX_WAYPOINTS)
      throw new TypeError('Invalid exploration officer');
    ids.add(officer.id);
    let from=officer;
    for(const target of officer.route){
      if(!free(scene,blocked,target))throw new TypeError('Unsafe exploration waypoint');
      const prevCell=cell(from),nextCell=cell(target);
      if(Math.abs(prevCell.x-nextCell.x)+Math.abs(prevCell.y-nextCell.y)>1)
        throw new TypeError('Disconnected exploration route');
      if(!segmentClear(scene,blocked,from,target))throw new TypeError('Unsafe exploration segment');
      from=target;
    }
  }
  return blocked;
}

export function startRealtimeExploration(scene,officers){
  const blocked=topology(scene);
  if(!Array.isArray(officers))throw new TypeError('Invalid officer roster');
  const state={version:1,officers:officers.map(({id,x,y})=>({id,x,y,route:[]}))};
  checkState(scene,state,blocked);
  for(let i=0;i<state.officers.length;i++)
    for(let j=i+1;j<state.officers.length;j++)
      if(distance(state.officers[i],state.officers[j])<CLEARANCE*2)
        throw new RangeError('Overlapping deployment');
  return state;
}

// Cancel an entire selection in one immutable transaction. Validate every ID
// before cloning; a stationary member is a valid no-op within a selection.
export function stopRealtimeExploration(scene,state,ids){
  checkState(scene,state);
  if(!Array.isArray(ids)||ids.length<1||ids.length>state.officers.length||
     new Set(ids).size!==ids.length||
     ids.some(id=>typeof id!=='string'||!state.officers.some(o=>o.id===id)))
    throw new TypeError('Invalid exploration stop selection');
  const next=clone(state),selected=new Set(ids);
  for(const officer of next.officers)
    if(selected.has(officer.id))officer.route=[];
  return next;
}

// BFS uses grid topology internally; actual endpoints and saved positions
// remain fractional. Waypoints are crossed at constant speed, never treated as
// independent tile turns. Other officers' occupied cells are not traversed.
export function orderRealtimeExplorationMove(scene,state,id,destination){
  const blocked=checkState(scene,state);
  if(typeof id!=='string'||!free(scene,blocked,destination))
    throw new RangeError('Destination blocked or outside map');
  const selected=state.officers.find(o=>o.id===id);
  if(!selected)throw new RangeError('Unknown exploration officer');
  const result=clone(state),actor=result.officers.find(o=>o.id===id);
  // Stopping does not claim a new destination. A colleague's conservative
  // reservation can include our current cell even when bodies are separate.
  // Cancel only our own route without moving either officer.
  if(distance(actor,destination)<1e-7){actor.route=[];return result;}
  const start=cell(actor),end=cell(destination);
  const occupied=new Set(blocked);
  // A moving colleague owns both endpoints of their current fractional
  // step AND every future waypoint. Occupying only their rounded current
  // cell let independently ordered officers collide on intersecting routes.
  // Reserve the entire planned corridor conservatively; no swaps/head-on
  // passes until the dedicated dynamic avoidance system exists.
  // Fractional future endpoints need the same conservative reservation
  // as current positions: opposite sides of a rounding boundary can be
  // different grid cells but less than one body diameter apart.
  const reservePoint=point=>{
    for(const x of [Math.floor(point.x),Math.ceil(point.x)])
      for(const y of [Math.floor(point.y),Math.ceil(point.y)])
        occupied.add(key(x,y));
  };
  for(const other of result.officers){
    if(other.id===id)continue;
    reservePoint(other);
    for(const point of other.route)reservePoint(point);
  }
  if(occupied.has(key(end.x,end.y)))
    throw new RangeError('Destination occupied');
  if(start.x===end.x&&start.y===end.y){
    // A diagonal within one free grid cell can still clip the rounded
    // clearance envelope of a neighboring solid corner. Prefer the direct
    // segment when safe; otherwise take the already walkable cell center.
    const goal={x:destination.x,y:destination.y};
    if(segmentClear(scene,blocked,actor,goal))actor.route=[goal];
    else {
      if(!segmentClear(scene,blocked,actor,start)||!segmentClear(scene,blocked,start,goal))
        throw new RangeError('Unsafe exploration segment');
      actor.route=[start,goal];
    }
    return result;
  }
  const queue=[start],back=new Map([[key(start.x,start.y),null]]);
  for(let i=0;i<queue.length&&!back.has(key(end.x,end.y));i++){
    const from=queue[i];
    for(const [dx,dy] of DIRECTIONS){
      const x=from.x+dx,y=from.y+dy,k=key(x,y);
      if(x<0||y<0||x>=scene.width||y>=scene.height||
         occupied.has(k)||back.has(k))continue;
      back.set(k,key(from.x,from.y));queue.push({x,y});
    }
  }
  const last=key(end.x,end.y),first=key(start.x,start.y);
  if(!back.has(last))throw new RangeError('Unreachable exploration destination');
  const centers=[];
  for(let k=last;k!==first;k=back.get(k)){
    const [x,y]=k.split(',').map(Number);
    centers.push({x,y});
  }
  centers.reverse();
  const path=[
    ...(distance(actor,start)>1e-7?[start]:[]),
    ...centers,
    {x:destination.x,y:destination.y},
  ].filter((p,i,a)=>i===0||distance(p,a[i-1])>1e-7);
  if(path.length>MAX_WAYPOINTS)throw new RangeError('Exploration route too long');
  actor.route=path;
  return result;
}


// Queue a single officer's next destination after their existing route.
// Use the same planner and conservative colleague reservations from the
// last planned position, but never publish that virtual position as a pose.
// The complete concatenated route is bounded and validated before returning.
export function appendRealtimeExplorationMove(scene,state,id,destination){
  const blocked=checkState(scene,state);
  const actor=state.officers.find(o=>o.id===id);
  if(!actor)throw new RangeError('Unknown exploration officer');
  if(!actor.route.length)return orderRealtimeExplorationMove(scene,state,id,destination);
  const virtual=clone(state),tail=virtual.officers.find(o=>o.id===id);
  const endpoint=tail.route.at(-1);
  tail.x=endpoint.x;tail.y=endpoint.y;tail.route=[];
  const planned=orderRealtimeExplorationMove(scene,virtual,id,destination);
  const suffix=planned.officers.find(o=>o.id===id).route;
  const next=clone(state),combined=next.officers.find(o=>o.id===id);
  if(combined.route.length+suffix.length>MAX_WAYPOINTS)
    throw new RangeError('Exploration route too long');
  combined.route.push(...suffix);
  checkState(scene,next,blocked);
  return next;
}

// Atomic 2–3 officer formation order for the opt-in continuous surface.
// Every member starts moving on the same next simulation tick. All proposed
// routes are reserved against colleagues' physical positions and routes;
// if even one member cannot reach a distinct nearby cell, nothing commits.
// This intentionally prefers safety over swapping or threading tight doors.
export function orderRealtimeExplorationFormation(scene,state,ids,destination){
  checkState(scene,state);
  if(!Array.isArray(ids)||ids.length<2||ids.length>3||
     new Set(ids).size!==ids.length||
     ids.some(id=>typeof id!=='string'||!state.officers.some(o=>o.id===id)))
    throw new TypeError('Invalid exploration formation');
  if(!destination||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))
    throw new TypeError('Invalid formation destination');
  // Validate the raw point before rounding; an outside coordinate must
  // not become a legal boundary cell merely through quantization.
  if(destination.x<0||destination.y<0||
     destination.x>scene.width-1||destination.y>scene.height-1)
    throw new RangeError('Formation destination outside map');
  const anchor={x:Math.round(destination.x),y:Math.round(destination.y)};
  const blocked=topology(scene);
  if(!free(scene,blocked,anchor))
    throw new RangeError('Formation destination blocked');
  const start=clone(state);
  // Retargeting a moving team cancels their *old routes* but never changes
  // their actual fractional positions. Unselected active routes stay reserved.
  for(const officer of start.officers)
    if(ids.includes(officer.id))officer.route=[];
  const reserved=new Set([key(anchor.x,anchor.y)]);
  const headings=[[0,-1],[1,0],[0,1],[-1,0]];
  const leader=start.officers.find(o=>o.id===ids[0]);
  const dx=anchor.x-leader.x,dy=anchor.y-leader.y;
  // Favor two rear-side slots relative to the intended travel axis. Each
  // follower prefers the nearer wing instead of crossing its teammate.
  // These are destination preferences, NOT unvalidated motion waypoints.
  const direction=Math.hypot(dx,dy)>1e-7
    ? Math.abs(dx)>=Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)]
    : null;
  const candidates=(index,directional)=>{
    const [ox,oy]=headings[(index-1)%headings.length];
    const legacy={x:anchor.x+ox,y:anchor.y+oy};
    const ideals=directional&&direction
      ? [-1,1].map(side=>({x:anchor.x-direction[0]-side*direction[1],
          y:anchor.y-direction[1]+side*direction[0]}))
      : [legacy];
    const follower=start.officers.find(o=>o.id===ids[index]);
    const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const choices=[];
    for(let y=Math.max(0,anchor.y-3);y<=Math.min(scene.height-1,anchor.y+3);y++)
      for(let x=Math.max(0,anchor.x-3);x<=Math.min(scene.width-1,anchor.x+3);x++){
        const point={x,y},radius=Math.abs(x-anchor.x)+Math.abs(y-anchor.y);
        if(radius>3||!radius||!free(scene,blocked,point))continue;
        choices.push({point,rank:
          Math.min(...ideals.map(ideal=>manhattan(point,ideal)))*10+radius,
          travel:directional&&direction?manhattan(point,follower):0});
      }
    choices.sort((a,b)=>a.rank-b.rank||a.travel-b.travel||
      a.point.y-b.point.y||a.point.x-b.point.x);
    return choices.slice(0,20).map(c=>c.point);
  };
  // Each full candidate is planned through the real BFS/clearance validator.
  // No partial state is ever exposed to caller on a failed candidate.
  function plan(index,working,directional){
    if(index===ids.length)return working;
    const options=index===0?[anchor]:candidates(index,directional);
    for(const target of options){
      const k=key(target.x,target.y);
      if(index!==0&&reserved.has(k))continue;
      let next;
      try{next=orderRealtimeExplorationMove(scene,working,ids[index],target);}
      catch{continue;}
      reserved.add(k);
      const finished=plan(index+1,next,directional);
      if(finished)return finished;
      if(index!==0)reserved.delete(k);
    }
    return null;
  }
  // Preserve the existing admissibility fallback when a directional
  // preference cannot produce a complete collision-free route set.
  const planned=(direction?plan(0,start,true):null)??plan(0,start,false);
  if(!planned)throw new RangeError('No collision-free continuous formation');
  return planned;
}

// Queue a formation from its planned endpoints without teleporting or
// cancelling the unfinished prefixes. Members may reach their old endpoints
// at different times, so conservatively reject suffixes that intersect ANY
// other member's old route corridor. No synchronized arrival assumption.
export function appendRealtimeExplorationFormation(scene,state,ids,destination){
  const blocked=checkState(scene,state);
  if(!Array.isArray(ids)||ids.length<2||ids.length>3||
     new Set(ids).size!==ids.length||
     ids.some(id=>typeof id!=='string'||!state.officers.some(o=>o.id===id)))
    throw new TypeError('Invalid exploration formation');
  const selected=new Set(ids);
  if(!state.officers.some(o=>selected.has(o.id)&&o.route.length))
    return orderRealtimeExplorationFormation(scene,state,ids,destination);
  const virtual=clone(state);
  for(const o of virtual.officers){
    if(!selected.has(o.id)||!o.route.length)continue;
    const end=o.route.at(-1);
    o.x=end.x;o.y=end.y;o.route=[];
  }
  const planned=orderRealtimeExplorationFormation(scene,virtual,ids,destination);
  const next=clone(state);
  // A rectangular floor/ceil envelope is deliberately more conservative
  // than rounding cells, including fractional waypoints and segment corners.
  const corridor=(start,route)=>{
    const cells=new Set();
    let from=start;
    for(const to of [start,...route]){
      for(let y=Math.floor(Math.min(from.y,to.y));y<=Math.ceil(Math.max(from.y,to.y));y++)
        for(let x=Math.floor(Math.min(from.x,to.x));x<=Math.ceil(Math.max(from.x,to.x));x++)
          cells.add(key(x,y));
      from=to;
    }
    return cells;
  };
  const prefixes=new Map(state.officers.map(o=>[o.id,corridor(o,o.route)]));
  const suffixes=new Map();
  for(const o of planned.officers){
    if(!selected.has(o.id))continue;
    const start=virtual.officers.find(v=>v.id===o.id);
    suffixes.set(o.id,corridor(start,o.route));
  }
  // Check both directions and new suffixes against each other, including
  // their start/end positions. A failed candidate commits no partial queue.
  for(const [id,cells] of suffixes)
    for(const k of cells){
      if([...prefixes].some(([other,old])=>other!==id&&old.has(k))||
         [...suffixes].some(([other,tail])=>other!==id&&tail.has(k)))
        throw new RangeError('Queued formation crosses a reserved corridor');
    }
  for(const o of next.officers){
    if(!selected.has(o.id))continue;
    const suffix=planned.officers.find(p=>p.id===o.id).route;
    if(o.route.length+suffix.length>MAX_WAYPOINTS)
      throw new RangeError('Exploration route too long');
    o.route.push(...suffix);
  }
  checkState(scene,next,blocked);
  return next;
}

// deltaMs is supplied by the caller: no timers, rendering, wall clock or
// browser state in the engine. All units with routes advance concurrently.
export function advanceRealtimeExploration(scene,state,deltaMs,{paused=false}={}){
  checkState(scene,state);
  if(!finite(deltaMs)||deltaMs>120_000)
    throw new RangeError('Invalid exploration elapsed time');
  const next=clone(state);
  if(paused||deltaMs===0)return next;
  for(const officer of next.officers){
    let remaining=REALTIME_WALK_TILES_PER_SECOND*deltaMs/1000;
    while(remaining>1e-10&&officer.route.length){
      const target=officer.route[0],length=distance(officer,target);
      if(length<=remaining+1e-10){
        officer.x=target.x;officer.y=target.y;
        officer.route.shift();remaining-=length;
      }else{
        const fraction=remaining/length;
        officer.x+=(target.x-officer.x)*fraction;
        officer.y+=(target.y-officer.y)*fraction;
        remaining=0;
      }
    }
  }
  return next;
}

// This is an isolated v1 *motion prototype*, NOT the existing campaign v1
// save. Browser integration must introduce a deliberate migration/rollback.
export function serializeRealtimeExploration(scene,state){
  checkState(scene,state);
  return JSON.stringify(state);
}
export function deserializeRealtimeExploration(scene,raw){
  if(typeof raw!=='string'||raw.length>100_000)
    throw new TypeError('Invalid realtime exploration save');
  const state=JSON.parse(raw);
  checkState(scene,state);
  return clone(state);
}
