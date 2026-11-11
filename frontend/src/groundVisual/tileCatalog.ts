import type {SurfaceFamily} from './groundSurfacePatterns';
// Reusable, entirely original art definitions. Nothing here defines collision
// or the movement rules; those belong to the authoritative world scene.
export type TerrainTileId=
 |'floor.concrete'|'floor.concrete-worn'|'floor.metal'
 |'floor.metal-weathered'|'floor.rock-transition'|'floor.sand-dust';
export type EdgeTileId='edge.bulkhead'|'edge.service';
export type VisualTileId=TerrainTileId|EdgeTileId;
export type MaterialDefinition={color:number;metalness:number;roughness:number};
export type TileDefinition=
 |{kind:'terrain';surface:SurfaceFamily;material:MaterialDefinition}
 |{kind:'edge';material:MaterialDefinition};
export const tileCatalog:Readonly<Record<VisualTileId,TileDefinition>>={
 'floor.concrete':{kind:'terrain',surface:'concrete',material:{color:0x6d7f75,metalness:.10,roughness:.96}},
 'floor.concrete-worn':{kind:'terrain',surface:'concrete',material:{color:0x657b72,metalness:.08,roughness:1}},
 'floor.metal':{kind:'terrain',surface:'steel',material:{color:0x637b78,metalness:.46,roughness:.79}},
 'floor.metal-weathered':{kind:'terrain',surface:'steel',material:{color:0x5d7472,metalness:.39,roughness:.87}},
 'floor.rock-transition':{kind:'terrain',surface:'mineral',material:{color:0x66776d,metalness:.07,roughness:1}},
 'floor.sand-dust':{kind:'terrain',surface:'dust',material:{color:0x758175,metalness:.03,roughness:1}},
 'edge.bulkhead':{kind:'edge',material:{color:0x2d4346,metalness:.52,roughness:.71}},
 'edge.service':{kind:'edge',material:{color:0x9c9d86,metalness:.35,roughness:.86}},
};
