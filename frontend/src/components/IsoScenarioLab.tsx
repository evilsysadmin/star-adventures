import { useState, type KeyboardEvent } from 'react';
import { IsoScenarioBoard } from './IsoScenarioBoard';
import {
 SCENARIOS, applyMissionAction, missionPath,
 type MissionAction, type ScenarioId, type SquadId,
} from '../isoScenarioCampaign';
import { MAX_SCENARIO_COMMANDS } from '../isoScenarioCheckpoint';
import { localStorageOrNull } from '../session';
import { newScenarioSession, restoreScenarioSession, persistScenarioSession } from '../isoScenarioSession';
import './isoScenarioLab.css';

const order: readonly ScenarioId[]=['relay','derelict','evacuation'];
const officers: readonly {id:SquadId;name:string;role:string}[]=[
 {id:'science',name:'Científica',role:'Reconocimiento'},
 {id:'security',name:'Seguridad',role:'Terminales'},
 {id:'medic',name:'Médica',role:'Rescate'},
];
const pos=(id:string)=>id.split(':').map(Number) as [number,number];

export function IsoScenarioLab(){
 const [startup]=useState(()=>restoreScenarioSession(localStorageOrNull()));
 const [history,setHistory]=useState(startup.history);
 const { scenarioId, state: mission }=history;
 const [officer,setOfficer]=useState<SquadId>('science');
 const [selected,setSelected]=useState(startup.history.state.locations.science);
 const [focus,setFocus]=useState(false);
 const [notice,setNotice]=useState(startup.notice);
 const scenario=SCENARIOS[scenarioId];
 const route=missionPath(mission,officer,selected);
 const move:MissionAction={type:'move',officer,cell:selected};
 const scan:MissionAction={type:'scan',officer:'science'};
 const operate:MissionAction={type:'operate',officer:'security'};
 const rescue:MissionAction={type:'rescue',officer:'medic'};
 const extract:MissionAction={type:'extract',officer};
 const available=(command:MissionAction)=>{
  if(history.actions.length>=MAX_SCENARIO_COMMANDS)return false;
  try{applyMissionAction(mission,command);return true;}catch{return false;}
 };
 const execute=(command:MissionAction)=>{
  if(history.actions.length>=MAX_SCENARIO_COMMANDS){
   setNotice('Límite de órdenes alcanzado · inicia otra misión');return;
  }
  try{
   const state=applyMissionAction(mission,command);
   const next={scenarioId,actions:[...history.actions,command],state};
   const saved=persistScenarioSession(next,localStorageOrNull());
   setHistory(next);
   setNotice((saved?'':'Progreso no guardado · ')+(state.events.at(-1)||'Orden ejecutada'));
  }catch(error){setNotice(error instanceof Error?error.message:'Orden rechazada');}
 };
 const change=(id:ScenarioId)=>{
  const next=newScenarioSession(id);
  const saved=persistScenarioSession(next,localStorageOrNull());
  setHistory(next);
  setOfficer('science');setSelected(next.state.locations.science);setFocus(false);
  setNotice(saved?'Nuevo escenario · progreso guardado en este navegador':
    'Nuevo escenario · almacenamiento no disponible, sesión temporal');
 };
 const choose=(cell:string)=>{
  setSelected(cell);
  for(const id of ['science','security','medic'] as const)
   if(mission.locations[id]===cell){setOfficer(id);break;}
 };
 const onKeyboard=(event:KeyboardEvent<HTMLDivElement>)=>{
  const offsets:Record<string,[number,number]>={
   ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
  };
  const delta=offsets[event.key];
  if(!delta)return;
  event.preventDefault();
  const [x,y]=pos(selected),nx=x+delta[0],ny=y+delta[1];
  if(nx>=0&&nx<scenario.size&&ny>=0&&ny<scenario.size)choose(`${nx}:${ny}`);
 };
 const objectives=[
  {key:'sensor',text:'Analizar señal',at:scenario.sensor,done:mission.scanned},
  ...(scenario.console?[{key:'console',text:'Operar terminal',at:scenario.console,done:mission.consoleOnline}]:[]),
  ...(scenario.survivor?[{key:'survivor',text:'Rescatar superviviente',at:scenario.survivor,done:mission.rescued}]:[]),
  {key:'extraction',text:'Extraer equipo',at:scenario.extraction,done:mission.completed},
 ];
 return <section className="scenario-lab" data-testid="scenario-lab" aria-labelledby="scenario-heading">
  <header className="scenario-head">
   <span className="scenario-eyebrow">OPERACIONES TÁCTICAS · LABORATORIO JUGABLE</span>
   <h2 id="scenario-heading">Tres misiones, un equipo</h2>
   <p>Elige un objetivo, despliega a la escuadra y resuelve la misión. Los movimientos y las órdenes cambian el estado real del escenario.</p>
  </header>
  <div className="scenario-selector" role="group" aria-label="Elegir misión táctica">
   {order.map(id=><button key={id} type="button"
    data-testid={`scenario-tab-${id}`} aria-pressed={scenarioId===id}
    onClick={()=>change(id)}>
    <strong>{SCENARIOS[id].label}</strong>
    <span>{SCENARIOS[id].size} × {SCENARIOS[id].size} · {id==='relay'?'Comunicaciones':id==='derelict'?'Exploración / rescate':'Evacuación'}</span>
   </button>)}
  </div>
  <div className="scenario-briefing">
   <div><span className="scenario-eyebrow">OBJETIVO ACTUAL</span>
    <h3 data-testid="scenario-name">{scenario.label}</h3>
    <p>{scenario.briefing}</p>
   </div>
   <div className="scenario-turn" data-testid="scenario-turn">
    <strong>Ronda {mission.round}</strong>
    <span data-testid="scenario-ap">{mission.ap} / 3 órdenes</span>
   </div>
  </div>
  <div className="scenario-viewtools">
   <button type="button" data-testid="scenario-focus-toggle" aria-pressed={focus}
    onClick={()=>setFocus(value=>!value)}>{focus?'Ver mapa completo':'Acercar cámara a la casilla'}</button>
   <span data-testid="scenario-camera-mode">{focus?'Detalle de casilla':'Vista táctica completa'} · {scenario.size} × {scenario.size}</span>
  </div>
  <div onKeyDown={onKeyboard} className="scenario-board-shell" tabIndex={0}
   aria-label="Mapa táctico: usa las flechas para seleccionar una casilla" data-testid="scenario-keyboard">
   <IsoScenarioBoard key={scenarioId} scenario={scenario} mission={mission}
    selected={selected} focus={focus} route={route} onPick={choose}/>
  </div>
  <div className="scenario-cell-bar">
   <div><span>CASILLA ELEGIDA</span>
    <strong data-testid="scenario-selected">{selected}</strong>
    <small data-testid="scenario-route">{route&&route.length>1
     ?`Ruta: ${route.length-1} casillas${route.length>6?' · necesitas un destino intermedio':''}`
     :route?'Oficial en su casilla':'Sin ruta disponible'}</small>
   </div>
   <div className="scenario-legend">
    <span> <i className="scenario-dot sci"/> Ciencia</span>
    <span> <i className="scenario-dot tech"/> Terminal</span>
    <span> <i className="scenario-dot evac"/> Extracción</span>
   </div>
  </div>
  <div className="scenario-roster" role="group" aria-label="Seleccionar oficial">
   {officers.map(unit=><button type="button" key={unit.id}
    data-testid={`scenario-unit-${unit.id}`} aria-pressed={officer===unit.id}
    disabled={mission.completed}
    onClick={()=>{setOfficer(unit.id);setSelected(mission.locations[unit.id]);}}>
    <strong>{unit.name}</strong><span>{unit.role}</span>
    <small>{mission.locations[unit.id]}</small>
   </button>)}
  </div>
  <div className="scenario-orders" role="group" aria-label="Órdenes tácticas con resultados reales">
   <button type="button" data-testid="scenario-move" disabled={!available(move)}
    onClick={()=>execute(move)}>Mover · máximo 5 casillas</button>
   <button type="button" data-testid="scenario-scan" disabled={!available(scan)}
    onClick={()=>execute(scan)}>Escanear señal</button>
   <button type="button" data-testid="scenario-operate" disabled={!available(operate)}
    onClick={()=>execute(operate)}>Operar terminal</button>
   <button type="button" data-testid="scenario-rescue" disabled={!available(rescue)}
    onClick={()=>execute(rescue)}>Rescatar</button>
   <button type="button" data-testid="scenario-extract" disabled={!available(extract)}
    onClick={()=>execute(extract)}>Solicitar extracción</button>
   <button type="button" data-testid="scenario-end-turn" disabled={mission.completed}
    onClick={()=>execute({type:'end-turn'})}>Fin de turno · recuperar 3 órdenes</button>
  </div>
  <p className="scenario-notice" data-testid="scenario-notice" role="status">{notice}</p>
  <div className="scenario-objectives" data-testid="scenario-objectives">
   {objectives.map(item=><div key={item.key}
    className={item.done?'scenario-objective completed':'scenario-objective'}>
    <span aria-hidden="true">{item.done?'✓':'◇'}</span>
    <span>{item.text} <small>{item.at}</small></span>
   </div>)}
  </div>
  {mission.completed&&<p className="scenario-success" data-testid="scenario-success" role="status">
   Misión completada. El registro confirma que todos los objetivos obligatorios se han cumplido.
  </p>}
  <details className="scenario-grid" data-testid="scenario-accessible-grid">
   <summary>Seleccionar una de las {scenario.size*scenario.size} casillas por teclado</summary>
   <div style={{gridTemplateColumns:`repeat(${scenario.size},minmax(33px,1fr))`}}>
    {Array.from({length:scenario.size*scenario.size},(_,index)=>{
     const id=`${index%scenario.size}:${Math.floor(index/scenario.size)}`;
     return <button key={id} type="button" aria-label={`Casilla ${id}`}
      aria-pressed={selected===id} onClick={()=>choose(id)}>{id}</button>;
    })}
   </div>
  </details>
  <details className="scenario-log" data-testid="scenario-log">
   <summary>Diario de acciones verificadas · {mission.events.length} eventos</summary>
   <ol>{mission.events.map((event,index)=><li key={index}>{event}</li>)}</ol>
  </details>
  <p className="scenario-disclaimer">Simulador local de entrenamiento · progreso guardado independientemente de la campaña si el navegador lo permite.
   Sin enemigos activos; las patrullas y animaciones de combate se integrarán por separado.</p>
 </section>;
}
