import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import assets from '../assets/r2-assets-manifest.json';
import { cells, cellCenter, pickCell } from '../tacticalGrid';
import { createIsoCamera } from '../tacticalIsoCamera';
import { createIsoDetailCamera } from '../tacticalIsoFocus';
import { WALK_ATLAS, walkFrameUv } from '../tacticalAnimation';
import { HOSTILE_IDLE_FRAME_MS, hostileIdleFrameAt, hostileStepAt } from '../isoHostileAnimation';
import { officerRouteStepAt } from '../isoOfficerAnimation';
import { isoFireFrame } from '../isoFirePlayback';
import { missionPath, type MissionState, type Scenario, type SquadId } from '../isoScenarioCampaign';
import type { HostileId } from '../isoScenarioHostileTurn';

type ShotVisual = Readonly<{ id:number; from:string; to:string; officer:SquadId }>;
// A fast tracer followed by a readable, fading hit glow; visual only.
const SHOT_DURATION_MS=1600;
const SHOT_TRAVEL_FRACTION=.4;
type BoardProps = {
  scenario: Scenario; mission: MissionState; selected: string; focus: boolean;
  route: readonly string[] | null; hostilePositions?: Readonly<Record<HostileId,string>>;
  hostileHealth?: Readonly<Record<HostileId,number>>;
  shot?: ShotVisual | null;
  onPick: (cell: string) => void;
};
type BoardRuntime = { sync: (m:MissionState,s:string,f:boolean,r:readonly string[]|null,h?:Readonly<Record<HostileId,string>>,hp?:Readonly<Record<HostileId,number>>,shot?:ShotVisual|null)=>void };
type SpriteMotion = { from:THREE.Vector3;to:THREE.Vector3;started:number };
type SquadMotion = SpriteMotion & { path:readonly string[] };
const officers = [
  {id:'science' as const,sex:'female',color:'#9ad9e9'},
  {id:'security' as const,sex:'male',color:'#e7c47d'},
  {id:'medic' as const,sex:'female',color:'#acd6a2'},
] as const;
const atCell=(id:string,size:Scenario['size'])=>{
  const [col,row]=id.split(':').map(Number);
  return cellCenter({col,row},size);
};

