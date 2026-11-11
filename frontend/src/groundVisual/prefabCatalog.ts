// Large visual pieces can span many REAL tiles but never create walkability.
// The first pilot prefab is deliberately flush with a 2x1 traversable floor,
// not an invented walkway, door, building or new gameplay object.
export type PrefabId='prefab.recessed-service-trench-2x1'|'prefab.industrial-apron-3x2'|'prefab.science-campus-3x1';
export type PrefabDefinition={
 readonly width:number;readonly depth:number;
 readonly clearance:'flush-floor'|'blocked-building';readonly maxAboveFloor:number;
};
export const prefabCatalog:Readonly<Record<PrefabId,PrefabDefinition>>={
 'prefab.recessed-service-trench-2x1':{
  width:2,depth:1,clearance:'flush-floor',maxAboveFloor:.055,
 },
 // Original landing-court deck module; a shallow integrated 3x2 floor
 // assembly that can NEVER alter collision or occupy a blocked cell.
 'prefab.industrial-apron-3x2':{
  width:3,depth:2,clearance:'flush-floor',maxAboveFloor:.15,
 },
 // Physical science facility occupying the three AUTHORITATIVE blockers
 // sensor-vault(2,2), wall(3,2), probe(4,2). This must NEVER spawn from
 // traversable cells or while any part is unknown.
 'prefab.science-campus-3x1':{
  width:3,depth:1,clearance:'blocked-building',maxAboveFloor:1.8,
 }
};
