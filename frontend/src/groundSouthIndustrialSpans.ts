// A discovered run of EXISTING south perimeter walls may be dressed as one
// industrial building. A missing/unknown wall splits the roof: art is never
// permitted to bridge an unexplored cell or invent a walkable surface.
export type SouthWingSpan={start:number;end:number;cells:readonly string[]};
export const SOUTH_FACTORY_ROW=7;
const SOUTH_FACTORY_START=2;
const SOUTH_FACTORY_END=7;
const key=(x:number,y:number)=>x+','+y;

export function southIndustrialSpans(explored:ReadonlySet<string>,
  walls:ReadonlyArray<{x:number;y:number}>):SouthWingSpan[]{
 const blocked=new Set(walls.map(cell=>key(cell.x,cell.y)));
 const spans:SouthWingSpan[]=[];
 let run:number[]=[];
 const finish=()=>{
  if(run.length>=2)
   spans.push({start:run[0],end:run[run.length-1],
     cells:run.map(x=>key(x,SOUTH_FACTORY_ROW))});
  run=[];
 };
 for(let x=SOUTH_FACTORY_START;x<=SOUTH_FACTORY_END+1;x++){
  if(x<=SOUTH_FACTORY_END&&blocked.has(key(x,SOUTH_FACTORY_ROW))&&
    explored.has(key(x,SOUTH_FACTORY_ROW)))run.push(x);
  else finish();
 }
 return spans;
}

export function southIndustrialCoveredColumns(spans:ReadonlyArray<SouthWingSpan>):ReadonlySet<number>{
 const covered=new Set<number>();
 for(const span of spans)
  for(let x=span.start;x<=span.end;x++)covered.add(x);
 return covered;
}
