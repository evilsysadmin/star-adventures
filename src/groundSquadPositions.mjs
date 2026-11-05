// Independent away-officer positions for future isometric exploration.
// Pure deterministic rules: never read browser storage or silently mutate campaign state.
import { validateWorld, validateExploration } from './spatial.mjs';
import { validateAwayTeam } from './awayTeam.mjs';

const OFFSETS = [[0,-1],[1,0],[0,1],[-1,0]];
const HEADINGS = ['N','E','S','W'];
const MAX_COMMANDS = 256;
const coord = (x,y) => x + ',' + y;
const fail = message => { throw new RangeError(message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasKeys = (value,keys) => isObject(value) &&
  Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
const safeCell = (scene,x,y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
  x >= 0 && y >= 0 && x < scene.width && y < scene.height;
const obstacles = scene => new Set([...scene.walls,...scene.objects].map(cell => coord(cell.x,cell.y)));

function freeCells(scene,start) {
  const blocked = obstacles(scene);
  const queue=[{x:start.x,y:start.y}], visited=new Set([coord(start.x,start.y)]), result=[];
  for(let index=0;index<queue.length;index++){
    const tile=queue[index];
    if (!blocked.has(coord(tile.x,tile.y))) result.push(tile);
    for(const [dx,dy] of OFFSETS){
      const x=tile.x+dx,y=tile.y+dy,key=coord(x,y);
      if(safeCell(scene,x,y) && !blocked.has(key) && !visited.has(key)){
        visited.add(key);queue.push({x,y});
      }
    }
  }
  return result;
}

export function startGroundSquadPositions(world, spatial, away) {
  validateWorld(world);
  validateExploration(world,spatial);
  validateAwayTeam(away);
  if(spatial.area!=='surface' || spatial.pending!==null) fail('Deploy on the surface before moving officers');
  const scene=world.scenes.surface;
  const cells=freeCells(scene,spatial);
  if(cells.length<away.squad.length) fail('No room for deployed squad');
  return {
    version:1,
    origin:{x:spatial.x,y:spatial.y,heading:spatial.heading},
    squad:[...away.squad],
    commands:[],
  };
}

function validateSnapshot(world,away,snapshot){
  validateWorld(world);
  validateAwayTeam(away);
  if(!hasKeys(snapshot,['version','origin','squad','commands']) || snapshot.version!==1 ||
    !hasKeys(snapshot.origin,['x','y','heading']) ||
    !safeCell(world.scenes.surface,snapshot.origin.x,snapshot.origin.y) ||
    !HEADINGS.includes(snapshot.origin.heading) ||
    obstacles(world.scenes.surface).has(coord(snapshot.origin.x,snapshot.origin.y)) ||
    !Array.isArray(snapshot.squad) ||
    snapshot.squad.length!==away.squad.length ||
    snapshot.squad.some((id,i)=>id!==away.squad[i]) ||
    !Array.isArray(snapshot.commands) || snapshot.commands.length>MAX_COMMANDS)
      throw new TypeError('Invalid ground squad snapshot');
  for(const command of snapshot.commands){
    if(!hasKeys(command,['officerId','x','y']) ||
       !snapshot.squad.includes(command.officerId) ||
       !safeCell(world.scenes.surface,command.x,command.y))
      throw new TypeError('Invalid ground squad command');
  }
}

function shortestRoute(scene,officers,id,target){
  const unit=officers.find(item=>item.id===id);
  if(!unit) fail('Unknown deployed officer');
  if(!safeCell(scene,target.x,target.y)) fail('Destination outside surface map');
  const start=coord(unit.x,unit.y),end=coord(target.x,target.y);
  const blocked=obstacles(scene);
  for(const other of officers) if(other.id!==id) blocked.add(coord(other.x,other.y));
  if(blocked.has(end)) fail('Destination occupied or blocked');
  if(start===end) return [];
  const queue=[{x:unit.x,y:unit.y}],previous=new Map([[start,null]]);
  for(let index=0;index<queue.length && !previous.has(end);index++){
    const current=queue[index];
    for(const [dx,dy] of OFFSETS){
      const x=current.x+dx,y=current.y+dy,key=coord(x,y);
      if(!safeCell(scene,x,y) || blocked.has(key) || previous.has(key))continue;
      previous.set(key,coord(current.x,current.y));
      queue.push({x,y});
    }
  }
  if(!previous.has(end)) fail('Unreachable officer destination');
  const route=[];
  for(let current=end;current!==start;current=previous.get(current)){
    const [x,y]=current.split(',').map(Number);
    route.push({x,y});
  }
  return route.reverse();
}

function advanceOfficers(world,snapshot,onVisitedCell=null) {
  const scene=world.scenes.surface;
  const initial=freeCells(scene,snapshot.origin);
  if(initial.length<snapshot.squad.length) fail('No room for deployed squad');
  const officers=snapshot.squad.map((id,i)=>({
    id,x:initial[i].x,y:initial[i].y,heading:snapshot.origin.heading,
  }));
  const events=[];
  for(const command of snapshot.commands){
    const unit=officers.find(item=>item.id===command.officerId);
    const from={x:unit.x,y:unit.y};
    const route=shortestRoute(scene,officers,unit.id,command);
    if(route.length===0) fail('Empty move commands are not recorded');
    let previous=from;
    for(const step of route){
      const dx=step.x-previous.x,dy=step.y-previous.y;
      unit.heading=HEADINGS[OFFSETS.findIndex(([x,y])=>x===dx&&y===dy)];
      onVisitedCell?.(step);
      previous=step;
    }
    unit.x=command.x;
    unit.y=command.y;
    events.push({type:'move',officerId:unit.id,from,to:{x:unit.x,y:unit.y},steps:route.length});
  }
  return {officers,events};
}

export function replayGroundSquadPositions(world,away,snapshot){
  validateSnapshot(world,away,snapshot);
  const {officers,events}=advanceOfficers(world,snapshot);
  return {version:1,officers,events};
}

// All physically visited cells, including intermediate route steps. Deriving
// this from the validated command history avoids a second, desynchronizable
// fog-of-war save. It never mutates the existing v1 snapshot.
export function groundSquadVisitedCells(world,away,snapshot) {
  validateSnapshot(world,away,snapshot);
  const scene=world.scenes.surface;
  const starting=freeCells(scene,snapshot.origin).slice(0,snapshot.squad.length);
  const seen=new Map();
  const record=cell=>seen.set(coord(cell.x,cell.y),{x:cell.x,y:cell.y});
  starting.forEach(record);
  advanceOfficers(world,snapshot,record);
  return [...seen.values()];
}

export function orderGroundOfficerMove(world,away,snapshot,officerId,destination){
  validateSnapshot(world,away,snapshot);
  if(snapshot.commands.length>=MAX_COMMANDS) fail('Ground squad history limit reached');
  if(typeof officerId!=='string' || !snapshot.squad.includes(officerId) ||
    !hasKeys(destination,['x','y'])) throw new TypeError('Invalid officer move');
  const current=advanceOfficers(world,snapshot).officers;
  const route=shortestRoute(world.scenes.surface,current,officerId,destination);
  if(route.length===0) return {snapshot,route:[]};
  const updated={
    version:1,origin:{...snapshot.origin},squad:[...snapshot.squad],
    commands:[...snapshot.commands,{officerId,x:destination.x,y:destination.y}],
  };
  return {snapshot:updated,route};
}

export function serializeGroundSquadPositions(world,away,snapshot){
  replayGroundSquadPositions(world,away,snapshot);
  return JSON.stringify(snapshot);
}

export function deserializeGroundSquadPositions(world,away,raw){
  if(typeof raw!=='string' || raw.length>100_000) throw new TypeError('Invalid ground squad save');
  const snapshot=JSON.parse(raw);
  replayGroundSquadPositions(world,away,snapshot);
  return snapshot;
}
