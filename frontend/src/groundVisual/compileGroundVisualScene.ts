import type {TerrainTileId,EdgeTileId} from './tileCatalog';
import type {PrefabId} from './prefabCatalog';

// Pure visual compiler: neither imports Three/React nor mutates game state.
// Input coordinates: x=world X, y=world Z, y-up reserved for the 3D renderer.
export type GridCell={readonly x:number;readonly y:number};
export type GroundVisualWorld={
 readonly width:number;readonly height:number;
 readonly walls:ReadonlyArray<GridCell>;
 readonly objects:ReadonlyArray<GridCell>;
 readonly explored:ReadonlySet<string>;
};
export type VisualRegion={readonly x:number;readonly y:number;
 readonly width:number;readonly height:number};
export type EdgeSide='north'|'east'|'south'|'west';
export type TilePlacement={kind:'tile';assetId:TerrainTileId;
 cell:GridCell;cellId:string;rotation:0};
export type EdgePlacement={kind:'edge';assetId:EdgeTileId;
 cell:GridCell;cellId:string;blockedNeighbor:string;side:EdgeSide};
export type PrefabPlacement={kind:'prefab';assetId:PrefabId;
 anchor:GridCell;footprint:readonly string[];rotation:0};
export type GroundVisualPlan={
 readonly tiles:readonly TilePlacement[];
 readonly edges:readonly EdgePlacement[];
 readonly prefabs:readonly PrefabPlacement[];
};
export const groundCellId=(x:number,y:number)=>x+','+y;
const sides=[
 {side:'north',dx:0,dy:-1},
 {side:'east',dx:1,dy:0},
 {side:'south',dx:0,dy:1},
 {side:'west',dx:-1,dy:0},
] as const;
const inside=(x:number,y:number,region:VisualRegion)=>
 x>=region.x&&x<region.x+region.width&&
 y>=region.y&&y<region.y+region.height;
const inWorld=(x:number,y:number,w:GroundVisualWorld)=>
 Number.isInteger(x)&&Number.isInteger(y)&&
 x>=0&&y>=0&&x<w.width&&y<w.height;
const validRegion=(r:VisualRegion,w:GroundVisualWorld)=>
 Number.isInteger(r.x)&&Number.isInteger(r.y)&&
 Number.isInteger(r.width)&&Number.isInteger(r.height)&&
 r.width>0&&r.height>0&&
 inWorld(r.x,r.y,w)&&inWorld(r.x+r.width-1,r.y+r.height-1,w);
const variant=(x:number,y:number)=>
 (Math.imul(x+11,73856093)^Math.imul(y+17,19349663))>>>0;

export function compileGroundVisualScene(
 world:GroundVisualWorld,region:VisualRegion,
 requestedPrefab?:{id:PrefabId;anchor:GridCell},
):GroundVisualPlan{
 const tiles:TilePlacement[]=[],edges:EdgePlacement[]=[],prefabs:PrefabPlacement[]=[];
 if(!validRegion(region,world))return {tiles,edges,prefabs};
 const walls=new Set(world.walls.map(p=>groundCellId(p.x,p.y)));
 const blocked=new Set([...walls,...world.objects.map(p=>groundCellId(p.x,p.y))]);
 const drawable=(x:number,y:number)=>{
  const key=groundCellId(x,y);
  return inWorld(x,y,world)&&inside(x,y,region)&&
   world.explored.has(key)&&!blocked.has(key);
 };
 for(let y=region.y;y<region.y+region.height;y++){
  for(let x=region.x;x<region.x+region.width;x++){
   if(!drawable(x,y))continue;
   const cell={x,y},cellId=groundCellId(x,y);
   // Materials vary across coherent areas, never alternating bright
   // checkerboard tiles. The deterministic rare wear variant is subtle.
   const h=variant(x,y);
   let assetId:TerrainTileId=x>=region.x+Math.ceil(region.width/2)
    ?(h%6===0?'floor.metal-weathered':'floor.metal')
    :(h%7===0?'floor.concrete-worn':'floor.concrete');
   if(y===region.y+region.height-1&&h%4===0)
    assetId='floor.sand-dust';
   // Genuine blocked-neighbor transitions, never unknown geography.
   const knownWall=sides.some(side=>walls.has(groundCellId(x+side.dx,y+side.dy))&&
    world.explored.has(groundCellId(x+side.dx,y+side.dy)));
   if(knownWall&&h%3===0)assetId='floor.rock-transition';
   tiles.push({kind:'tile',assetId,cell,cellId,rotation:0});
   for(const {side,dx,dy} of sides){
    const neighbor=groundCellId(x+dx,y+dy);
    if(!blocked.has(neighbor)||!world.explored.has(neighbor))continue;
    // The side is an underfoot trim next to a *real* obstruction.
    edges.push({kind:'edge',
     assetId:walls.has(neighbor)?'edge.bulkhead':'edge.service',
     cell,cellId,blockedNeighbor:neighbor,side});
   }
  }
 }
 if(requestedPrefab){
  const {id,anchor}=requestedPrefab;
  // Only the single authored two-wide, flush-floor prototype is enabled.
  // A later catalog may contain larger building footprints and anchors.
  if(id==='prefab.recessed-service-trench-2x1'&&
   drawable(anchor.x,anchor.y)&&drawable(anchor.x+1,anchor.y))
   prefabs.push({kind:'prefab',assetId:id,anchor,
    footprint:[groundCellId(anchor.x,anchor.y),
     groundCellId(anchor.x+1,anchor.y)],rotation:0});
 }
 return {tiles,edges,prefabs};
}
