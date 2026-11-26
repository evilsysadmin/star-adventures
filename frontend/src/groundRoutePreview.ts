// Presentation-only projection input. Never disclose a planned route through
// unexplored cells, even if a later waypoint returns to remembered terrain.
type Point=Readonly<{x:number;y:number}>;
type Officer=Point & {id:string;route?:readonly Point[]};
type Preview={id:string;points:Point[];complete:boolean};

// Conservative rectangular envelope of each segment, including cells
// touched on an exact half-tile boundary. The canonical motion planner
// supplies short segments; no geometry, pathfinding or fog state is changed.
function knownSegment(from:Point,to:Point,explored:ReadonlySet<string>){
  if(![from.x,from.y,to.x,to.y].every(Number.isFinite)||
     Math.abs(from.x-to.x)>2||Math.abs(from.y-to.y)>2)return false;
  for(let y=Math.ceil(Math.min(from.y,to.y)-.5);y<=Math.floor(Math.max(from.y,to.y)+.5);y++)
    for(let x=Math.ceil(Math.min(from.x,to.x)-.5);x<=Math.floor(Math.max(from.x,to.x)+.5);x++)
      if(!explored.has(x+','+y))return false;
  return true;
}

export function groundRoutePreviews(
  officers:readonly Officer[],selected:readonly string[],explored:ReadonlySet<string>,
):Preview[]{
  const active=new Set(selected);
  const previews:Preview[]=[];
  for(const officer of officers){
    if(!active.has(officer.id)||!officer.route?.length)continue;
    const points:Point[]=[{x:officer.x,y:officer.y}];
    let complete=true;
    for(const target of officer.route){
      const from=points[points.length-1];
      if(!knownSegment(from,target,explored)){complete=false;break;}
      if(from.x!==target.x||from.y!==target.y)points.push({x:target.x,y:target.y});
    }
    if(points.length>1)previews.push({id:officer.id,points,complete});
  }
  return previews;
}
