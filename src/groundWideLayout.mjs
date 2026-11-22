// Compiles an authored, non-live planetary extension against a validated
// existing ground scene. The return value is a NEW world object: never mutate
// the active campaign world, mission journal, published GLB slots or saves.
// Future missions can reuse this simple wall-run / actual-gate contract.
import {validateWorld} from './spatial.mjs';

const key=(x,y)=>x+','+y;
const coordinate=(point,width,height)=>
  Array.isArray(point)&&point.length===2&&
  point.every(Number.isSafeInteger)&&point[0]>=0&&point[1]>=0&&
  point[0]<width&&point[1]<height;
const fail=message=>{throw new TypeError('Invalid ground expansion: '+message);};
const basicName=value=>typeof value==='string'&&value.length>0&&value.length<=128;
const description=value=>typeof value==='string'&&value.length>0&&value.length<=512;

export function composeGroundExpansion(baseWorld,plan){
  validateWorld(baseWorld);
  const original=baseWorld.scenes.surface;
  if(!original||!plan||plan.schemaVersion!==1||
     !basicName(plan.id)||plan.status!=='candidate-not-active'||
     plan.basedOn!=='meridian.surface'||!Number.isSafeInteger(plan.width)||
     !Number.isSafeInteger(plan.height)||plan.width<=original.width||
     plan.height<=original.height||plan.width>100||plan.height>100||
     !Array.isArray(plan.openings)||!Array.isArray(plan.wallRuns)||
     !Array.isArray(plan.sectors)||!Array.isArray(plan.proposedObjectives)||
     !Array.isArray(plan.decorativeScenery))
    fail('schema, dimensions or status');

  const obstacles=new Map(original.walls.map(({x,y})=>[key(x,y),{x,y}]));
  const realObjects=new Set(original.objects.map(({x,y})=>key(x,y)));
  const opened=new Set();
  for(const point of plan.openings){
    if(!coordinate(point,original.width,original.height))fail('opening outside original map');
    const id=key(...point);
    if(opened.has(id)||!obstacles.delete(id))fail('opening is not an existing blocked wall');
    opened.add(id);
  }
  for(const run of plan.wallRuns){
    if(!Array.isArray(run)||run.length!==2||
       !coordinate(run[0],plan.width,plan.height)||
       !coordinate(run[1],plan.width,plan.height))fail('invalid wall run');
    const [[x1,y1],[x2,y2]]=run;
    if(x1>x2||y1>y2||(x1!==x2&&y1!==y2))fail('non-axial wall run');
    for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
      const id=key(x,y);
      if(realObjects.has(id)||opened.has(id))fail('new wall covers real mission object or new entrance');
      obstacles.set(id,{x,y});
    }
  }

  const ids=new Set(),targets=new Set();
  for(const objective of plan.proposedObjectives){
    if(!basicName(objective?.id)||ids.has(objective.id)||
       !basicName(objective.title)||!basicName(objective.kind)||
       !description(objective.outcome)||
       !coordinate(objective.at,plan.width,plan.height))fail('objective metadata');
    const id=key(...objective.at);
    if(obstacles.has(id)||realObjects.has(id)||targets.has(id))
      fail('objective is blocked or overlapping');
    ids.add(objective.id);targets.add(id);
  }
  const sectors=new Set();
  for(const sector of plan.sectors){
    if(!basicName(sector?.id)||sectors.has(sector.id)||
       !basicName(sector.name)||!description(sector.role)||
       !Array.isArray(sector.bounds)||sector.bounds.length!==4||
       !sector.bounds.every(Number.isSafeInteger)||
       !coordinate([sector.bounds[0],sector.bounds[1]],plan.width,plan.height)||
       !coordinate([sector.bounds[2],sector.bounds[3]],plan.width,plan.height)||
       sector.bounds[0]>sector.bounds[2]||sector.bounds[1]>sector.bounds[3]||
       !coordinate(sector.entry,plan.width,plan.height)||
       obstacles.has(key(...sector.entry))||realObjects.has(key(...sector.entry)))
      fail('sector cannot be entered or has invalid bounds');
    sectors.add(sector.id);
  }

  const scenery=[...(original.scenery??[]).map(item=>({...item}))];
  for(const item of plan.decorativeScenery){
    if(!item||!['stone','tuft','crater','crystal'].includes(item.type)||
       !coordinate([item.x,item.y],plan.width,plan.height)||
       obstacles.has(key(item.x,item.y))||realObjects.has(key(item.x,item.y)))
      fail('decorative scenery must be inside a REAL traversable cell');
    scenery.push({...item});
  }
  const next={
    ...baseWorld,
    scenes:{
      ...baseWorld.scenes,
      surface:{
        ...original,
        width:plan.width,height:plan.height,
        walls:[...obstacles.values()].sort((a,b)=>a.y-b.y||a.x-b.x),
        objects:original.objects.map(item=>({...item})),
        spawn:{...original.spawn},
        scenery,
      },
    },
  };
  validateWorld(next);
  // Design-time waypoint metadata is NEVER registered as a live station.
  return next;
}