export function IsoScenarioBoard({scenario,mission,selected,focus,route,hostilePositions,hostileHealth,shot,onPick}:BoardProps){
 const host=useRef<HTMLDivElement>(null);
 const runtime=useRef<BoardRuntime|null>(null);
 const onPickRef=useRef(onPick);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{onPickRef.current=onPick;},[onPick]);
 const routeId=route?.join('|')??'';
 useEffect(()=>{
  const element=host.current;
  if(!element)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}
  catch{
   setError('WebGL no disponible. El selector de casillas y todas las órdenes siguen operativos.');
   return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const canvas=renderer.domElement;
  canvas.setAttribute('data-testid','scenario-render-canvas');
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`Mapa táctico ${scenario.size} por ${scenario.size}; hay un selector accesible más abajo`);
  element.appendChild(canvas);
  const scene=new THREE.Scene();
  const shades = scenario.id==='derelict'
   ? {sky:'#0c1323',tile:'#243346',alternate:'#1c2a3a',wall:'#687084',metal:'#b3a68b'}
   : scenario.id==='evacuation'
   ? {sky:'#1e1922',tile:'#473b38',alternate:'#3c302f',wall:'#91766a',metal:'#e1b184'}
   : {sky:'#091b28',tile:'#204553',alternate:'#183745',wall:'#607a82',metal:'#adcab4'};
  scene.background=new THREE.Color(shades.sky);
  scene.add(new THREE.AmbientLight('#c4d8ef',1.75));
  const sun=new THREE.DirectionalLight('#fff2d6',2.7);
  sun.position.set(-4,12,5);scene.add(sun);
  const objects:THREE.Object3D[]=[];
  const add=<T extends THREE.Object3D>(object:T):T=>{objects.push(object);scene.add(object);return object;};
  const floor=add(new THREE.Mesh(
   new THREE.BoxGeometry(scenario.size+.75,.44,scenario.size+.75),
   new THREE.MeshStandardMaterial({color:shades.tile,metalness:.36,roughness:.72})
  ));
  floor.position.y=-.36;
  const walls=new Set(scenario.walls),cover=new Set(scenario.cover);
  for(const cell of cells(scenario.size)){
   const blocked=walls.has(cell.id),protectedTile=cover.has(cell.id);
   const elevated=blocked?1.20:protectedTile?.51:.12;
   const tile=add(new THREE.Mesh(
    new THREE.BoxGeometry(.963,elevated,.963),
    new THREE.MeshStandardMaterial({
     color:blocked?shades.wall:protectedTile?shades.metal:(cell.col+cell.row)%2?shades.alternate:shades.tile,
     metalness:blocked?.32:.13,roughness:blocked?.65:.83,
    })
   ));
   const p=cellCenter(cell,scenario.size);
   tile.position.set(p.x,(elevated-.12)/2,p.z);
   if(blocked){
    const top=add(new THREE.Mesh(
     new THREE.BoxGeometry(.77,.17,.77),
     new THREE.MeshStandardMaterial({color:'#283946',metalness:.53,roughness:.38})
    ));
    top.position.set(p.x,elevated-.08,p.z);
   }
  }
  const objectiveMaterials=new Map<string,THREE.MeshBasicMaterial>();
  const makeObjective=(id:string,color:string,kind:'sensor'|'console'|'survivor'|'extraction')=>{
   const geometry=kind==='console'?new THREE.BoxGeometry(.66,.35,.66)
    :kind==='survivor'?new THREE.CylinderGeometry(.30,.35,.85,12)
    :new THREE.TorusGeometry(kind==='sensor'?.32:.42,.075,8,28);
   const material=new THREE.MeshBasicMaterial({color});
   const mesh=add(new THREE.Mesh(geometry,material));
   const p=atCell(id,scenario.size);
   if(kind==='sensor'||kind==='extraction'){mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,.24,p.z);}
   else mesh.position.set(p.x,kind==='console'?.39:.53,p.z);
   objectiveMaterials.set(kind,material);
  };
  makeObjective(scenario.sensor,'#70ddf4','sensor');
  if(scenario.console)makeObjective(scenario.console,'#ffd283','console');
  if(scenario.survivor)makeObjective(scenario.survivor,'#f8a5ae','survivor');
  makeObjective(scenario.extraction,'#98eba2','extraction');
  const highlight=add(new THREE.LineSegments(
   new THREE.EdgesGeometry(new THREE.BoxGeometry(.98,.18,.98)),
   new THREE.LineBasicMaterial({color:'#fff1ad',depthTest:false})
  ));
  highlight.renderOrder=80;
  const routeTiles=new Map<string,THREE.Mesh>();
  const routeGeometry=new THREE.CircleGeometry(.25,18);
  for(const tile of cells(scenario.size)){
   const p=cellCenter(tile,scenario.size);
   const dot=add(new THREE.Mesh(routeGeometry,
    new THREE.MeshBasicMaterial({color:'#83e9c4',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false})
   ));
   dot.rotation.x=-Math.PI/2;
   dot.position.set(p.x,.139,p.z);
   dot.visible=false;
   routeTiles.set(tile.id,dot);
  }
  // A shot is a brief visual confirmation of an accepted v4 fire command.
  // These meshes are never part of the raycasting/picking layer.
  const projectile=add(new THREE.Mesh(new THREE.SphereGeometry(.23,12,8),
   new THREE.MeshBasicMaterial({color:'#ffedb1',depthTest:false,depthWrite:false})));
  // A persistent, thin phaser streak makes short-range fire legible even on
  // narrow screens, where a single moving sphere can disappear behind sprites.
  const shotBeam=add(new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,1,8),
   new THREE.MeshBasicMaterial({color:'#8df4ff',transparent:true,opacity:.9,depthTest:false,depthWrite:false})));
  const muzzleFlash=add(new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),
   new THREE.MeshBasicMaterial({color:'#fff2bc',depthTest:false,depthWrite:false})));
  const impactFlash=add(new THREE.Mesh(new THREE.SphereGeometry(.6,12,8),
   new THREE.MeshBasicMaterial({color:'#ff8457',transparent:true,opacity:.94,depthTest:false,depthWrite:false})));
  for(const mesh of [projectile,shotBeam,muzzleFlash,impactFlash]){
   mesh.visible=false;
   mesh.renderOrder=95;
  }
  canvas.dataset.shotPhase='idle';
  const squad=new Map<SquadId,{sprite:THREE.Sprite;fallback:THREE.Mesh;idle:THREE.Texture|null;walk:THREE.Texture|null;fire:THREE.Texture|null}>();
  const textures:THREE.Texture[]=[];
  const loader=new THREE.TextureLoader();
  let disposed=false;
  const render=()=>{if(!disposed)renderer.render(scene,camera);};
  let camera=createIsoCamera(1,scenario.size,3.18);
  for(const officer of officers){
   const position=atCell(mission.locations[officer.id],scenario.size);
   const fallback=add(new THREE.Mesh(
    new THREE.ConeGeometry(.26,.86,7),
    new THREE.MeshStandardMaterial({color:officer.color,metalness:.35})
   ));
   fallback.position.set(position.x,.62,position.z);
   const sprite=add(new THREE.Sprite(new THREE.SpriteMaterial({
    transparent:true,depthWrite:false,alphaTest:.06
   })));
   sprite.visible=false;
   sprite.name=officer.id;
   sprite.center.set(.5,0);
   sprite.scale.set(1.48,2.28,1);
   sprite.position.set(position.x,.14,position.z);
   squad.set(officer.id,{sprite,fallback,idle:null,walk:null,fire:null});
  }
  for(const sex of ['female','male'] as const){
   // Resting squad members use the dedicated one-frame MVS portraits. A walk
   // atlas makes an idle officer look mid-stride even when no move is active.
   const key=sex==='female'?'starAdventures.tactical.officerFemaleMvsV1'
     :'starAdventures.tactical.officerMaleMvsV1';
   const texture=loader.load(assets.assets[key].url,()=>{
    if(disposed)return;
    for(const officer of officers.filter(unit=>unit.sex===sex)){
     const visual=squad.get(officer.id)!;
     visual.idle=texture;
     visual.sprite.material.map=texture;
     visual.sprite.material.needsUpdate=true;
     visual.sprite.visible=true;
     visual.fallback.visible=false;
    }
    render();
   },undefined,()=>{if(!disposed)render();});
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.magFilter=THREE.LinearFilter;
   textures.push(texture);
   const walkKey=sex==='female'?'starAdventures.tactical.officerFemaleWalkV1'
     :'starAdventures.tactical.officerMaleWalkV1';
   const walk=loader.load(assets.assets[walkKey].url,loaded=>{
    if(disposed)return;
    for(const officer of officers.filter(unit=>unit.sex===sex)){
     const visual=squad.get(officer.id)!;
     const isolated=loaded.clone();
     isolated.repeat.set(1/WALK_ATLAS.columns,1/WALK_ATLAS.rows);
     isolated.offset.set(walkFrameUv(0).x,walkFrameUv(0).y);
     isolated.magFilter=THREE.LinearFilter;
     isolated.needsUpdate=true;
     visual.walk=isolated;textures.push(isolated);
    }
    render();
   },undefined,()=>{if(!disposed)render();});
   walk.colorSpace=THREE.SRGBColorSpace;textures.push(walk);
   // Real accepted shots play the existing authored fire atlas on the shooter,
   // not merely a projectile over an officer frozen in an idle pose.
   const fireKey=sex==='female'?'starAdventures.tactical.officerFemaleFireV1'
     :'starAdventures.tactical.officerMaleFireV1';
   const fire=loader.load(assets.assets[fireKey].url,loaded=>{
    if(disposed)return;
    for(const officer of officers.filter(unit=>unit.sex===sex)){
     const visual=squad.get(officer.id)!;
     const isolated=loaded.clone();
     isolated.repeat.set(1/WALK_ATLAS.columns,1/WALK_ATLAS.rows);
     const uv=walkFrameUv(0);
     isolated.offset.set(uv.x,uv.y);
     isolated.magFilter=THREE.LinearFilter;
     isolated.needsUpdate=true;
     visual.fire=isolated;textures.push(isolated);
    }
    canvas.dataset.fireAtlasesReady=String([...squad.values()].filter(visual=>visual.fire).length);
    render();
   },undefined,()=>{if(!disposed)render();});
   fire.colorSpace=THREE.SRGBColorSpace;fire.magFilter=THREE.LinearFilter;
   textures.push(fire);
  }
  // The v1 training view keeps authored contact cells. Opt-in v2 encounters
  // supply replayed hostile positions; Three.js never owns simulation state.
  const hostileAssets={
   // Contacts must read as threats at the whole-board lens, not as extra crew.
   aegis:{key:'starAdventures.tactical.aegisRaiderIdleV1',scale:[2.02,3.04] as const,color:'#e4946f'},
   veil:{key:'starAdventures.tactical.veilAgentIdleV1',scale:[1.74,2.68] as const,color:'#b59be8'},
  } as const;
  type HostileVisual={ground:THREE.Mesh;sprite:THREE.Sprite;idle:THREE.Texture|null;walk:THREE.Texture|null};
  const hostileVisuals=new Map<HostileId,HostileVisual>();
  for(const hostile of scenario.hostiles){
   const asset=hostileAssets[hostile.id];
   const p=atCell(hostile.cell,scenario.size);
   const ground=add(new THREE.Mesh(new THREE.CircleGeometry(.39,24),new THREE.MeshBasicMaterial({
    color:asset.color,transparent:true,opacity:.24,depthWrite:false,
   })));
   ground.rotation.x=-Math.PI/2;ground.position.set(p.x,.107,p.z);
   const sprite=add(new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,alphaTest:.06})));
   sprite.name=hostile.label;sprite.center.set(.5,0);sprite.scale.set(asset.scale[0],asset.scale[1],1);sprite.position.set(p.x,.14,p.z);
   const visual:HostileVisual={ground,sprite,idle:null,walk:null};
   hostileVisuals.set(hostile.id,visual);
   // Both atlases contain six frames. Each hostile owns its own UV offsets:
   // a shared texture would make two independent sprites animate in lockstep.
   for(const [clip,key] of [
    ['idle',asset.key],
    ['walk',hostile.id==='aegis'?'starAdventures.tactical.aegisRaiderWalkV1':'starAdventures.tactical.veilAgentWalkV1'],
   ] as const){
    const texture=loader.load(assets.assets[key].url,()=>{
     if(disposed)return;
     visual[clip]=texture;
     if(clip==='idle'){sprite.material.map=texture;sprite.material.needsUpdate=true;}
     render();
    },undefined,()=>{if(!disposed)render();});
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.repeat.set(1/WALK_ATLAS.columns,1/WALK_ATLAS.rows);
    const uv=walkFrameUv(0);texture.offset.set(uv.x,uv.y);
    texture.magFilter=THREE.LinearFilter;
    textures.push(texture);
   }
  }
  let view={mission,selected,focus,route,hostilePositions,hostileHealth,shot};
  let shotMotion:{from:THREE.Vector3;to:THREE.Vector3;started:number}|null=null;
  let fireMotion:{officer:SquadId;started:number}|null=null;
  const motions=new Map<HostileId,SpriteMotion>();
  const squadMotions=new Map<SquadId,SquadMotion>();
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inViewport=true;
  let frameRequest=0;
  const showFrame=(visual:HostileVisual,clip:'idle'|'walk',frame:number)=>{
   const texture=(clip==='walk'?visual.walk:null)??visual.idle;
   if(!texture)return;
   if(visual.sprite.material.map!==texture){
    visual.sprite.material.map=texture;visual.sprite.material.needsUpdate=true;
   }
   const uv=walkFrameUv(frame);
   texture.offset.set(uv.x,uv.y);
  };
  const sync=()=>{
   const b=element.getBoundingClientRect();
   if(b.width<=0||b.height<=0)return;
   const [col,row]=view.selected.split(':').map(Number);
   const center=atCell(view.selected,scenario.size);
   highlight.position.set(center.x,.28,center.z);
   camera=view.focus
    ?createIsoDetailCamera(b.width/b.height,{col,row},1.75,scenario.size)
    :createIsoCamera(b.width/b.height,scenario.size,3.18);
   for(const unit of officers){
    const p=atCell(view.mission.locations[unit.id],scenario.size);
    const actor=squad.get(unit.id)!;
    if(!squadMotions.has(unit.id)){
     actor.sprite.position.set(p.x,.14,p.z);
     actor.fallback.position.set(p.x,.62,p.z);
    }
   }
   for(const hostile of scenario.hostiles){
    const visual=hostileVisuals.get(hostile.id)!;
    const alive=view.hostileHealth?.[hostile.id]!==0;
    visual.ground.visible=alive;visual.sprite.visible=alive;
    if(!alive)motions.delete(hostile.id);
    const p=atCell(view.hostilePositions?.[hostile.id]??hostile.cell,scenario.size);
    if(!motions.has(hostile.id)){
     visual.ground.position.set(p.x,.107,p.z);
     visual.sprite.position.set(p.x,.14,p.z);
    }
   }
   for(const [key,mesh] of routeTiles)mesh.visible=!!view.route?.includes(key)&&view.route.length>1;
   objectiveMaterials.get('sensor')?.color.set(view.mission.scanned?'#4d836c':'#70ddf4');
   objectiveMaterials.get('console')?.color.set(view.mission.consoleOnline?'#6ca180':'#ffd283');
   objectiveMaterials.get('survivor')?.color.set(view.mission.rescued?'#6ca180':'#f8a5ae');
   objectiveMaterials.get('extraction')?.color.set(view.mission.completed?'#f4dc93':'#98eba2');
   render();
  };
  const animate=(now:number)=>{
   frameRequest=0;
   if(disposed)return;
   if(reduceMotion||document.hidden){
    motions.clear();squadMotions.clear();shotMotion=null;
    if(fireMotion){
     const actor=squad.get(fireMotion.officer)!;
     if(actor.idle){actor.sprite.material.map=actor.idle;actor.sprite.material.needsUpdate=true;}
     fireMotion=null;
    }
    delete canvas.dataset.fireUnit;delete canvas.dataset.fireFrame;
    projectile.visible=false;shotBeam.visible=false;muzzleFlash.visible=false;impactFlash.visible=false;
    sync();return;
   }
   for(const [id,motion] of motions){
    const visual=hostileVisuals.get(id)!;
    const step=hostileStepAt(now-motion.started);
    const x=THREE.MathUtils.lerp(motion.from.x,motion.to.x,step.progress);
    const z=THREE.MathUtils.lerp(motion.from.z,motion.to.z,step.progress);
    visual.sprite.position.set(x,.14,z);
    visual.ground.position.set(x,.107,z);
    if(step.done){
     motions.delete(id);
     showFrame(visual,'idle',0);
    }else showFrame(visual,'walk',step.frame);
    canvas.dataset.hostileWalkFrame=String(step.frame);
   }
   canvas.dataset.hostileMoving=String(motions.size);
   for(const [id,motion] of squadMotions){
    const visual=squad.get(id)!;
    // A five-cell command may turn several corners: interpolate each validated
    // orthogonal BFS segment instead of cutting diagonally through scenery.
    const step=officerRouteStepAt(motion.path,now-motion.started);
    const from=atCell(step.from,scenario.size),to=atCell(step.to,scenario.size);
    const x=THREE.MathUtils.lerp(from.x,to.x,step.progress);
    const z=THREE.MathUtils.lerp(from.z,to.z,step.progress);
    visual.sprite.position.set(x,.14,z);visual.fallback.position.set(x,.62,z);
    canvas.dataset.squadRouteStep=String(step.segment);
    canvas.dataset.squadRouteFrom=step.from;
    canvas.dataset.squadRouteTo=step.to;
    if(visual.walk){
     if(visual.sprite.material.map!==visual.walk){visual.sprite.material.map=visual.walk;visual.sprite.material.needsUpdate=true;}
     visual.walk.offset.set(walkFrameUv(step.frame).x,walkFrameUv(step.frame).y);
    }
    if(step.done){
     squadMotions.delete(id);
     if(visual.idle){visual.sprite.material.map=visual.idle;visual.sprite.material.needsUpdate=true;}
    }
    canvas.dataset.squadWalkFrame=String(step.frame);
   }
   canvas.dataset.squadMoving=String(squadMotions.size);
   if(fireMotion){
    const actor=squad.get(fireMotion.officer)!;
    const frame=isoFireFrame(now-fireMotion.started);
    if(frame===null){
     if(actor.idle){actor.sprite.material.map=actor.idle;actor.sprite.material.needsUpdate=true;}
     fireMotion=null;
     delete canvas.dataset.fireUnit;delete canvas.dataset.fireFrame;
    }else if(actor.fire){
     if(actor.sprite.material.map!==actor.fire){
      actor.sprite.material.map=actor.fire;actor.sprite.material.needsUpdate=true;
     }
     const uv=walkFrameUv(frame);
     actor.fire.offset.set(uv.x,uv.y);
     canvas.dataset.fireUnit=fireMotion.officer;
     canvas.dataset.fireFrame=String(frame);
    }
   }
   if(shotMotion){
    const progress=Math.min(1,Math.max(0,(now-shotMotion.started)/SHOT_DURATION_MS));
    const traveling=progress<SHOT_TRAVEL_FRACTION;
    projectile.visible=traveling;
    shotBeam.visible=traveling;
    muzzleFlash.visible=progress<.10;
    impactFlash.visible=!traveling&&progress<1;
    projectile.position.copy(shotMotion.from).lerp(shotMotion.to,Math.min(1,progress/SHOT_TRAVEL_FRACTION));
    muzzleFlash.position.copy(shotMotion.from);
    impactFlash.position.copy(shotMotion.to);
    const impactProgress=Math.max(0,(progress-SHOT_TRAVEL_FRACTION)/(1-SHOT_TRAVEL_FRACTION));
    impactFlash.scale.setScalar(1.1+impactProgress*.8);
    (impactFlash.material as THREE.MeshBasicMaterial).opacity=.94*(1-impactProgress*.75);
    canvas.dataset.shotPhase=traveling?'travel':'impact';
    if(progress===1){
     shotMotion=null;
     projectile.visible=false;shotBeam.visible=false;muzzleFlash.visible=false;impactFlash.visible=false;
     canvas.dataset.shotPhase='idle';
    }
   }
   render();
   if(motions.size||squadMotions.size||shotMotion)frameRequest=requestAnimationFrame(animate);
  };
  runtime.current={sync:(m,s,f,r,h,hp,firing)=>{
   const newShot=!!firing&&firing.id!==view.shot?.id;
   const previous=view.hostilePositions;
   const previousMission=view.mission;
   // Training -> encounter and F5 restore are instantaneous: only a real
   // subsequent change in replayed cells can start a visual walk.
   if(!reduceMotion&&!document.hidden&&previous&&h){
    for(const hostile of scenario.hostiles){
     if(previous[hostile.id]===h[hostile.id]||hp?.[hostile.id]===0)continue;
     const from=atCell(previous[hostile.id],scenario.size);
     const to=atCell(h[hostile.id],scenario.size);
     motions.set(hostile.id,{from:new THREE.Vector3(from.x,.14,from.z),
      to:new THREE.Vector3(to.x,.14,to.z),started:performance.now()});
    }
   }else motions.clear();
   if(!reduceMotion&&!document.hidden&&previousMission){
    const occupiedHostiles=previous
     ?Object.entries(previous).filter(([id])=>view.hostileHealth?.[id as HostileId]!==0).map(([,cell])=>cell)
     :[];
    for(const unit of officers){
     const fromCell=previousMission.locations[unit.id],toCell=m.locations[unit.id];
     if(fromCell===toCell)continue;
     const path=missionPath(previousMission,unit.id,toCell,occupiedHostiles);
     // Never invent a straight-line shortcut when a replay/legacy position
     // cannot be reconstructed: the authoritative destination still renders.
     if(!path||path.length<2)continue;
     const from=atCell(fromCell,scenario.size),to=atCell(toCell,scenario.size);
     squadMotions.set(unit.id,{from:new THREE.Vector3(from.x,.14,from.z),to:new THREE.Vector3(to.x,.14,to.z),started:performance.now(),path});
     canvas.dataset.squadRouteLength=String(path.length-1);
    }
   }else squadMotions.clear();
   view={mission:m,selected:s,focus:f,route:r,hostilePositions:h,hostileHealth:hp,shot:firing};
   if(!firing&&shotMotion){
    shotMotion=null;projectile.visible=false;shotBeam.visible=false;muzzleFlash.visible=false;impactFlash.visible=false;
    if(fireMotion){
     const actor=squad.get(fireMotion.officer)!;
     if(actor.idle){actor.sprite.material.map=actor.idle;actor.sprite.material.needsUpdate=true;}
     fireMotion=null;
    }
    delete canvas.dataset.fireUnit;delete canvas.dataset.fireFrame;
    canvas.dataset.shotPhase='idle';
   }
   if(newShot){
    // Coordinates come from the accepted action's actual combat participants,
    // not the selected tile or a guessed hit. This effect is never replayed on F5.
    canvas.dataset.shotSequence=String(firing.id);
    canvas.dataset.shotFrom=firing.from;
    canvas.dataset.shotTo=firing.to;
    if(!reduceMotion&&!document.hidden){
     fireMotion={officer:firing.officer,started:performance.now()};
     const from=atCell(firing.from,scenario.size),to=atCell(firing.to,scenario.size);
     shotMotion={from:new THREE.Vector3(from.x,.92,from.z),
      to:new THREE.Vector3(to.x,1.03,to.z),started:performance.now()};
     const beamVector=shotMotion.to.clone().sub(shotMotion.from);
     shotBeam.position.copy(shotMotion.from).add(shotMotion.to).multiplyScalar(.5);
     shotBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),beamVector.clone().normalize());
     shotBeam.scale.y=beamVector.length();
     shotBeam.visible=true;
     muzzleFlash.position.copy(shotMotion.from);muzzleFlash.visible=true;
     canvas.dataset.shotPhase='travel';
    }else{
     canvas.dataset.shotPhase='reduced';
    }
   }
   sync();
   if((motions.size||squadMotions.size||shotMotion)&&!frameRequest)frameRequest=requestAnimationFrame(animate);
  }};
  const idleTimer=window.setInterval(()=>{
   if(disposed||document.hidden||!inViewport||reduceMotion)return;
   const now=performance.now();
   let changed=false;
   scenario.hostiles.forEach((hostile,index)=>{
    if(motions.has(hostile.id)||view.hostileHealth?.[hostile.id]===0)return;
    const frame=hostileIdleFrameAt(now,index*2);
    showFrame(hostileVisuals.get(hostile.id)!,'idle',frame);
    canvas.dataset.hostileIdleFrame=String(frame);
    changed=true;
   });
   if(changed)render();
  },HOSTILE_IDLE_FRAME_MS);
  const viewportObserver=new IntersectionObserver(entries=>{
   inViewport=entries[0]?.isIntersecting??true;
  });
  viewportObserver.observe(element);
  const resize=()=>{
   const b=element.getBoundingClientRect();
   if(b.width<=0||b.height<=0)return;
   renderer.setSize(b.width,b.height,false);
   sync();
  };
  const observer=new ResizeObserver(resize);
  observer.observe(element);
  let down:{id:number;x:number;y:number}|null=null;
  const onDown=(event:PointerEvent)=>{down={id:event.pointerId,x:event.clientX,y:event.clientY};};
  const onCancel=()=>{down=null;};
  const onUp=(event:PointerEvent)=>{
   if(!down||event.pointerId!==down.id)return;
   const drag=Math.hypot(event.clientX-down.x,event.clientY-down.y);
   down=null;
   if(drag>8)return;
   const picked=pickCell(event.clientX,event.clientY,camera,canvas.getBoundingClientRect(),scenario.size);
   if(picked)onPickRef.current(picked.id);
  };
  canvas.addEventListener('pointerdown',onDown);
  canvas.addEventListener('pointerup',onUp);
  canvas.addEventListener('pointercancel',onCancel);
  resize();
  return ()=>{
   disposed=true;observer.disconnect();viewportObserver.disconnect();
   window.clearInterval(idleTimer);
   if(frameRequest)cancelAnimationFrame(frameRequest);
   canvas.removeEventListener('pointerdown',onDown);
   canvas.removeEventListener('pointerup',onUp);
   canvas.removeEventListener('pointercancel',onCancel);
   runtime.current=null;
   scene.traverse(object=>{
    const item=object as THREE.Mesh;
    item.geometry?.dispose();
    if(item.material){
     for(const material of Array.isArray(item.material)?item.material:[item.material])
      material.dispose();
    }
   });
   textures.forEach(texture=>texture.dispose());
   renderer.dispose();canvas.remove();
  };
 },[scenario.id]);
 useEffect(()=>{runtime.current?.sync(mission,selected,focus,route,hostilePositions,hostileHealth,shot);},[mission,selected,focus,routeId,hostilePositions,hostileHealth,shot]);
 return <div className="scenario-viewport" ref={host} data-testid="scenario-viewport">
  {error&&<p role="status" data-testid="scenario-webgl-fallback">{error}</p>}
 </div>;
}
