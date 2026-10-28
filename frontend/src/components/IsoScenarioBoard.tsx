import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import assets from '../assets/r2-assets-manifest.json';
import { cells, cellCenter, pickCell } from '../tacticalGrid';
import { createIsoCamera } from '../tacticalIsoCamera';
import { createIsoDetailCamera } from '../tacticalIsoFocus';
import { HIT_ATLAS, WALK_ATLAS, walkFrameUv } from '../tacticalAnimation';
import { HOSTILE_IDLE_FRAME_MS, hostileIdleFrameAt, hostileRouteStepAt, joinHostileRoutes } from '../isoHostileAnimation';
import { joinOfficerRoutes, officerRouteStepAt } from '../isoOfficerAnimation';
import { isoFireFrame, isoHitReactionAt, SHOT_DURATION_MS, SHOT_TRAVEL_FRACTION } from '../isoFirePlayback';
import { headingFromCells, isoSpriteSideFromCells, mirroredAtlasUv } from '../isoActorFacing';
import { missionPath, type MissionState, type Scenario, type SquadId } from '../isoScenarioCampaign';
import type { HostileId } from '../isoScenarioHostileTurn';

type ShotVisual = Readonly<{ id:number; from:string; to:string; officer:SquadId }>;
type OfficerHitVisual = Readonly<{ id:number; officers:readonly SquadId[] }>;
type AimPreview = Readonly<{
  from:string; to:string; allowed:boolean; blocker:string|null; reason:string;
}> | null;
// Fast tracer and readable impact share a single timing contract with audio.
// Six authored hit poses need enough screen time to read at whole-board zoom.
const OFFICER_HIT_FRAME_MS=200;
type BoardProps = {
  scenario: Scenario; mission: MissionState; selected: string; focus: boolean;
  route: readonly string[] | null; hostilePositions?: Readonly<Record<HostileId,string>>;
  hostileHealth?: Readonly<Record<HostileId,number>>;
  shot?: ShotVisual | null;
  officerHit?: OfficerHitVisual | null;
  aimPreview?: AimPreview;
  onPick: (cell: string) => void;
};
type BoardRuntime = { sync: (m:MissionState,s:string,f:boolean,r:readonly string[]|null,h?:Readonly<Record<HostileId,string>>,hp?:Readonly<Record<HostileId,number>>,shot?:ShotVisual|null,officerHit?:OfficerHitVisual|null,aimPreview?:AimPreview)=>void };
type HostileMotion = {path:readonly string[];started:number|null};
type SquadMotion = {from:THREE.Vector3;to:THREE.Vector3;path:readonly string[];started:number|null};
const officers = [
  {id:'science' as const,sex:'female',color:'#9ad9e9'},
  {id:'security' as const,sex:'male',color:'#e7c47d'},
  {id:'medic' as const,sex:'female',color:'#acd6a2'},
] as const;
const atCell=(id:string,size:Scenario['size'])=>{
  const [col,row]=id.split(':').map(Number);
  return cellCenter({col,row},size);
};

