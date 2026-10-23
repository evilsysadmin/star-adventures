// Deterministic *training-only* line-of-sight. No damage, enemy AI, ammo,
// franchise data, graphics, browser APIs or authoritative campaign state.
import {
  TRAINING_COVER, TRAINING_TARGETS, type TrainingState,
  type TrainingUnit, validateTrainingState,
} from './isoTrainingMovement.ts';

export type PracticeShotResult = Readonly<{
  allowed: boolean;
  reason: 'ready' | 'unknown-officer' | 'invalid-target' |
    'out-of-range' | 'cover-blocked' | 'ally-blocked';
  cells: readonly string[];
  blocker: string | null;
}>;

const MAX_RANGE = 7.5;
const coords = (id: string): {x:number;y:number}|null => {
  if (!/^[0-7]:[0-7]$/.test(id)) return null;
  const [x,y]=id.split(':').map(Number);
  return {x,y};
};

/** Supercover cell traversal: includes both flank tiles at an exact corner.
 * Conservatively blocks shots that merely graze cover or squad mates.
 * Order is deterministic (horizontal flank, vertical flank, then diagonal).
 */
export function traceTrainingRay(from: string, to: string): readonly string[] {
  const a=coords(from), b=coords(to);
  if (!a || !b) throw new RangeError('Ray endpoints must be valid grid cells');
  const dx=b.x-a.x, dy=b.y-a.y;
  if (dx===0 && dy===0) return [from];
  const sx=Math.sign(dx),sy=Math.sign(dy);
  const stepX=dx===0 ? Infinity : 1/Math.abs(dx);
  const stepY=dy===0 ? Infinity : 1/Math.abs(dy);
  let tx=stepX/2,ty=stepY/2,x=a.x,y=a.y;
  const result=[from];
  const visited=new Set([from]);
  const add=(xx:number,yy:number)=>{
    const cell=`${xx}:${yy}`;
    if(xx>=0&&xx<8&&yy>=0&&yy<8&&!visited.has(cell)){
      result.push(cell);visited.add(cell);
    }
  };
  while(x!==b.x||y!==b.y){
    if(Math.abs(tx-ty)<1e-10){
      add(x+sx,y);
      add(x,y+sy);
      x+=sx;y+=sy;
      tx+=stepX;ty+=stepY;
    }else if(tx<ty){x+=sx;tx+=stepX;}
    else{y+=sy;ty+=stepY;}
    add(x,y);
  }
  return result;
}

/** Evaluates aiming at one of the TWO authored inert training targets.
 * Merely selects a valid/invalid shot: never invents a hit or a battle result.
 */
export function evaluatePracticeShot(
  state: TrainingState, unitId: TrainingUnit['id'], target: string,
): PracticeShotResult {
  validateTrainingState(state);
  const unit=state.units.find(u=>u.id===unitId);
  if(!unit) return {allowed:false,reason:'unknown-officer',cells:[],blocker:null};
  if(!TRAINING_TARGETS.includes(target))
    return {allowed:false,reason:'invalid-target',cells:[],blocker:null};
  const a=coords(unit.cell)!,b=coords(target)!;
  if(Math.hypot(b.x-a.x,b.y-a.y)>MAX_RANGE)
    return {allowed:false,reason:'out-of-range',cells:[],blocker:null};
  const cells=traceTrainingRay(unit.cell,target);
  const friends=new Set(state.units.filter(u=>u.id!==unitId).map(u=>u.cell));
  for(const cell of cells.slice(1,-1)){
    if(TRAINING_COVER.includes(cell))
      return {allowed:false,reason:'cover-blocked',cells,blocker:cell};
    if(friends.has(cell))
      return {allowed:false,reason:'ally-blocked',cells,blocker:cell};
  }
  return {allowed:true,reason:'ready',cells,blocker:null};
}
