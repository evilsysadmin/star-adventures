// Large visual pieces can span many REAL tiles but never create walkability.
// The first pilot prefab is deliberately flush with a 2x1 traversable floor,
// not an invented walkway, door, building or new gameplay object.
export type PrefabId='prefab.recessed-service-trench-2x1'|'prefab.industrial-apron-3x2';
export type PrefabDefinition={
 readonly width:number;readonly depth:number;
 readonly clearance:'flush-floor';readonly maxAboveFloor:number;
};
export const prefabCatalog:Readonly<Record<PrefabId,PrefabDefinition>>={
 'prefab.recessed-service-trench-2x1':{
  width:2,depth:1,clearance:'flush-floor',maxAboveFloor:.055,
 },
 // Original landing-court deck module; a shallow integrated 3x2 floor
 // assembly that can NEVER alter collision or occupy a blocked cell.
 'prefab.industrial-apron-3x2':{
  width:3,depth:2,clearance:'flush-floor',maxAboveFloor:.15,
 }
};
