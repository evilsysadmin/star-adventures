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
  const start=cell(actor),end=cell(destination);
  const occupied=new Set(blocked);
  for(const other of result.officers)
    if(other.id!==id)occupied.add(key(cell(other).x,cell(other).y));
  if(occupied.has(key(end.x,end.y)))
    throw new RangeError('Destination occupied');
  if(distance(actor,destination)<1e-7){actor.route=[];return result;}
  if(start.x===end.x&&start.y===end.y){
    actor.route=[{x:destination.x,y:destination.y}];
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
