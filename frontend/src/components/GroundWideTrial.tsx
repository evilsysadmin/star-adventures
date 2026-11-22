import {useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import baseWorld from '../../../content/scenes/meridian.json';
import plan from '../../../content/scenes/k47-wide-plan.json';
import {composeGroundExpansion} from '../../../src/groundWideLayout.mjs';
import {startGroundSquadPositions} from '../../../src/groundSquadPositions.mjs';
import {startAwayTeam} from '../../../src/awayTeam.mjs';
import {
 startGroundRealtimeWorld,advanceGroundRealtimeWorld,orderGroundRealtimeWorld,
 orderGroundRealtimeFormation,groundRealtimeVision,
} from '../../../src/groundRealtimeWorld.mjs';
import {
 K47_WIDE_TRIAL_SAVE_KEY,serializeGroundWideTrial,restoreGroundWideCampaign,
} from '../../../src/groundWideTrialSave.mjs';
import {groundSurfaceFrame} from '../groundSurfaceFrame';
import {groundRealtimeGroupFrame} from '../../../src/groundRealtimeGroupFrame.mjs';
import {buildWideTerrainKit} from '../../../src/groundWideTerrainKit.mjs';
import {
 startWideMission,wideMissionConsequences,wideMissionOfficerInRange,
 applyWideMissionAction,WIDE_MISSION_TARGETS,
} from '../../../src/groundWideMission.mjs';
import {WideTerrainDetail,WideTerrainBarrier} from './GroundWideTerrainArt';
import {buildWideConnectedStructures} from '../../../src/groundWideStructures.mjs';
import {WideTerrainStructure,type ConnectedStructure} from './WideTerrainStructure';
import {localStorageOrNull} from '../session';
import './groundWideTrial.css';

type Point={x:number;y:number};
type Officer={id:string;name:string};
type MobileMotion={id:string;x:number;y:number;route:Point[]};
type WideState={version:number;motion:{version:number;officers:MobileMotion[]};explored:string[]};
type WideMission={
 version:1;powerRoute:'life-support'|'research'|null;
 evidence:'sealed'|'verified'|null;
 journal:Array<{code:string;officerId:string}>;
};
type Region={id:string;name:string;bounds:number[];entry:number[]};
type TerrainTile={x:number;y:number;key:string;sectorId:string;family:string;
 floor:string;edge:string;highlight:string;variant:number;grain:number;blocked:boolean};
type TerrainWall={x:number;y:number;key:string;sectorId:string;family:string;
 wall:string;variant:number};
const wideWorld=composeGroundExpansion(baseWorld,plan);
const scene=wideWorld.scenes.surface;
const sectors=plan.sectors as Region[];
const terrain=buildWideTerrainKit(scene,sectors);
const cells=terrain.tiles as TerrainTile[];
const terrainWalls=terrain.barriers as TerrainWall[];
const obstacles=new Set([...scene.walls,...scene.objects].map(p=>p.x+','+p.y));
const scenery=[...scene.scenery] as Array<{x:number;y:number;type:string}>;
const frame=groundSurfaceFrame(scene.width,scene.height);
const point=(x:number,y:number)=>({x:440+(x-y)*40,y:52+(x+y)*20});
const diamond=(x:number,y:number)=>{
 const p=point(x,y);
 return [p.x+','+(p.y-20),(p.x+40)+','+p.y,p.x+','+(p.y+20),(p.x-40)+','+p.y].join(' ');
};

export function GroundWideTrial({squad,paused=false}:{
 squad:Officer[];paused?:boolean;
}){
 const rosterKey=squad.map(o=>o.id).join('|');
 const away=useMemo(()=>({...startAwayTeam(),squad:squad.map(o=>o.id)}),[rosterKey]);
 const legacy=useMemo(()=>startGroundSquadPositions(wideWorld,
   {version:1,area:'surface',...scene.spawn,pending:null},away),[away]);
 // Single, atomic motion+mission snapshot: V1 beta saves are upgraded
 // transparently, while the canonical 18x12 sidecar is never accessed here.
 const [initial]=useState<{motion:WideState;mission:WideMission}>(()=>{
   try{
     const raw=localStorageOrNull()?.getItem(K47_WIDE_TRIAL_SAVE_KEY);
     if(raw)return restoreGroundWideCampaign(wideWorld,away,legacy,raw) as {
       motion:WideState;mission:WideMission;
     };
   }catch{/* An old/damaged prototype save resets only this prototype. */}
   return {
     motion:startGroundRealtimeWorld(wideWorld,away,legacy) as WideState,
     mission:startWideMission() as WideMission,
   };
 });
 const [state,setState]=useState<WideState>(()=>initial.motion);
 const [mission,setMission]=useState<WideMission>(()=>initial.mission);
 const missionRef=useRef(mission);
 const current=useRef(state);
 const replace=useCallback((next:WideState)=>{current.current=next;setState(next);},[]);
 const save=useCallback((snapshot:WideState,missionSnapshot:WideMission=missionRef.current)=>{
   try{
     const storage=localStorageOrNull();
     if(!storage)return false;
     storage.setItem(K47_WIDE_TRIAL_SAVE_KEY,
       serializeGroundWideTrial(wideWorld,away,legacy,snapshot,missionSnapshot));
     return true;
   }catch{return false;}
 },[away,legacy]);
 const [selected,setSelected]=useState<string[]>(()=>squad[0]?[squad[0].id]:[]);
 const [touchOrder,setTouchOrder]=useState(false);
 const [keyboardCell,setKeyboardCell]=useState<Point>(()=>({
   x:Math.round(state.motion.officers[0]?.x??scene.spawn.x),
   y:Math.round(state.motion.officers[0]?.y??scene.spawn.y),
 }));
 const [keyboardActive,setKeyboardActive]=useState(false);
 const [following,setFollowing]=useState(true);
 const [sector,setSector]=useState('landing');
 const [notice,setNotice]=useState(()=>
   state.motion.officers.some(o=>o.route.length>0)
     ? 'El equipo continúa el recorrido guardado.'
     : 'Selecciona uno o varios oficiales y marca un destino real.');
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 520px)').matches);
 const stageRef=useRef<HTMLDivElement>(null);
 const [viewport,setViewport]=useState({width:740,height:440});
 useEffect(()=>{
   const el=stageRef.current;
   if(!el)return;
   const update=()=>{const box=el.getBoundingClientRect();
     if(box.width>0&&box.height>0)setViewport(old=>
       Math.abs(old.width-box.width)<1&&Math.abs(old.height-box.height)<1
         ? old:{width:box.width,height:box.height});
   };
   update();const observer=new ResizeObserver(update);observer.observe(el);
   const media=window.matchMedia('(max-width: 520px)');
   const onMedia=()=>setCompact(media.matches);
   media.addEventListener('change',onMedia);
   return ()=>{observer.disconnect();media.removeEventListener('change',onMedia);};
 },[]);
 useEffect(()=>{
   if(paused)return;
   let raf=0,last=0,lastSaved=0;
   const step=(time:number)=>{
     raf=requestAnimationFrame(step);
     if(document.visibilityState==='hidden'){last=0;return;}
     if(!last){last=time;return;}
     if(time-last<40)return;
     const elapsed=Math.min(time-last,80);last=time;
     if(!current.current.motion.officers.some(o=>o.route.length))return;
     const next=advanceGroundRealtimeWorld(wideWorld,current.current,elapsed) as WideState;
     replace(next);
     if(time-lastSaved>250||next.motion.officers.every(o=>o.route.length===0)){
       save(next);lastSaved=time;
     }
   };
   raf=requestAnimationFrame(step);
   return ()=>cancelAnimationFrame(raf);
 },[paused,replace,save]);
 useEffect(()=>()=>save(current.current),[save]);
 const order=useCallback((x:number,y:number)=>{
   if(paused)return;
   if(!selected.length){setNotice('Selecciona antes a un oficial.');return;}
   if(obstacles.has(x+','+y)){
     setNotice('Casilla ocupada; no existe una ruta de paso por ese punto.');return;
   }
   try{
     const next=(selected.length===1
       ? orderGroundRealtimeWorld(wideWorld,current.current,selected[0],{x,y})
       : orderGroundRealtimeFormation(wideWorld,current.current,selected,{x,y})) as WideState;
     replace(next);save(next);setFollowing(true);setTouchOrder(false);
     setKeyboardCell({x,y});
     setNotice(selected.length===1?'Oficial avanzando hacia '+x+':'+y
       :'Formación de '+selected.length+' hacia '+x+':'+y);
   }catch{setNotice('Ruta bloqueada o conflicto entre los oficiales: orden no ejecutada.');}
 },[paused,replace,save,selected]);
 const act=useCallback((action:string)=>{
   if(paused)return;
   const target=WIDE_MISSION_TARGETS[action.startsWith('relay.')
     ?'relay-power':'lab-evidence'];
   const actorId=selected.find(id=>wideMissionOfficerInRange(current.current,id,target))
     ??selected[0];
   try{
     const next=applyWideMissionAction(
       wideWorld,plan,current.current,missionRef.current,actorId,action) as WideMission;
     missionRef.current=next;
     setMission(next);
     const persisted=save(current.current,next); // atomic mission+position write
     if(!persisted){
       setNotice('Acción aplicada en esta sesión, pero no se pudo guardar: revisa almacenamiento local.');
       return;
     }
     setNotice(action.startsWith('relay.')
       ?(next.powerRoute==='life-support'
         ?'Soporte vital respaldado · laboratorio sin potencia de análisis.'
         :'Instrumental del laboratorio energizado · evacuados sin respaldo adicional.')
       :(next.evidence==='verified'
         ?'Evidencia analizada y verificada. Informe científico completo.'
         :'Muestras selladas, sin validación instrumental. Soporte vital respaldado.'));
   }catch{
     setNotice('No se puede intervenir: acerca el oficial seleccionado, termina su ruta y comprueba la secuencia.');
   }
 },[paused,save,selected]);
 const relayInRange=selected.some(id=>wideMissionOfficerInRange(
   state,id,WIDE_MISSION_TARGETS['relay-power']));
 const labInRange=selected.some(id=>wideMissionOfficerInRange(
   state,id,WIDE_MISSION_TARGETS['lab-evidence']));
 const consequences=wideMissionConsequences(mission);
 const fog=useMemo(()=>groundRealtimeVision(wideWorld,state),[state]);
 const visibleBarriers=useMemo(()=>terrainWalls.filter(w=>fog.explored.has(w.key)),
   [fog.explored]);
 const connected=useMemo(()=>buildWideConnectedStructures(
   visibleBarriers,scene.width,scene.height) as ConnectedStructure[],
   [visibleBarriers]);
 const covered=new Set(connected.flatMap(c=>c.cells.map(cell=>cell.key)));
 const officers=state.motion.officers;
 const viewing=sectors.find(s=>s.id===sector)??sectors[0];
 const aspect=viewport.width/viewport.height;
 const primary=officers.find(o=>o.id===selected[0])??officers[0];
 const primaryPoint=point(primary?.x??4,primary?.y??5);
 const groupPositions=officers.filter(o=>selected.includes(o.id)).map(o=>point(o.x,o.y));
 const baseHeight=compact?500:Math.max(350,Math.min(430,Math.round(viewport.height/2.2)));
 const groupFrame=following&&groupPositions.length>1
   ?groundRealtimeGroupFrame(groupPositions,aspect,baseHeight,compact,compact?900:760):null;
 const cameraHeight=groupFrame?.height??baseHeight;
 const cameraWidth=cameraHeight*aspect;
 const target=following?(groupFrame?.center??primaryPoint)
   :point((viewing.bounds[0]+viewing.bounds[2])/2,
     (viewing.bounds[1]+viewing.bounds[3])/2);
 const cameraX=Math.max(frame.left,Math.min(frame.left+frame.width-cameraWidth,
   target.x-cameraWidth/2));
 const cameraY=Math.max(frame.top,Math.min(frame.top+frame.height-cameraHeight,
   target.y-cameraHeight*.55));
 const viewBox=following||sector!=='all'
   ?[cameraX,cameraY,cameraWidth,cameraHeight].join(' ')
   :[frame.left,frame.top,frame.width,frame.height].join(' ');
 // The full map is a strategic overview, not a tiny default control surface.
 const viewMode=following?'SEGUIR EQUIPO':sector==='all'?'MAPA COMPLETO':'EXAMINAR '+viewing.name.toUpperCase();
 const onCell=(x:number,y:number)=>order(x,y);
 const onBoardKeyDown=(e:KeyboardEvent<SVGSVGElement>)=>{
   if(paused||e.altKey||e.ctrlKey||e.metaKey)return;
   const moves:Record<string,[number,number]>={
     ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
   };
   const move=moves[e.key];
   if(move){
     e.preventDefault();
     setKeyboardActive(true);
     setKeyboardCell(old=>({
       x:Math.max(0,Math.min(scene.width-1,old.x+move[0])),
       y:Math.max(0,Math.min(scene.height-1,old.y+move[1])),
     }));
   }else if(e.key==='Enter'&&keyboardActive){
     e.preventDefault();order(keyboardCell.x,keyboardCell.y);
   }else if(e.key==='Escape'&&touchOrder){
     e.preventDefault();setTouchOrder(false);
   }
 };
 const moving=officers.some(o=>o.route.length>0);
 const status=moving?notice:
   notice==='El equipo continúa el recorrido guardado.'
     ? 'Equipo en posición · recorrido restaurado.'
     : notice.replace(' avanzando hacia ',' ha llegado a ')
       .replace(/^Formación de (\d+) hacia /,'Formación de $1 ha llegado a ');
 return <div className="wide-trial" data-testid="wide-trial"
   aria-label="Prueba jugable de K-47 Exterior, mapa de 32 por 20 casillas">
   <div className="wide-trial-viewbar" data-testid="wide-viewbar">
     <span><strong>K-47 · ARRAY EXTERIOR</strong> <small>BETA DE EXPLORACIÓN · 32×20</small></span>
     <label>Sector
       <select data-testid="wide-sector-select" value={following?'follow':sector}
         disabled={paused} onChange={e=>{
           if(e.target.value==='follow'){setFollowing(true);return;}
           setFollowing(false);setSector(e.target.value);
         }}>
         <option value="follow">Seguir equipo</option>
         {sectors.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
         <option value="all">Mapa completo</option>
       </select>
     </label>
   </div>
   <div className="wide-trial-stage" ref={stageRef}>
     <svg data-testid="wide-squad-board" role="img" tabIndex={0}
       aria-label="Mapa real de 640 casillas de K-47; flechas para escoger destino y Enter para mover"
       onFocus={()=>{
         const lead=current.current.motion.officers.find(o=>o.id===selected[0]);
         if(lead)setKeyboardCell({x:Math.round(lead.x),y:Math.round(lead.y)});
         setKeyboardActive(false);
       }}
       onBlur={()=>setKeyboardActive(false)}
       onKeyDown={onBoardKeyDown}
       viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
       <defs>
         <linearGradient id="wide-ground" x1="0" y1="0" x2="0.8" y2="1">
           <stop stopColor="#42575a"/><stop offset=".55" stopColor="#243c40"/>
           <stop offset="1" stopColor="#142a34"/>
         </linearGradient>

       </defs>
       <rect x={frame.left} y={frame.top} width={frame.width} height={frame.height}
         fill="#0b1b27" pointerEvents="none"/>
       {cells.map(cell=><polygon key={cell.key} data-wide-cell={cell.key}
         data-wide-obstacle={obstacles.has(cell.key)?'true':'false'}
         points={diamond(cell.x,cell.y)}
         fill={cell.blocked?'#263c41':fog.explored.has(cell.key)?cell.floor:'#20323a'}
         stroke="#152e35" strokeOpacity=".65" strokeWidth="1.4"
         onContextMenu={e=>{e.preventDefault();onCell(cell.x,cell.y);}}
         onClick={()=>{if(touchOrder)onCell(cell.x,cell.y);}}
         style={{cursor:paused?'default':'crosshair'}}/>)}
       <g pointerEvents="none" aria-hidden="true" data-testid="wide-terrain-art">
         {cells.filter(cell=>!cell.blocked&&fog.explored.has(cell.key))
           .map(cell=><WideTerrainDetail key={cell.key} tile={cell}/>)}
         {visibleBarriers.filter(wall=>!covered.has(wall.key))
           .map(wall=><WideTerrainBarrier key={wall.key} wall={wall}/> )}
         {connected.map(structure=><WideTerrainStructure
           key={structure.id} structure={structure}/> )}
         {scenery.filter(o=>fog.explored.has(o.x+','+o.y)).map(o=>{
           const p=point(o.x,o.y);
           return <g key={o.x+','+o.y} transform={'translate('+p.x+' '+p.y+')'}>
             {o.type==='crystal'
               ?<path d="M-8 5 0 -28 12 3 0 12Z" fill="#79b6b7" stroke="#bce5dd"/>
               :o.type==='tuft'
               ?<path d="M-13 5 Q-8 -12 0 3 Q4 -18 13 5" fill="none"
                 stroke="#7e9980" strokeWidth="4"/>
               :o.type==='crater'
               ?<ellipse rx="22" ry="10" fill="#152c35" stroke="#617675"
                 strokeWidth="3"/>
               :<path d="M-19 4 -10 -12 5 -18 20 -2 12 9 -13 10Z"
                 fill="#74827b" stroke="#a0ada1" strokeWidth="2"/>}
           </g>;
         })}
         {scene.objects.filter((o:{x:number;y:number;id:string;label:string})=>fog.explored.has(o.x+','+o.y)).map((o:{x:number;y:number;id:string;label:string})=>{
           const p=point(o.x,o.y);
           return <g key={o.id} transform={'translate('+p.x+' '+p.y+')'}>
             <circle cy="-13" r="15" fill="#203d49" stroke="#d5b981" strokeWidth="3"/>
             <path d="M0 -32V-12" stroke="#eacb91" strokeWidth="3"/>
             <title>{o.label} · disponible en la misión principal de K-47</title>
           </g>;
         })}
       </g>
       <g data-testid="wide-fog" pointerEvents="none">
         {cells.filter(c=>!fog.visible.has(c.key)).map(c=>
           <polygon key={c.key} data-wide-fog-cell={c.key}
             data-fog-state={fog.explored.has(c.key)?'remembered':'unknown'}
             points={diamond(c.x,c.y)}
             fill={fog.explored.has(c.key)?'#102a34':'#06111b'}
             opacity={fog.explored.has(c.key)?.72:.98}/>)}
       </g>
       {/* These are actual live trial objectives, not fake old-world
           stations. Never mark an unexplored target from mission metadata. */}
       <g data-testid="wide-mission-markers" pointerEvents="none" aria-hidden="true">
         {(['relay-power','lab-evidence'] as const).map(id=>{
           const site=WIDE_MISSION_TARGETS[id],cell=site.x+','+site.y;
           if(!fog.explored.has(cell))return null;
           const p=point(site.x,site.y);
           const complete=id==='relay-power'?consequences.relayRestored:consequences.samplesPreserved;
           return <g key={id} data-wide-objective={id}
             data-objective-state={complete?'complete':'pending'}
             transform={'translate('+p.x+' '+p.y+')'}>
             <ellipse cy="0" rx="28" ry="13" fill="#0e3439"
               stroke={complete?'#93d3b8':'#e7bf74'} strokeWidth="3"/>
             <path d="M0 -35 L15 -16 0 -1 -15 -16Z"
               fill={complete?'#76bca1':'#d6af64'}
               stroke="#f4e5ba" strokeWidth="1.5"/>
             <text y="-12" fontSize="14" textAnchor="middle"
               fill="#122a32" fontWeight="bold">{id==='relay-power'?'⚡':'+'}</text>
           </g>;
         })}
       </g>
       {keyboardActive&&<polygon data-testid="wide-keyboard-destination"
         points={diamond(keyboardCell.x,keyboardCell.y)}
         fill="#e8ca86" fillOpacity=".2" stroke="#f1d08d"
         strokeWidth="3" strokeDasharray="7 4" pointerEvents="none"/>}
       {officers.map((o,index)=>{
         const p=point(o.x,o.y),active=selected.includes(o.id);
         const moving=o.route.length>0;
         return <g key={o.id} data-testid={'wide-officer-'+o.id}
           data-world-x={o.x.toFixed(3)} data-world-y={o.y.toFixed(3)}
           data-move-phase={moving?'moving':'idle'}
           transform={'translate('+p.x+' '+p.y+')'}
           className={active?'wide-unit is-active':'wide-unit'}>
           <ellipse rx="19" ry="8" cy="9" fill="#071923" opacity=".85"/>
           <ellipse rx="22" ry="11" cy="7" fill="none"
             stroke={active?'#f2ca83':'#9cbbc0'} strokeWidth={active?3:1.5}/>
           <rect x="-11" y="-25" width="22" height="32" rx="5"
             fill={['#8e755f','#547f85','#689079'][index%3]}
             stroke="#d5d6bc" strokeWidth="1.5" pointerEvents="none"/>
           <circle cy="-33" r="9" fill="#d5b294" stroke="#f1d5a7"
             strokeWidth="1.5" pointerEvents="none"/>
           <rect x="-22" y="-53" width="44" height="58" fill="transparent"
             pointerEvents="all" onClick={()=>setSelected([o.id])}/>
           <g pointerEvents="none">
             <rect x="-34" y="-69" width="68" height="15" rx="3"
               fill="#142d3a" stroke={active?'#e9c88e':'#728c92'}/>
             <text textAnchor="middle" y="-58" fontSize="10" fill="#e3e9dc">
               {squad.find(s=>s.id===o.id)?.name.split(' ')[0]??o.id}
             </text>
           </g>
         </g>;
       })}
     </svg>
     <div className="wide-trial-coordinates" data-testid="wide-map-caption">
       {viewMode} · {fog.explored.size}/640 RECONOCIDAS
     </div>
   </div>
   <div className="wide-trial-controls">
     <div className="wide-trial-roster" role="group" aria-label="Oficiales del experimento">
       {squad.map(o=><button type="button" key={o.id}
         data-testid={'wide-select-'+o.id} aria-pressed={selected.includes(o.id)}
         disabled={paused} onClick={()=>setSelected([o.id])}>
           {o.name.split(' ')[0]}
         </button>)}
       <button type="button" data-testid="wide-select-all" disabled={paused}
         aria-pressed={selected.length===squad.length}
         onClick={()=>setSelected(squad.map(o=>o.id))}>Todos</button>
     </div>
     <button type="button" data-testid="wide-touch-order" disabled={paused}
       aria-pressed={touchOrder} onClick={()=>setTouchOrder(x=>!x)}>
       {touchOrder?'Cancelar orden':'Mover · tocar suelo'}
     </button>
   </div>
   <section className="wide-mission-panel" aria-label="Operación experimental del array exterior"
     data-testid="wide-mission-panel" data-wide-power-route={mission.powerRoute??'none'}
     data-wide-evidence={mission.evidence??'none'}>
     <div className="wide-mission-title">
       <strong>PROTOCOLO EXTERIOR</strong>
       <span data-testid="wide-mission-progress">{mission.journal.length}/2</span>
     </div>
     <div className="wide-mission-step">
       <span className="wide-mission-number">01</span>
       <div>
         <strong>Relé de emergencia</strong>
         <small>(18,15) · {mission.powerRoute===null?'Sin restaurar':
           mission.powerRoute==='life-support'?'Soporte vital respaldado':
           'Laboratorio energizado'}</small>
       </div>
     </div>
     {mission.powerRoute===null&&relayInRange&&<>
       <p className="wide-mission-explainer">
         El circuito solo admite una prioridad. Esta decisión queda guardada.
       </p>
       <div className="wide-mission-choices">
         <button type="button" data-testid="wide-power-life"
           disabled={paused} onClick={()=>act('relay.life-support')}>
           Respaldar soporte vital
         </button>
         <button type="button" data-testid="wide-power-research"
           disabled={paused} onClick={()=>act('relay.research')}>
           Alimentar laboratorio
         </button>
       </div>
     </>}
     <div className="wide-mission-step">
       <span className="wide-mission-number">02</span>
       <div>
         <strong>Evidencia científica</strong>
         <small>(27,13) · {mission.evidence==='verified'?'Verificada':
           mission.evidence==='sealed'?'Conservada sin analizar':
           mission.powerRoute===null?'Requiere relé': 'Pendiente'}</small>
       </div>
     </div>
     {mission.powerRoute!==null&&mission.evidence===null&&labInRange&&<>
       <p className="wide-mission-explainer">
         {mission.powerRoute==='research'
           ?'Analizador alimentado: las muestras pueden verificarse in situ.'
           :'Sin energía de laboratorio: conserva las muestras, pero no podrás verificarlas aquí.'}
       </p>
       <button type="button" data-testid="wide-lab-collect"
         disabled={paused} onClick={()=>act('lab.collect')}>
         {mission.powerRoute==='research'?'Analizar y sellar evidencia':
          'Sellar muestras sin análisis'}
       </button>
     </>}
     {mission.journal.length>0&&<details className="wide-mission-log">
       <summary>Bitácora · {mission.journal.length} eventos</summary>
       <ol data-testid="wide-mission-journal">
         {mission.journal.map((event,index)=><li key={index}>
           {event.code==='relay.life-support'?'Reserva al soporte vital':
             event.code==='relay.research'?'Reserva a investigación':
             event.code==='lab.verified'?'Muestras verificadas':
             'Muestras selladas sin analizar'}
           {' · '+(squad.find(o=>o.id===event.officerId)?.name??event.officerId)}
         </li>)}
       </ol>
     </details>}
     {consequences.complete&&<p className="wide-mission-result"
       data-testid="wide-mission-result">
       {consequences.lifeSupportBacked
         ?'Informe cerrado: soporte vital estabilizado; muestras conservadas sin validar.'
         :'Informe cerrado: evidencia verificada; soporte vital sin respaldo adicional.'}
     </p>}
     <p className="wide-mission-context">
       {mission.journal.length===0?'Acerca un oficial al relé para empezar.':
         mission.evidence===null?'La elección es definitiva. Continúa hasta el laboratorio.':
         'Dos decisiones registradas en la bitácora de esta expedición.'}
     </p>
   </section>
   <p className="wide-trial-notice" data-testid="wide-move-status" role="status">{status}</p>
   <details className="wide-trial-help">
     <summary>Ayuda de esta expedición beta</summary>
     Dos objetivos experimentales activos: relé y laboratorio. Otros tres
     siguen previstos, sin interacciones. Escoge físicamente un oficial en
     la casilla o junto al objetivo para intervenir. Las decisiones persisten
     y no alteran la misión clásica. Flechas y Enter, clic derecho o «Mover»
     y tocar suelo ordenan desplazamientos.
   </details>
 </div>;
}