export function IsoScenarioBoard({scenario,mission,selected,focus,route,hostilePositions,hostileHealth,shot,officerHit,aimPreview,onPick}:BoardProps){
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
  // A small world-space arrow indicates actual last observed facing. The
  // authored sprites remain camera-facing: this is NOT a directional atlas.
  // Picking uses the independent ground plane, never these visual meshes.
  const createFacing=(color:string)=>{
   const marker=add(new THREE.Mesh(new THREE.ConeGeometry(.18,.38,3),
    new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false})));
   marker.renderOrder=90;marker.visible=false;
   return marker;
  };
  const placeFacing=(marker:THREE.Mesh,x:number,z:number,from?:string,to?:string,id?:string)=>{
   const angle=from!==undefined&&to!==undefined?headingFromCells(from,to):null;
   if(angle!==null){
    marker.userData.heading=angle;marker.visible=true;
    if(id)canvas.dataset[`facing${id[0].toUpperCase()+id.slice(1)}`]=String(angle);
   }
   if(!marker.visible)return;
   const direction=marker.userData.heading as number;
   marker.rotation.set(Math.PI/2,direction,0,'YXZ');
   marker.position.set(x+Math.sin(direction)*.34,.23,z+Math.cos(direction)*.34);
  };
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
  // Original, deterministic relay-outpost dressing: structural wall ribs,
  // industrial cover and readable mission props. Only authored solid/objective
  // cells carry tall scenery; walkable routes, LOS and picking remain unchanged.
  // Meshes live exclusively in the visual scene (pickCell uses its own grid).
  if(scenario.id==='relay'){
   const steel=new THREE.MeshStandardMaterial({color:'#354e5d',metalness:.58,roughness:.47});
   const panel=new THREE.MeshStandardMaterial({color:'#486779',metalness:.46,roughness:.55});
   const darkSteel=new THREE.MeshStandardMaterial({color:'#1a303d',metalness:.57,roughness:.44});
   const warning=new THREE.MeshBasicMaterial({color:'#d8ac62'});
   const cyan=new THREE.MeshBasicMaterial({color:'#7fdbe4'});
   const green=new THREE.MeshBasicMaterial({color:'#a3f1b5'});
   const block=(p:THREE.Vector3,w:number,h:number,d:number,mat:THREE.Material)=>{
    const mesh=add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat));
    mesh.position.copy(p);return mesh;
   };
   for(const cell of scenario.walls){
    const p=atCell(cell,scenario.size);
    // The authored col-4 wall now reads as one defended relay bulkhead.
    block(new THREE.Vector3(p.x,1.19,p.z),.99,.10,.99,darkSteel);
    block(new THREE.Vector3(p.x-.494,.71,p.z),.028,.56,.70,panel);
    block(new THREE.Vector3(p.x-.515,.92,p.z),.014,.065,.27,cyan);
    for(const dz of [-.41,.41])
     block(new THREE.Vector3(p.x-.43,.67,p.z+dz),.14,.94,.13,steel);
    const [col,row]=cell.split(':').map(Number);
    const walkway=`${col-1}:${row}`;
    if(!scenario.cover.includes(walkway)){
     const q=atCell(walkway,scenario.size);
     block(new THREE.Vector3(q.x+.39,.079,q.z),.09,.015,.80,warning);
    }
   }
   // Relay identity at whole-board zoom: one continuous illuminated service
   // gantry and a compact radio array on existing wall cells. These silhouettes
   // sit above impassable terrain; they never create fake obstacles or hitboxes.
   const gantry=atCell('4:3',scenario.size);
   block(new THREE.Vector3(gantry.x,1.44,gantry.z),.65,.17,6.66,steel);
   for(const side of [-.25,.25])
    block(new THREE.Vector3(gantry.x+side,1.545,gantry.z),.025,.035,6.40,cyan);
   const relayMast=add(new THREE.Mesh(new THREE.CylinderGeometry(.055,.095,1.12,10),darkSteel));
   relayMast.position.set(gantry.x,2.05,gantry.z);
   block(new THREE.Vector3(gantry.x,2.48,gantry.z),1.12,.075,.11,steel);
   for(const side of [-.43,.43]){
    block(new THREE.Vector3(gantry.x+side,2.47,gantry.z),.22,.32,.06,panel);
    block(new THREE.Vector3(gantry.x+side,2.48,gantry.z+.039),.12,.19,.015,cyan);
   }
   for(const row of [0,6]){
    const end=atCell(`4:${row}`,scenario.size);
    block(new THREE.Vector3(end.x,1.39,end.z),.83,.18,.18,warning);
   }
   for(const cell of scenario.cover){
    const p=atCell(cell,scenario.size);
    // A waist-high crate remains exactly the same logical cover cell.
    block(new THREE.Vector3(p.x,.505,p.z),.77,.13,.77,darkSteel);
    block(new THREE.Vector3(p.x,.578,p.z),.10,.026,.80,steel);
    block(new THREE.Vector3(p.x,.578,p.z),.80,.026,.10,steel);
    block(new THREE.Vector3(p.x,p.y+.22,p.z+.488),.45,.055,.018,warning);
   }
   const sensor=atCell(scenario.sensor,scenario.size);
   block(new THREE.Vector3(sensor.x,.31,sensor.z),.45,.40,.45,steel);
   const mast=add(new THREE.Mesh(new THREE.CylinderGeometry(.035,.06,.68,8),steel));
   mast.position.set(sensor.x,.72,sensor.z);
   const dish=add(new THREE.Mesh(new THREE.ConeGeometry(.27,.14,12),panel));
   dish.rotation.z=Math.PI/2.6;
   dish.position.set(sensor.x,.99,sensor.z);
   block(new THREE.Vector3(sensor.x,.99,sensor.z),.07,.07,.07,cyan);
   if(scenario.console){
    const terminal=atCell(scenario.console,scenario.size);
    block(new THREE.Vector3(terminal.x,.65,terminal.z+.22),.48,.32,.065,darkSteel);
    block(new THREE.Vector3(terminal.x,.66,terminal.z+.263),.35,.19,.015,cyan);
    block(new THREE.Vector3(terminal.x,.48,terminal.z-.13),.15,.16,.19,steel);
   }
   const extraction=atCell(scenario.extraction,scenario.size);
   for(const dx of [-.34,.34])for(const dz of [-.34,.34]){
    block(new THREE.Vector3(extraction.x+dx,.17,extraction.z+dz),.12,.22,.12,darkSteel);
    block(new THREE.Vector3(extraction.x+dx,.29,extraction.z+dz),.10,.05,.10,green);
   }
   for(const cell of ['8:9','9:8']){
    const p=atCell(cell,scenario.size);
    for(const delta of [-.22,.22])
     block(new THREE.Vector3(p.x+delta,.079,p.z),.07,.015,.65,warning);
   }
  }
  // The 12x12 derelict is a navigable, damaged installation rather than a
  // uniformly tiled training board. All tall dressing is anchored to authored
  // wall, cover or objective cells; floor markings stay flush with walkable
  // tiles. Gameplay obstacles and the independent picking plane are unchanged.
  if(scenario.id==='derelict'){
   const hull=new THREE.MeshStandardMaterial({color:'#34475b',metalness:.62,roughness:.49});
   const frame=new THREE.MeshStandardMaterial({color:'#8396a3',metalness:.7,roughness:.4});
   const rust=new THREE.MeshStandardMaterial({color:'#9a6853',metalness:.32,roughness:.77});
   const dark=new THREE.MeshStandardMaterial({color:'#1c2b3b',metalness:.53,roughness:.5});
   const emergency=new THREE.MeshBasicMaterial({color:'#ed9778'});
   const signal=new THREE.MeshBasicMaterial({color:'#8ee5de'});
   const safe=new THREE.MeshBasicMaterial({color:'#a7e8ad'});
   const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{
    const mesh=add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat));
    mesh.position.set(x,y,z);return mesh;
   };
   // Broken pressure bulkheads: capped wall sections, exposed ribs and
   // occasional emergency panels. The two intentional corridor gaps remain
   // open, so neither route finding nor line of sight is falsified by art.
   scenario.walls.forEach((cell,index)=>{
    const p=atCell(cell,scenario.size);
    box(p.x,1.19,p.z,.94,.11,.94,frame);
    box(p.x-.40,.88,p.z,.10,.48,.82,index%3===0?rust:hull);
    box(p.x+.39,.89,p.z,.09,.47,.82,hull);
    box(p.x,1.31,p.z,.72,.10,.12,dark);
    if(index%3===0){
     box(p.x,.93,p.z+.483,.36,.15,.018,emergency);
     box(p.x,.69,p.z+.483,.47,.06,.018,dark);
    }
   });
   // Service crates occupy only the seven authored cover cells. Distinct
   // heights and warm damage accents distinguish useful tactical cover.
   scenario.cover.forEach((cell,index)=>{
    const p=atCell(cell,scenario.size);
    box(p.x,.66,p.z,.73,.33,.71,index%2?rust:hull);
    box(p.x,.85,p.z,.77,.055,.75,frame);
    box(p.x,p.y+.63,p.z+.364,.48,.06,.022,index%2?emergency:signal);
   });
   // Subtle, flush floor guidance suggests an abandoned service corridor;
   // these are markings, never collision objects or fake obstacles.
   for(const cell of ['3:5','4:5','5:5','6:5','7:5','9:5']){
    const p=atCell(cell,scenario.size);
    box(p.x,.074,p.z-.39,.62,.014,.04,frame);
    box(p.x,.075,p.z+.39,.62,.014,.04,dark);
   }
   // Actual science, console, rescue and extraction cells have recognisable
   // silhouettes. Existing gameplay markers remain visible above the floor.
   const sensor=atCell(scenario.sensor,scenario.size);
   box(sensor.x,.19,sensor.z,.58,.22,.58,hull);
   const antenna=add(new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,.72,8),frame));
   antenna.position.set(sensor.x,.64,sensor.z);
   box(sensor.x,.97,sensor.z,.61,.09,.08,signal);
   if(scenario.console){
    const terminal=atCell(scenario.console,scenario.size);
    box(terminal.x,.25,terminal.z+.20,.65,.33,.26,hull);
    box(terminal.x,.66,terminal.z+.30,.58,.49,.08,dark);
    box(terminal.x,.69,terminal.z+.347,.43,.30,.018,signal);
   }
   if(scenario.survivor){
    const rescue=atCell(scenario.survivor,scenario.size);
    // A low medical cot keeps the actual survivor marker unobstructed.
    box(rescue.x,.14,rescue.z,.70,.13,.79,hull);
    for(const dx of [-.31,.31])
     box(rescue.x+dx,.25,rescue.z,.045,.18,.79,frame);
    box(rescue.x,.115,rescue.z-.32,.44,.018,.07,emergency);
   }
   const landing=atCell(scenario.extraction,scenario.size);
   for(const dx of [-.35,.35])for(const dz of [-.35,.35]){
    box(landing.x+dx,.22,landing.z+dz,.09,.30,.09,dark);
    box(landing.x+dx,.39,landing.z+dz,.10,.06,.10,safe);
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
  // Live aim preview: a target halo and dashed line ending at the FIRST
  // authoritative obstruction, never an invented projectile or hit chance.
  // The ray, rings and cover marker are decorative and cannot steal picks.
  const targetRing=add(new THREE.Mesh(new THREE.RingGeometry(.46,.61,40),
   new THREE.MeshBasicMaterial({color:'#a4f2ca',side:THREE.DoubleSide,depthTest:false,depthWrite:false})));
  targetRing.rotation.x=-Math.PI/2;targetRing.renderOrder=82;targetRing.visible=false;
  const obstructionRing=add(new THREE.Mesh(new THREE.RingGeometry(.30,.44,32),
   new THREE.MeshBasicMaterial({color:'#ff9474',side:THREE.DoubleSide,depthTest:false,depthWrite:false})));
  obstructionRing.rotation.x=-Math.PI/2;obstructionRing.renderOrder=83;obstructionRing.visible=false;
  const aimLine=add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
   new THREE.Vector3(0,.34,0),new THREE.Vector3(0,.34,0)]),
   new THREE.LineDashedMaterial({color:'#a4f2ca',dashSize:.23,gapSize:.15,
    depthTest:false,depthWrite:false})));
  aimLine.renderOrder=81;aimLine.visible=false;
  canvas.dataset.aimState='none';
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
  const impactFlash=add(new THREE.Mesh(new THREE.SphereGeometry(.52,12,8),
   new THREE.MeshBasicMaterial({color:'#ffd39a',transparent:true,opacity:.96,depthTest:false,depthWrite:false})));
  for(const mesh of [projectile,shotBeam,muzzleFlash,impactFlash]){
   mesh.visible=false;
   mesh.renderOrder=95;
  }
  canvas.dataset.shotPhase='idle';
  canvas.dataset.hitPhase='idle';
  const squad=new Map<SquadId,{sprite:THREE.Sprite;fallback:THREE.Mesh;facing:THREE.Mesh;hitRing:THREE.Mesh;idle:THREE.Texture|null;walk:THREE.Texture|null;fire:THREE.Texture|null;hit:THREE.Texture|null}>();
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
   const facing=createFacing(officer.color);
   // Ground-level impact warning survives a missing R2 atlas.
   const hitRing=add(new THREE.Mesh(new THREE.RingGeometry(.44,.65,28),
    new THREE.MeshBasicMaterial({color:'#ffb080',transparent:true,opacity:.9,
     side:THREE.DoubleSide,depthTest:false,depthWrite:false})));
   hitRing.rotation.x=-Math.PI/2;
   hitRing.position.set(position.x,.22,position.z);
   hitRing.renderOrder=91;
   hitRing.visible=false;
   squad.set(officer.id,{sprite,fallback,facing,hitRing,idle:null,walk:null,fire:null,hit:null});
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
     // Independent UVs: changing this officer must not mirror the other two.
     const isolated=texture.clone();isolated.needsUpdate=true;
     visual.idle=isolated;textures.push(isolated);
     visual.sprite.material.map=isolated;
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
   const hitKey=sex==='female'?'starAdventures.tactical.officerFemaleHitV1'
     :'starAdventures.tactical.officerMaleHitV1';
   const hit=loader.load(assets.assets[hitKey].url,loaded=>{
    if(disposed)return;
    for(const officer of officers.filter(unit=>unit.sex===sex)){
     const visual=squad.get(officer.id)!;
     const isolated=loaded.clone();
     isolated.repeat.set(1/HIT_ATLAS.columns,1/HIT_ATLAS.rows);
     const uv=walkFrameUv(0);
     isolated.offset.set(uv.x,uv.y);
     isolated.magFilter=THREE.LinearFilter;
     isolated.needsUpdate=true;
     visual.hit=isolated;textures.push(isolated);
    }
    canvas.dataset.officerHitAtlasesReady=String([...squad.values()].filter(visual=>visual.hit).length);
    render();
   },undefined,()=>{if(!disposed)render();});
   hit.colorSpace=THREE.SRGBColorSpace;hit.magFilter=THREE.LinearFilter;
   textures.push(hit);
  }
  // The v1 training view keeps authored contact cells. Opt-in v2 encounters
  // supply replayed hostile positions; Three.js never owns simulation state.
  const hostileAssets={
   // Contacts must read as threats at the whole-board lens, not as extra crew.
   aegis:{key:'starAdventures.tactical.aegisRaiderIdleV1',scale:[2.02,3.04] as const,color:'#e4946f'},
   veil:{key:'starAdventures.tactical.veilAgentIdleV1',scale:[1.74,2.68] as const,color:'#b59be8'},
  } as const;
  type HostileVisual={ground:THREE.Mesh;sprite:THREE.Sprite;facing:THREE.Mesh;idle:THREE.Texture|null;walk:THREE.Texture|null};
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
   const facing=createFacing(asset.color);
   const visual:HostileVisual={ground,sprite,facing,idle:null,walk:null};
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
  let view={mission,selected,focus,route,hostilePositions,hostileHealth,shot,officerHit,aimPreview};
  let shotMotion:{from:THREE.Vector3;to:THREE.Vector3;toCell:string;started:number;target:HostileId|null;lethal:boolean}|null=null;
  const resetHit=()=>{
   if(shotMotion?.target){
    const victim=hostileVisuals.get(shotMotion.target)!;
    victim.sprite.material.color.set('#ffffff');
    victim.sprite.material.opacity=1;
    const p=atCell(view.hostilePositions?.[shotMotion.target]??shotMotion.toCell,scenario.size);
    victim.sprite.position.set(p.x,.14,p.z);
    const alive=view.hostileHealth?.[shotMotion.target]!==0;
    victim.sprite.visible=alive;victim.ground.visible=alive;
   }
   canvas.dataset.hitPhase='idle';
   delete canvas.dataset.hitTarget;
  };
  let fireMotion:{officer:SquadId;started:number}|null=null;
  let officerHitMotion:{officers:readonly SquadId[];started:number}|null=null;
  const resetOfficerHit=()=>{
   if(!officerHitMotion)return;
   for(const id of officerHitMotion.officers){
    const actor=squad.get(id)!;
    actor.hitRing.visible=false;
    actor.hitRing.scale.setScalar(1);
    if(actor.idle){actor.sprite.material.map=actor.idle;actor.sprite.material.needsUpdate=true;}
   }
   officerHitMotion=null;
   delete canvas.dataset.squadHitUnits;
   delete canvas.dataset.squadHitFrame;
  };
  const motions=new Map<HostileId,HostileMotion>();
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
   const mirror=visual.sprite.userData.mirror===true;
   const uv=mirroredAtlasUv(frame,mirror);
   texture.repeat.set(uv.repeatX,uv.repeatY);
   texture.offset.set(uv.x,uv.y);
  };
  const sync=()=>{
   const b=element.getBoundingClientRect();
   if(b.width<=0||b.height<=0)return;
   const [col,row]=view.selected.split(':').map(Number);
   const center=atCell(view.selected,scenario.size);
   highlight.position.set(center.x,.28,center.z);
   const aim=view.aimPreview;
   targetRing.visible=!!aim;
   obstructionRing.visible=!!aim?.blocker;
   aimLine.visible=!!aim;
   if(aim){
    const target=atCell(aim.to,scenario.size);
    const origin=atCell(aim.from,scenario.size);
    const stop=atCell(aim.blocker??aim.to,scenario.size);
    const color=aim.allowed?'#a4f2ca':'#ffad7c';
    targetRing.position.set(target.x,.33,target.z);
    targetRing.material.color.set(color);
    if(aim.blocker)obstructionRing.position.set(stop.x,.35,stop.z);
    aimLine.geometry.dispose();
    aimLine.geometry=new THREE.BufferGeometry().setFromPoints([
     new THREE.Vector3(origin.x,.35,origin.z),new THREE.Vector3(stop.x,.35,stop.z)]);
    aimLine.computeLineDistances();
    (aimLine.material as THREE.LineDashedMaterial).color.set(color);
    canvas.dataset.aimState=aim.reason;
    canvas.dataset.aimTarget=aim.to;
    canvas.dataset.aimStop=aim.blocker??aim.to;
   }else{
    canvas.dataset.aimState='none';
    delete canvas.dataset.aimTarget;
    delete canvas.dataset.aimStop;
   }
   camera=view.focus
    ?createIsoDetailCamera(b.width/b.height,{col,row},1.75,scenario.size)
    :createIsoCamera(b.width/b.height,scenario.size,3.18);
   for(const unit of officers){
    const p=atCell(view.mission.locations[unit.id],scenario.size);
    const actor=squad.get(unit.id)!;
    if(!squadMotions.has(unit.id)){
     actor.sprite.position.set(p.x,.14,p.z);
     actor.fallback.position.set(p.x,.62,p.z);
     actor.hitRing.position.set(p.x,.22,p.z);
     placeFacing(actor.facing,p.x,p.z);
    }
   }
   for(const hostile of scenario.hostiles){
    const visual=hostileVisuals.get(hostile.id)!;
    // Combat HP changes immediately, but a lethal hit should not erase the
    // sprite before the visible projectile has actually reached its target.
    const alive=view.hostileHealth?.[hostile.id]!==0||shotMotion?.target===hostile.id;
    visual.ground.visible=alive;visual.sprite.visible=alive;
    visual.facing.visible=alive&&Number.isFinite(visual.facing.userData.heading);
    if(!alive)motions.delete(hostile.id);
    const p=atCell(view.hostilePositions?.[hostile.id]??hostile.cell,scenario.size);
    if(!motions.has(hostile.id)){
     visual.ground.position.set(p.x,.107,p.z);
     visual.sprite.position.set(p.x,.14,p.z);
     placeFacing(visual.facing,p.x,p.z);
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
    motions.clear();squadMotions.clear();resetHit();resetOfficerHit();shotMotion=null;
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
    // The first painted frame owns the start time, not the state update.
    // A busy browser must not skip the entire hostile walk.
    const started=motion.started??(motion.started=now);
    const step=hostileRouteStepAt(motion.path,now-started);
    const from=atCell(step.from,scenario.size),to=atCell(step.to,scenario.size);
    const x=THREE.MathUtils.lerp(from.x,to.x,step.progress);
    const z=THREE.MathUtils.lerp(from.z,to.z,step.progress);
    visual.sprite.position.set(x,.14,z);
    visual.ground.position.set(x,.107,z);
    if(!step.done){
     const side=isoSpriteSideFromCells(step.from,step.to);
     if(side!==null)visual.sprite.userData.mirror=side==='left';
     canvas.dataset[`spriteFacing${id[0].toUpperCase()+id.slice(1)}`]=visual.sprite.userData.mirror?'left':'right';
    }
    placeFacing(visual.facing,x,z,step.done?undefined:step.from,step.done?undefined:step.to,id);
    canvas.dataset.hostileRouteFrom=step.from;
    canvas.dataset.hostileRouteTo=step.to;
    canvas.dataset.hostileRouteSegment=String(step.segment);
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
    // Start at the first actual animation frame: a delayed rAF must not
    // skip the whole 320ms tile traversal and visually teleport the officer.
    const started=motion.started??(motion.started=now);
    const step=officerRouteStepAt(motion.path,now-started);
    const from=atCell(step.from,scenario.size),to=atCell(step.to,scenario.size);
    const x=THREE.MathUtils.lerp(from.x,to.x,step.progress);
    const z=THREE.MathUtils.lerp(from.z,to.z,step.progress);
    visual.sprite.position.set(x,.14,z);visual.fallback.position.set(x,.62,z);
    visual.hitRing.position.set(x,.22,z);
    if(!step.done){
     const side=isoSpriteSideFromCells(step.from,step.to);
     if(side!==null)visual.sprite.userData.mirror=side==='left';
     canvas.dataset[`spriteFacing${id[0].toUpperCase()+id.slice(1)}`]=visual.sprite.userData.mirror?'left':'right';
    }
    placeFacing(visual.facing,x,z,step.done?undefined:step.from,step.done?undefined:step.to,id);
    canvas.dataset.squadRouteStep=String(step.segment);
    canvas.dataset.squadRouteFrom=step.from;
    canvas.dataset.squadRouteTo=step.to;
    if(visual.walk){
     if(visual.sprite.material.map!==visual.walk){visual.sprite.material.map=visual.walk;visual.sprite.material.needsUpdate=true;}
     const mirror=visual.sprite.userData.mirror===true;
     const uv=mirroredAtlasUv(step.frame,mirror);
     visual.walk.repeat.set(uv.repeatX,uv.repeatY);
     visual.walk.offset.set(uv.x,uv.y);
     if(visual.idle){
      visual.idle.repeat.x=mirror?-1:1;
      visual.idle.offset.x=mirror?1:0;
     }
     canvas.dataset.squadSpriteUvX=String(visual.walk.repeat.x);
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
     // The firing atlas must face the accepted target, not the last walk step.
     // These are mirrored poses of one authored view, not invented directions.
     const uv=mirroredAtlasUv(frame,actor.sprite.userData.mirror===true);
     actor.fire.repeat.x=uv.repeatX;
     actor.fire.offset.set(uv.x,uv.y);
     canvas.dataset.fireSpriteUvX=String(actor.fire.repeat.x);
     canvas.dataset.fireUnit=fireMotion.officer;
     canvas.dataset.fireFrame=String(frame);
    }
   }
   if(officerHitMotion){
    const elapsed=now-officerHitMotion.started;
    const frame=Math.floor(elapsed/OFFICER_HIT_FRAME_MS);
    if(frame>=HIT_ATLAS.frames)resetOfficerHit();
    else{
     for(const id of officerHitMotion.officers){
      const actor=squad.get(id)!;
      if(actor.hit){
       if(actor.sprite.material.map!==actor.hit){
        actor.sprite.material.map=actor.hit;actor.sprite.material.needsUpdate=true;
       }
       const uv=walkFrameUv(frame);
       actor.hit.offset.set(uv.x,uv.y);
      }
      actor.hitRing.visible=true;
      actor.hitRing.scale.setScalar(1+.2*Math.sin(Math.PI*elapsed/(HIT_ATLAS.frames*OFFICER_HIT_FRAME_MS)));
      (actor.hitRing.material as THREE.MeshBasicMaterial).opacity=.85*(1-.5*frame/HIT_ATLAS.frames);
     }
     canvas.dataset.squadHitUnits=officerHitMotion.officers.join(',');
     canvas.dataset.squadHitFrame=String(frame);
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
    if(shotMotion.target){
     const reaction=isoHitReactionAt(now-shotMotion.started,SHOT_DURATION_MS,SHOT_TRAVEL_FRACTION,shotMotion.lethal);
     canvas.dataset.hitPhase=reaction.phase;
     if(reaction.phase==='impact'){
      const victim=hostileVisuals.get(shotMotion.target)!;
      const dx=shotMotion.to.x-shotMotion.from.x,dz=shotMotion.to.z-shotMotion.from.z;
      const length=Math.hypot(dx,dz)||1;
      victim.sprite.position.set(
       shotMotion.to.x+dx/length*reaction.recoil,
       .14+reaction.recoil*.35,
       shotMotion.to.z+dz/length*reaction.recoil,
      );
      victim.sprite.material.color.setRGB(1,1-.6*reaction.flash,1-.85*reaction.flash);
      victim.sprite.material.opacity=reaction.opacity;
      victim.sprite.visible=true;victim.ground.visible=true;
     }
    }
    if(progress===1){
     resetHit();shotMotion=null;
     projectile.visible=false;shotBeam.visible=false;muzzleFlash.visible=false;impactFlash.visible=false;
     canvas.dataset.shotPhase='idle';
    }
   }
   render();
   if(motions.size||squadMotions.size||shotMotion||officerHitMotion)frameRequest=requestAnimationFrame(animate);
  };
  runtime.current={sync:(m,s,f,r,h,hp,firing,incomingHit,nextAim)=>{
   const newShot=!!firing&&firing.id!==view.shot?.id;
   const newHit=!!incomingHit&&incomingHit.id!==view.officerHit?.id;
   const previous=view.hostilePositions;
   const previousMission=view.mission;
   // Training -> encounter and F5 restore are instantaneous: only a real
   // subsequent change in replayed cells can start a visual walk.
   if(!reduceMotion&&!document.hidden&&previous&&h){
    for(const hostile of scenario.hostiles){
     if(previous[hostile.id]===h[hostile.id]||hp?.[hostile.id]===0)continue;
     const fromCell=previous[hostile.id],toCell=h[hostile.id];
     const active=motions.get(hostile.id);
     const joined=active?joinHostileRoutes(active.path,[fromCell,toCell]):null;
     if(active&&joined){
      // A new legal turn must not teleport an enemy to its prior logical
      // destination while its previous visual step is still in flight.
      motions.set(hostile.id,{...active,path:joined});
      canvas.dataset.hostileRouteLength=String(joined.length-1);
      continue;
     }
     const from=atCell(fromCell,scenario.size);
     placeFacing(hostileVisuals.get(hostile.id)!.facing,from.x,from.z,fromCell,toCell,hostile.id);
     motions.set(hostile.id,{path:[fromCell,toCell],started:null});
     canvas.dataset.hostileRouteLength='1';
    }
   }else{
    motions.clear();
    // Reduced-motion and F5-style updates still show the actual new bearing,
    // without inventing a walk animation or changing the authoritative cell.
    if(previous&&h)for(const hostile of scenario.hostiles){
     const before=previous[hostile.id],after=h[hostile.id];
     if(before===after||hp?.[hostile.id]===0)continue;
     const p=atCell(after,scenario.size);
     placeFacing(hostileVisuals.get(hostile.id)!.facing,p.x,p.z,before,after,hostile.id);
    }
   }
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
     const active=squadMotions.get(unit.id);
     const joined=active?joinOfficerRoutes(active.path,path):null;
     if(active&&joined){
      // Logical orders may arrive faster than their visual walks. Keep the
      // existing first-frame clock and route, then traverse the next corners.
      // Replacing the motion here would jump to the previous logical endpoint.
      squadMotions.set(unit.id,{...active,path:joined});
      canvas.dataset.squadRouteLength=String(joined.length-1);
      continue;
     }
     const from=atCell(fromCell,scenario.size),to=atCell(toCell,scenario.size);
     placeFacing(squad.get(unit.id)!.facing,from.x,from.z,path[0],path[1],unit.id);
     squadMotions.set(unit.id,{from:new THREE.Vector3(from.x,.14,from.z),to:new THREE.Vector3(to.x,.14,to.z),started:null,path});
     canvas.dataset.squadRouteLength=String(path.length-1);
    }
   }else{
    squadMotions.clear();
    if(previousMission)for(const unit of officers){
     const before=previousMission.locations[unit.id],after=m.locations[unit.id];
     if(before===after)continue;
     const p=atCell(after,scenario.size);
     placeFacing(squad.get(unit.id)!.facing,p.x,p.z,before,after,unit.id);
    }
   }
   view={mission:m,selected:s,focus:f,route:r,hostilePositions:h,hostileHealth:hp,shot:firing,officerHit:incomingHit,aimPreview:nextAim};
   if(!incomingHit)resetOfficerHit();
   if(newHit){
    resetOfficerHit();
    if(!reduceMotion&&!document.hidden&&incomingHit.officers.length)
     officerHitMotion={officers:incomingHit.officers,started:performance.now()};
   }
   if(!firing&&shotMotion){
    resetHit();shotMotion=null;projectile.visible=false;shotBeam.visible=false;muzzleFlash.visible=false;impactFlash.visible=false;
    if(fireMotion){
     const actor=squad.get(fireMotion.officer)!;
     if(actor.idle){actor.sprite.material.map=actor.idle;actor.sprite.material.needsUpdate=true;}
     fireMotion=null;
    }
    delete canvas.dataset.fireUnit;delete canvas.dataset.fireFrame;
    canvas.dataset.shotPhase='idle';
   }
   if(newShot){
    // A second accepted shot may arrive before the previous animation ends.
    // Restore the old victim before taking ownership of the next hit.
    if(shotMotion){resetHit();shotMotion=null;}
    // Coordinates come from the accepted action's actual combat participants,
    // not the selected tile or a guessed hit. This effect is never replayed on F5.
    canvas.dataset.shotSequence=String(firing.id);
    canvas.dataset.shotFrom=firing.from;
    canvas.dataset.shotTo=firing.to;
    const shooterCell=atCell(firing.from,scenario.size);
    const shooter=squad.get(firing.officer)!;
    const shotSide=isoSpriteSideFromCells(firing.from,firing.to);
    if(shotSide!==null){
     const mirrored=shotSide==='left';
     shooter.sprite.userData.mirror=mirrored;
     // Returning to idle after the burst must retain the same target bearing.
     if(shooter.idle){
      shooter.idle.repeat.x=mirrored?-1:1;
      shooter.idle.offset.x=mirrored?1:0;
     }
     canvas.dataset[`spriteFacing${firing.officer[0].toUpperCase()+firing.officer.slice(1)}`]=shotSide;
    }
    placeFacing(shooter.facing,shooterCell.x,shooterCell.z,firing.from,firing.to,firing.officer);
    if(!reduceMotion&&!document.hidden){
     fireMotion={officer:firing.officer,started:performance.now()};
     const from=atCell(firing.from,scenario.size),to=atCell(firing.to,scenario.size);
     const target=scenario.hostiles.find(hostile=>
      (previous?.[hostile.id]??h?.[hostile.id]??hostile.cell)===firing.to);
     shotMotion={from:new THREE.Vector3(from.x,.92,from.z),
      to:new THREE.Vector3(to.x,1.03,to.z),toCell:firing.to,
      started:performance.now(),target:target?.id??null,
      lethal:!!target&&hp?.[target.id]===0};
     canvas.dataset.hitPhase=target?'travel':'idle';
     if(target)canvas.dataset.hitTarget=target.id;
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
   if((motions.size||squadMotions.size||shotMotion||officerHitMotion)&&!frameRequest)frameRequest=requestAnimationFrame(animate);
  }};
  const idleTimer=window.setInterval(()=>{
   if(disposed||document.hidden||!inViewport||reduceMotion)return;
   const now=performance.now();
   let changed=false;
   scenario.hostiles.forEach((hostile,index)=>{
    if(motions.has(hostile.id)||shotMotion?.target===hostile.id||view.hostileHealth?.[hostile.id]===0)return;
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
 useEffect(()=>{runtime.current?.sync(mission,selected,focus,route,hostilePositions,hostileHealth,shot,officerHit,aimPreview);},[mission,selected,focus,routeId,hostilePositions,hostileHealth,shot,officerHit,aimPreview]);
 return <div className="scenario-viewport" ref={host} data-testid="scenario-viewport">
  {error&&<p role="status" data-testid="scenario-webgl-fallback">{error}</p>}
 </div>;
}
