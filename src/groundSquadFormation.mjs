// Collision-safe formation orders for the existing versioned ground-squad journal.
// Pure orchestration: simulate every individual command before accepting the group.
import { replayGroundSquadPositions, orderGroundOfficerMove } from './groundSquadPositions.mjs';

const pos = unit => unit.x + ',' + unit.y;
const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const key = (x,y) => x + ',' + y;
const OFFSETS = [[0,-1],[1,0],[0,1],[-1,0]];

function permutations(items) {
  if(items.length <= 1) return [items];
  return items.flatMap((item,i) => permutations(items.filter((_,j)=>j!==i))
    .map(rest => [item,...rest]));
}

/**
 * Move 2–3 deployed officers into nearby, distinct cells around `anchor`.
 * The first selected officer leads at the requested cell. Followers prefer
 * north/east relative to the leader; if blocked, try nearby walkable slots.
 *
 * The underlying journal stores ordinary single-officer commands. A candidate
 * is accepted only if every move replays legally in sequence: no diagonal
 * shortcuts, overlap, path through a wall, or partial commit on failure.
 */
export function orderGroundFormation(world, away, snapshot, selectedIds, anchor) {
  const before = replayGroundSquadPositions(world, away, snapshot).officers;
  if(!Array.isArray(selectedIds) || selectedIds.length < 2 ||
      selectedIds.length > before.length || new Set(selectedIds).size !== selectedIds.length ||
      selectedIds.some(id => !before.some(unit=>unit.id===id))) {
    throw new TypeError('Invalid ground formation selection');
  }
  const scene = world.scenes.surface;
  if(!anchor || !Number.isSafeInteger(anchor.x) || !Number.isSafeInteger(anchor.y) ||
      anchor.x<0 || anchor.y<0 || anchor.x>=scene.width || anchor.y>=scene.height) {
    throw new TypeError('Invalid formation destination');
  }
  const blocked = new Set([...scene.walls,...scene.objects].map(pos));
  // Unselected officers are immovable obstacles.
  for(const unit of before) if(!selectedIds.includes(unit.id)) blocked.add(pos(unit));
  if(blocked.has(pos(anchor))) throw new RangeError('Formation leader destination occupied');

  const followers = selectedIds.slice(1);
  const candidates = followers.map((_,index) => {
    const [dx,dy] = OFFSETS[index % OFFSETS.length];
    const ideal = {x:anchor.x+dx,y:anchor.y+dy};
    const all=[];
    for(let y=0;y<scene.height;y++)for(let x=0;x<scene.width;x++){
      const tile={x,y};
      if(key(x,y)===pos(anchor) || blocked.has(key(x,y)) ||
        manhattan(tile,anchor)>3) continue;
      all.push(tile);
    }
    // Prefer a recognizable compact formation, then pick deterministic ties.
    return all.sort((a,b)=>
      manhattan(a,ideal)-manhattan(b,ideal) ||
      manhattan(a,anchor)-manhattan(b,anchor) ||
      a.y-b.y || a.x-b.x).slice(0,10);
  });
  if(candidates.some(items=>items.length===0)) throw new RangeError('No available formation slots');

  let best = null;
  const destinations = new Map([[selectedIds[0],anchor]]);
  const orders = permutations(selectedIds);
  function score(candidate,routeLength) {
    const penalty = followers.reduce((sum,id,i) => {
      const [dx,dy] = OFFSETS[i % OFFSETS.length];
      return sum + manhattan(candidate.get(id),{x:anchor.x+dx,y:anchor.y+dy})*100;
    },0);
    return penalty+routeLength;
  }
  function assign(index) {
    if(index === followers.length) {
      for(const order of orders) {
        let working = snapshot;
        const moves=[];
        try{
          for(const officerId of order){
            const target = destinations.get(officerId);
            const result = orderGroundOfficerMove(world,away,working,officerId,target);
            if(result.route.length) moves.push({officerId,to:{...target},steps:result.route.length});
            working = result.snapshot;
          }
          const final = replayGroundSquadPositions(world,away,working).officers;
          if(final.some(unit => selectedIds.includes(unit.id) &&
                pos(unit)!==pos(destinations.get(unit.id)))) continue;
          const rank=score(destinations,moves.reduce((sum,m)=>sum+m.steps,0));
          if(!best || rank<best.rank) best={snapshot:working,moves,rank};
        }catch{
          // A proposed ordering is not navigable; do not apply partial orders.
        }
      }
      return;
    }
    const officerId=followers[index];
    for(const cell of candidates[index]){
      if([...destinations.values()].some(existing => pos(existing)===pos(cell))) continue;
      destinations.set(officerId,cell);
      assign(index+1);
      destinations.delete(officerId);
    }
  }
  assign(0);
  if(!best) throw new RangeError('No collision-free formation route');
  return {snapshot:best.snapshot,moves:best.moves};
}
