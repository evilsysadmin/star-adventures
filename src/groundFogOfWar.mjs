// Deterministic surface knowledge. No browser state, timers, network or art.
// An officer may remember visited terrain but cannot see through structures.
import { groundSquadVisitedCells, replayGroundSquadPositions } from './groundSquadPositions.mjs';

export const GROUND_VISION_RADIUS = 3;
const key = (x,y) => x+','+y;
const valid = (scene,x,y) => Number.isSafeInteger(x)&&Number.isSafeInteger(y) &&
  x>=0&&y>=0&&x<scene.width&&y<scene.height;

// Bresenham center-to-center. The first opaque tile itself is visible; any
// tile beyond it is not. Two touching corner walls block diagonal peeking.
function lineOfSight(opaque,from,to){
 let x=from.x,y=from.y;
 const dx=Math.abs(to.x-x),dy=Math.abs(to.y-y);
 const sx=x<to.x?1:-1,sy=y<to.y?1:-1;
 let error=dx-dy;
 while(x!==to.x||y!==to.y){
  const prevX=x,prevY=y,twice=2*error;
  if(twice>-dy){error-=dy;x+=sx;}
  if(twice<dx){error+=dx;y+=sy;}
  if(x!==prevX && y!==prevY &&
     opaque.has(key(x,prevY)) && opaque.has(key(prevX,y)))return false;
  if((x!==to.x||y!==to.y)&&opaque.has(key(x,y)))return false;
 }
 return true;
}

export function groundVisionCells(scene,eyes,radius=GROUND_VISION_RADIUS){
 if(!Number.isSafeInteger(scene?.width)||!Number.isSafeInteger(scene?.height)||
    !Number.isSafeInteger(radius)||radius<1||radius>8||!Array.isArray(eyes))
  throw new TypeError('Invalid ground visibility input');
 // A floor-level transport pad is traversable sight, not a solid wall.
 // Keep every other station/object opaque: this does not alter movement,
 // interactions, collision or mission state.
 const opaque=new Set([...scene.walls,...scene.objects.filter(object=>
   !(object.id==='beam-out'&&object.type==='transition'))]
   .map(p=>key(p.x,p.y)));
 const result=new Set();
 for(const eye of eyes){
  if(!valid(scene,eye.x,eye.y))throw new RangeError('Observer outside map');
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>radius*radius)continue;
   const x=eye.x+dx,y=eye.y+dy;
   if(valid(scene,x,y)&&lineOfSight(opaque,eye,{x,y}))result.add(key(x,y));
  }
 }
 return result;
}

export function groundFogOfWar(world,away,snapshot){
 const current=replayGroundSquadPositions(world,away,snapshot).officers;
 const visited=groundSquadVisitedCells(world,away,snapshot);
 const scene=world.scenes.surface;
 return {
  visible:groundVisionCells(scene,current),
  explored:groundVisionCells(scene,visited),
 };
}
