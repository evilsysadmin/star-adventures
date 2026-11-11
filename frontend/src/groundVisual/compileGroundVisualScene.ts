import type {TerrainTileId,EdgeTileId} from './tileCatalog';
import {prefabCatalog,type PrefabId} from './prefabCatalog';

// Pure, deterministic visual compiler; authoritative walkability and fog
// remain entirely in the authored game world, outside the renderer.
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
export type RockPlacement={kind:'rock';cell:GridCell;cellId:string;
 material:'rock.bedrock'|'rock.fractured';variation:number};
export type PrefabPlacement={kind:'prefab';assetId:PrefabId;
 anchor:GridCell;footprint:readonly string[];rotation:0};
export type GroundVisualPlan={
 readonly tiles:readonly TilePlacement[];
 readonly edges:readonly EdgePlacement[];
 readonly rocks:readonly RockPlacement[];
 readonly prefabs:readonly PrefabPlacement[];
};
export const groundCellId=(x:number,y:number)=>x+','+y;
const sides=[
 {side:'north',dx:0,dy:-1},
 {side:'east',dx:1,dy:0},
 {side:'south',dx:0,dy:1},
 {side:'west',dx:-1,dy:0},
] as const;
const inside=(x:number,y:number,r:VisualRegion)=>
 x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
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
const exterior=(x:number,y:number)=>x>=9||y>=8;
const industrialCore=(x:number,y:number)=>x>=3&&x<=8&&y>=3&&y<=7;
const geologicalWall=(x:number,y:number)=>
 y>=8||x>=10||(x<=1&&(y<=2||y>=6));

export function compileGroundVisualScene(
 world:GroundVisualWorld,region:VisualRegion,
 requestedPrefab?:{id:PrefabId;anchor:GridCell},
):GroundVisualPlan{
 const tiles:TilePlacement[]=[],edges:EdgePlacement[]=[],
  rocks:RockPlacement[]=[],prefabs:PrefabPlacement[]=[];
 if(!validRegion(region,world))return {tiles,edges,rocks,prefabs};
 const walls=new Set(world.walls.map(p=>groundCellId(p.x,p.y)));
 const blocked=new Set([...walls,...world.objects.map(p=>groundCellId(p.x,p.y))]);
 const known=(x:number,y:number)=>world.explored.has(groundCellId(x,y));
 const free=(x:number,y:number)=>
  inWorld(x,y,world)&&!blocked.has(groundCellId(x,y));
 const drawable=(x:number,y:number)=>
  inside(x,y,region)&&free(x,y)&&known(x,y);
 for(let y=region.y;y<region.y+region.height;y++){
  for(let x=region.x;x<region.x+region.width;x++){
   const cellId=groundCellId(x,y),cell={x,y};
   if(drawable(x,y)){
    const h=variant(x,y),outer=exterior(x,y);
    // Families are semantic regions with restrained per-cell wear, not
    // an alternating checkerboard. World-space art texture spans them.
    let assetId:TerrainTileId=outer
     ?(h%5===0?'floor.rock-scree':'floor.rock-bedded')
     :industrialCore(x,y)
      ?(h%7===0?'floor.metal-weathered':'floor.metal')
      :(h%5===0?'floor.concrete-worn':'floor.concrete');
    if(!outer&&(x<=2||y<=2)&&h%3===0)assetId='floor.apron-dust';
    if(outer&&h%4===0)assetId='floor.sand-dust';
    const rockNeighbor=sides.some(side=>{
     const nx=x+side.dx,ny=y+side.dy;
     return walls.has(groundCellId(nx,ny))&&known(nx,ny)&&
       geologicalWall(nx,ny);
    });
    if(rockNeighbor&&h%3===0)assetId='floor.rock-transition';
    tiles.push({kind:'tile',assetId,cell,cellId,rotation:0});
    for(const {side,dx,dy} of sides){
     const nx=x+dx,ny=y+dy,neighbor=groundCellId(nx,ny);
     if(blocked.has(neighbor)&&known(nx,ny)){
      edges.push({kind:'edge',cell,cellId,blockedNeighbor:neighbor,
       side,assetId:walls.has(neighbor)?
        (geologicalWall(nx,ny)?'edge.rock-shelf':'edge.bulkhead')
        :'edge.service'});
     }else if(free(nx,ny)&&known(nx,ny)&&
       industrialCore(x,y)&&exterior(nx,ny)){
      // Low flush platform rim where a KNOWN walkable industrial apron
      // meets KNOWN walkable outer ground. Decorative only, never a wall.
      edges.push({kind:'edge',cell,cellId,blockedNeighbor:neighbor,
       side,assetId:'edge.platform-lip'});
     }
    }
   }else if(walls.has(cellId)&&known(x,y)&&geologicalWall(x,y)&&
    sides.some(({dx,dy})=>drawable(x+dx,y+dy))){
    // Real, already discovered physical walls become irregular rock masses.
    // Never place one on a free cell, rescue station or unknown blocker.
    const h=variant(x,y);
    rocks.push({kind:'rock',cell,cellId,
     material:h%3===0?'rock.fractured':'rock.bedrock',variation:h%11});
   }
  }
 }
 if(requestedPrefab){
  const {id,anchor}=requestedPrefab;
  const def=prefabCatalog[id];
  if(def&&Number.isInteger(def.width)&&Number.isInteger(def.depth)&&
    def.width>0&&def.depth>0){
   const footprint=Array.from({length:def.depth},(_,dy)=>
    Array.from({length:def.width},(_,dx)=>
      ({x:anchor.x+dx,y:anchor.y+dy}))).flat();
   if(footprint.every(p=>drawable(p.x,p.y)))
    prefabs.push({kind:'prefab',assetId:id,anchor,
     footprint:footprint.map(p=>groundCellId(p.x,p.y)),rotation:0});
  }
 }
 return {tiles,edges,rocks,prefabs};
}
