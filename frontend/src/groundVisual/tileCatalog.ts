// Original reusable visual material families. Canonical scene.walls/objects
// alone define collision; these materials are never authoritative.
export type TerrainTileId=
 |'floor.concrete'|'floor.concrete-worn'|'floor.metal'
 |'floor.metal-weathered'|'floor.rock-transition'|'floor.sand-dust'
 |'floor.rock-bedded'|'floor.rock-scree'|'floor.apron-dust';
export type EdgeTileId='edge.bulkhead'|'edge.service'
 |'edge.rock-shelf'|'edge.platform-lip';
export type VisualTileId=TerrainTileId|EdgeTileId;
export type MaterialDefinition={color:number;metalness:number;roughness:number};
export type TileDefinition={kind:'terrain'|'edge';material:MaterialDefinition};
export const tileCatalog:Readonly<Record<VisualTileId,TileDefinition>>={
 'floor.concrete':{kind:'terrain',material:{color:0xd7dbce,metalness:.11,roughness:.96}},
 'floor.concrete-worn':{kind:'terrain',material:{color:0xb9ccc0,metalness:.09,roughness:1}},
 'floor.metal':{kind:'terrain',material:{color:0xb5c9c4,metalness:.36,roughness:.81}},
 'floor.metal-weathered':{kind:'terrain',material:{color:0x9eafa9,metalness:.25,roughness:.93}},
 'floor.rock-transition':{kind:'terrain',material:{color:0xb1b2a1,metalness:.04,roughness:1}},
 'floor.sand-dust':{kind:'terrain',material:{color:0xc1ac8b,metalness:.03,roughness:1}},
 'floor.rock-bedded':{kind:'terrain',material:{color:0x9eaa91,metalness:.04,roughness:1}},
 'floor.rock-scree':{kind:'terrain',material:{color:0xaeb19b,metalness:.02,roughness:1}},
 'floor.apron-dust':{kind:'terrain',material:{color:0xb7b3a0,metalness:.05,roughness:.99}},
 'edge.bulkhead':{kind:'edge',material:{color:0x395458,metalness:.52,roughness:.71}},
 'edge.service':{kind:'edge',material:{color:0xb8a77f,metalness:.35,roughness:.86}},
 'edge.rock-shelf':{kind:'edge',material:{color:0x657467,metalness:.04,roughness:1}},
 'edge.platform-lip':{kind:'edge',material:{color:0xb6a67e,metalness:.56,roughness:.74}},
};
