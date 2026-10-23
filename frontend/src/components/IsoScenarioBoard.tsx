import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import assets from '../assets/r2-assets-manifest.json';
import { cells, cellCenter, pickCell } from '../tacticalGrid';
import { createIsoCamera } from '../tacticalIsoCamera';
import { createIsoDetailCamera } from '../tacticalIsoFocus';
import { WALK_ATLAS, walkFrameUv } from '../tacticalAnimation';
import type { MissionState, Scenario, SquadId } from '../isoScenarioCampaign';

type BoardProps = {
  scenario: Scenario; mission: MissionState; selected: string; focus: boolean;
  route: readonly string[] | null; onPick: (cell: string) => void;
};
type BoardRuntime = { sync: (m:MissionState,s:string,f:boolean,r:readonly string[]|null)=>void };
const officers = [
  {id:'science' as const,sex:'female',color:'#9ad9e9'},
  {id:'security' as const,sex:'male',color:'#e7c47d'},
  {id:'medic' as const,sex:'female',color:'#acd6a2'},
] as const;
const atCell=(id:string,size:Scenario['size'])=>{
  const [col,row]=id.split(':').map(Number);
  return cellCenter({col,row},size);
};

export function IsoScenarioBoard({scenario,mission,selected,focus,route,onPick}:BoardProps){
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
  const squad=new Map<SquadId,{sprite:THREE.Sprite;fallback:THREE.Mesh}>();
  const textures:THREE.Texture[]=[];
  const loader=new THREE.TextureLoader();
  let disposed=false;
  const render=()=>{if(!disposed)renderer.render(scene,camera);};
  let camera=createIsoCamera(1,scenario.size);
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
   squad.set(officer.id,{sprite,fallback});
  }
  for(const sex of ['female','male'] as const){
   const key=sex==='female'?'starAdventures.tactical.officerFemaleWalkV1'
     :'starAdventures.tactical.officerMaleWalkV1';
   const texture=loader.load(assets.assets[key].url,()=>{
    if(disposed)return;
    for(const officer of officers.filter(unit=>unit.sex===sex)){
     const visual=squad.get(officer.id)!;
     visual.sprite.material.map=texture;
     visual.sprite.material.needsUpdate=true;
     visual.sprite.visible=true;
     visual.fallback.visible=false;
    }
    render();
   },undefined,()=>{if(!disposed)render();});
   texture.colorSpace=THREE.SRGBColorSpace;
   texture.repeat.set(1/WALK_ATLAS.columns,1/WALK_ATLAS.rows);
   const uv=walkFrameUv(0);
   texture.offset.set(uv.x,uv.y);
   texture.magFilter=THREE.LinearFilter;
   textures.push(texture);
  }
  let view={mission,selected,focus,route};
  const sync=()=>{
   const b=element.getBoundingClientRect();
   if(b.width<=0||b.height<=0)return;
   const [col,row]=view.selected.split(':').map(Number);
   const center=atCell(view.selected,scenario.size);
   highlight.position.set(center.x,.28,center.z);
   camera=view.focus
    ?createIsoDetailCamera(b.width/b.height,{col,row},1.75,scenario.size)
    :createIsoCamera(b.width/b.height,scenario.size);
   for(const unit of officers){
    const p=atCell(view.mission.locations[unit.id],scenario.size);
    const actor=squad.get(unit.id)!;
    actor.sprite.position.set(p.x,.14,p.z);
    actor.fallback.position.set(p.x,.62,p.z);
   }
   for(const [key,mesh] of routeTiles)mesh.visible=!!view.route?.includes(key)&&view.route.length>1;
   objectiveMaterials.get('sensor')?.color.set(view.mission.scanned?'#4d836c':'#70ddf4');
   objectiveMaterials.get('console')?.color.set(view.mission.consoleOnline?'#6ca180':'#ffd283');
   objectiveMaterials.get('survivor')?.color.set(view.mission.rescued?'#6ca180':'#f8a5ae');
   objectiveMaterials.get('extraction')?.color.set(view.mission.completed?'#f4dc93':'#98eba2');
   render();
  };
  runtime.current={sync:(m,s,f,r)=>{view={mission:m,selected:s,focus:f,route:r};sync();}};
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
   disposed=true;observer.disconnect();
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
 useEffect(()=>{runtime.current?.sync(mission,selected,focus,route);},[mission,selected,focus,routeId]);
 return <div className="scenario-viewport" ref={host} data-testid="scenario-viewport">
  {error&&<p role="status" data-testid="scenario-webgl-fallback">{error}</p>}
 </div>;
}
