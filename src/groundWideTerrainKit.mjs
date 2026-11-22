// Deterministic, reuse-friendly visual contract for a real authored ground map.
// This module NEVER adds walkability, cover, vision, stations or new missions.
// Decorations follow the canonical cells and known blocked wall footprints.
export const WIDE_TERRAIN_FAMILIES=Object.freeze({
  landing:Object.freeze({id:'landing-deck',floor:'#455957',floorAlt:'#54665f',edge:'#213d40',highlight:'#a5b1a2',wall:'service'}),
  industrial:Object.freeze({id:'service-steel',floor:'#41565a',floorAlt:'#536369',edge:'#254148',highlight:'#a0b5af',wall:'service'}),
  'north-ridge':Object.freeze({id:'ridge-shale',floor:'#4a564b',floorAlt:'#586455',edge:'#283d38',highlight:'#a7ac8b',wall:'rock'}),
  'south-yard':Object.freeze({id:'freight-concrete',floor:'#5c5751',floorAlt:'#6b675d',edge:'#393d3b',highlight:'#c0b9a2',wall:'freight'}),
  'remote-lab':Object.freeze({id:'lab-ceramic',floor:'#627d80',floorAlt:'#789296',edge:'#315b62',highlight:'#b5d3ca',wall:'lab'}),
  'low-approach':Object.freeze({id:'weathered-steppe',floor:'#514d3f',floorAlt:'#645c49',edge:'#3e3d34',highlight:'#a9a184',wall:'rock'}),
});

const fail=message=>{throw new TypeError('Invalid wide terrain: '+message);};
const cellKey=(x,y)=>x+','+y;
const integer=(value)=>Number.isSafeInteger(value)&&value>=0;
const inBounds=(x,y,width,height)=>integer(x)&&integer(y)&&x<width&&y<height;
const finitePoint=point=>point&&integer(point.x)&&integer(point.y);

function nearestSector(x,y,sectors){
  // The authored six zones do not fill EVERY bridge, corridor and perimeter
  // cell: choose the closest sector for transitional cells, with stable ties.
  let winner=null,distance=Infinity;
  for(const sector of sectors){
    const [left,top,right,bottom]=sector.bounds;
    const dx=Math.max(left-x,0,x-right);
    const dy=Math.max(top-y,0,y-bottom);
    const candidate=dx+dy;
    if(candidate<distance){winner=sector;distance=candidate;}
  }
  return winner;
}

// A repeatable microvariation; never Math.random, map-size-dependent random
// streams or saving art seeds. One coordinate always yields one visual prefab.
function variation(x,y,sectorId){
  let seed=2166136261;
  for(const code of sectorId) seed=Math.imul(seed^code.charCodeAt(0),16777619)>>>0;
  seed=Math.imul(seed^x,16777619)>>>0;
  seed=Math.imul(seed^y,16777619)>>>0;
  return seed;
}

export function buildWideTerrainKit(scene,sectors){
  const width=scene?.width,height=scene?.height;
  if(!integer(width)||!integer(height)||width<4||height<4||width>100||height>100||
     !Array.isArray(scene?.walls)||!Array.isArray(scene?.objects)||
     !Array.isArray(sectors)||sectors.length!==6) fail('world dimensions / six sector contract');
  const seenSectors=new Set();
  for(const s of sectors){
    if(!s||typeof s.id!=='string'||!Object.hasOwn(WIDE_TERRAIN_FAMILIES,s.id)||
       seenSectors.has(s.id)||!Array.isArray(s.bounds)||s.bounds.length!==4||
       s.bounds.some(n=>!integer(n))||s.bounds[0]>s.bounds[2]||
       s.bounds[1]>s.bounds[3]||!inBounds(s.bounds[2],s.bounds[3],width,height))
      fail('invalid authored sector');
    seenSectors.add(s.id);
  }
  if(seenSectors.size!==Object.keys(WIDE_TERRAIN_FAMILIES).length)
    fail('missing terrain family');
  const obstacles=new Set(),walls=new Set();
  for(const wall of scene.walls){
    if(!finitePoint(wall)||!inBounds(wall.x,wall.y,width,height))
      fail('wall outside physical grid');
    const k=cellKey(wall.x,wall.y);
    if(walls.has(k))fail('duplicate physical wall');
    walls.add(k);obstacles.add(k);
  }
  for(const object of scene.objects){
    if(!finitePoint(object)||!inBounds(object.x,object.y,width,height)||
       obstacles.has(cellKey(object.x,object.y))) fail('overlapping real station');
    obstacles.add(cellKey(object.x,object.y));
  }

  const tiles=[];
  const barriers=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sector=nearestSector(x,y,sectors);
    const family=WIDE_TERRAIN_FAMILIES[sector.id];
    const id=cellKey(x,y);
    const seed=variation(x,y,sector.id);
    const solid=obstacles.has(id);
    const tile={
      x,y,key:id,sectorId:sector.id,family:family.id,
      floor:seed%7<3?family.floorAlt:family.floor,
      edge:family.edge,highlight:family.highlight,
      variant:seed%6,grain:(seed>>>5)%4,
      blocked:solid,
    };
    tiles.push(tile);
    if(walls.has(id)){
      // A barrier is exactly one canonical wall cell. No visual prefab may
      // enlarge the collision mask or silently place a new blocking crate.
      barriers.push({
        x,y,key:id,sectorId:sector.id,family:family.id,wall:family.wall,
        variant:(seed>>>7)%4,
      });
    }
  }
  return {tiles,barriers};
}
