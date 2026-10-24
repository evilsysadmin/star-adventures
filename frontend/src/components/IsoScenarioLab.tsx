import { useMemo, useState, type KeyboardEvent } from 'react';
import { IsoScenarioBoard } from './IsoScenarioBoard';
import {
 SCENARIOS, applyMissionAction, missionPath,
 type MissionAction, type ScenarioId, type SquadId,
} from '../isoScenarioCampaign';
import { MAX_SCENARIO_COMMANDS } from '../isoScenarioCheckpoint';
import { addTrainingResult, trainingResult, type TrainingArchive } from '../isoTrainingRecords';
import { restoreTrainingRecords, persistTrainingRecords } from '../isoTrainingSession';
import { localStorageOrNull } from '../session';
import { newScenarioSession, restoreScenarioSession, persistScenarioSession } from '../isoScenarioSession';
import { newHostileEncounterSession, restoreHostileEncounterSession, persistHostileEncounterSession } from '../isoScenarioHostileSession';
import { replayHostileEncounterCommands } from '../isoScenarioHostileCheckpoint';
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
 const [hostileStartup]=useState(()=>restoreHostileEncounterSession(localStorageOrNull()));
 const [hostileHistory,setHostileHistory]=useState(hostileStartup.history);
 const [hostileMode,setHostileMode]=useState(false);
 const [initialRecords]=useState(()=>{
  const stored=restoreTrainingRecords(localStorageOrNull());
  if(!startup.history.state.completed)return stored;
  const archive=addTrainingResult(stored.archive,startup.history);
  const saved=persistTrainingRecords(archive,localStorageOrNull());
  return {archive,notice:saved?'':(stored.notice||'Récord no guardado · almacenamiento no disponible')};
 });
 const [records,setRecords]=useState<TrainingArchive>(initialRecords.archive);
 const [recordNotice,setRecordNotice]=useState(initialRecords.notice);
 const scenarioId=hostileMode?hostileHistory.scenarioId:history.scenarioId;
 const mission=hostileMode?hostileHistory.encounter.mission:history.state;
 const hostilePositions=hostileMode?hostileHistory.encounter.positions:undefined;
 const activeActions=hostileMode?hostileHistory.actions:history.actions;
 const [officer,setOfficer]=useState<SquadId>('science');
 const [selected,setSelected]=useState(startup.history.state.locations.science);
 const [focus,setFocus]=useState(false);
 const [notice,setNotice]=useState(startup.notice);
 const scenario=SCENARIOS[scenarioId];
 const completedResult=useMemo(()=>!hostileMode&&mission.completed
  ?trainingResult({scenarioId:history.scenarioId,actions:history.actions}):null,[history,hostileMode]);
 const bestResults=useMemo(()=>records.runs.map(trainingResult),[records]);
 const route=missionPath(mission,officer,selected,
  hostilePositions?Object.values(hostilePositions):[]);
 const move:MissionAction={type:'move',officer,cell:selected};
 const scan:MissionAction={type:'scan',officer:'science'};
 const operate:MissionAction={type:'operate',officer:'security'};
 const rescue:MissionAction={type:'rescue',officer:'medic'};
 const extract:MissionAction={type:'extract',officer};
 const available=(command:MissionAction)=>{
  if(activeActions.length>=MAX_SCENARIO_COMMANDS)return false;
  try{
   if(hostileMode)replayHostileEncounterCommands(scenarioId,[...hostileHistory.actions,command]);
   else applyMissionAction(mission,command);
   return true;
  }catch{return false;}
 };
 const execute=(command:MissionAction)=>{
  if(activeActions.length>=MAX_SCENARIO_COMMANDS){
   setNotice('Límite de órdenes alcanzado · inicia otra misión');return;
  }
  try{
   if(hostileMode){
    const next=replayHostileEncounterCommands(scenarioId,[...hostileHistory.actions,command]);
    const saved=persistHostileEncounterSession(next,localStorageOrNull());
    setHostileHistory(next);
    const movements=next.encounter.moves.map(move=>`${move.hostile}: ${move.from} → ${move.to}`);
    const threats=next.encounter.threats.map(threat=>`${threat.hostile} amenaza a ${threat.officer}`);
    setNotice((saved?'':'Encuentro no guardado · ')+[
     next.encounter.mission.events.at(-1)||'Orden ejecutada',
     ...movements,...threats,
    ].join(' · '));
    return;
   }
   const state=applyMissionAction(mission,command);
   const next={scenarioId,actions:[...history.actions,command],state};
   const saved=persistScenarioSession(next,localStorageOrNull());
   if(state.completed){
    const updated=addTrainingResult(records,next);
    setRecords(updated);
    if(JSON.stringify(updated)!==JSON.stringify(records)){
     const recorded=persistTrainingRecords(updated,localStorageOrNull());
     setRecordNotice(recorded?'':'Récord no guardado · el historial permanecerá temporal');
    }
   }
   setHistory(next);
   setNotice((saved?'':'Progreso no guardado · ')+(state.events.at(-1)||'Orden ejecutada'));
  }catch(error){setNotice(error instanceof Error?error.message:'Orden rechazada');}
 };
 const change=(id:ScenarioId)=>{
  if(hostileMode){
   const next=newHostileEncounterSession(id);
   const saved=persistHostileEncounterSession(next,localStorageOrNull());
   setHostileHistory(next);
   setOfficer('science');setSelected(next.encounter.mission.locations.science);setFocus(false);
   setNotice(saved?'Nuevo encuentro hostil · progreso guardado':'Encuentro temporal · no guardado');
   return;
  }
  const next=newScenarioSession(id);
  const saved=persistScenarioSession(next,localStorageOrNull());
  setHistory(next);
  setOfficer('science');setSelected(next.state.locations.science);setFocus(false);
  setNotice(saved?'Nuevo escenario · progreso guardado en este navegador':
    'Nuevo escenario · almacenamiento no disponible, sesión temporal');
 };
 const switchEncounter=(enabled:boolean)=>{
  setHostileMode(enabled);
  const target=enabled?hostileHistory.encounter.mission:history.state;
  setOfficer('science');setSelected(target.locations.science);setFocus(false);
  setNotice(enabled?hostileStartup.notice:startup.notice);
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
   <div className="scenario-mode-select" role="group" aria-label="Tipo de ejercicio táctico">
    <button type="button" data-testid="scenario-training-toggle" aria-pressed={!hostileMode}
     onClick={()=>switchEncounter(false)}>Entrenamiento</button>
    <button type="button" data-testid="scenario-hostile-toggle" aria-pressed={hostileMode}
     onClick={()=>switchEncounter(true)}>Encuentro hostil · experimental</button>
   </div>
   <button type="button" data-testid="scenario-focus-toggle" aria-pressed={focus}
    onClick={()=>setFocus(value=>!value)}>{focus?'Ver mapa completo':'Acercar cámara a la casilla'}</button>
   <span data-testid="scenario-camera-mode">{focus?'Detalle de casilla':'Vista táctica completa'} · {scenario.size} × {scenario.size}</span>
  </div>
  <div onKeyDown={onKeyboard} className="scenario-board-shell" tabIndex={0}
   aria-label="Mapa táctico: usa las flechas para seleccionar una casilla" data-testid="scenario-keyboard">
   <IsoScenarioBoard key={scenarioId} scenario={scenario} mission={mission}
    selected={selected} focus={focus} route={route} hostilePositions={hostilePositions} onPick={choose}/>
  </div>
  <div className="scenario-cell-bar">
   <div><span>CASILLA ELEGIDA</span>
    <strong data-testid="scenario-selected">{selected}</strong>
    <small data-testid="scenario-route">{route&&route.length>1
     ?`Ruta: ${route.length-1} casillas${route.length>6?' · necesitas un destino intermedio':''}`
     :route?'Oficial en su casilla':'Sin ruta disponible'}</small>
   </div>
   {hostilePositions&&<div className="scenario-hostile-status" data-testid="scenario-hostile-status"
    aria-label="Posiciones enemigas verificadas">
    <span data-testid="scenario-hostile-aegis">Aegis {hostilePositions.aegis}</span>
    <span data-testid="scenario-hostile-veil">Velo {hostilePositions.veil}</span>
   </div>}
   <div className="scenario-legend">
    <span> <i className="scenario-dot sci"/> Ciencia</span>
    <span> <i className="scenario-dot tech"/> Terminal</span>
    <span> <i className="scenario-dot evac"/> Extracción</span>
    <span> <i className="scenario-dot hostile"/> Contacto hostil</span>
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
  {completedResult&&<section className="scenario-debrief" data-testid="scenario-debrief" aria-label="Informe táctico de entrenamiento">
   <span className="scenario-eyebrow">EXTRACCIÓN CONFIRMADA · INFORME DE MANIOBRAS</span>
   <h3>{completedResult.label}</h3>
   <p className="scenario-success" data-testid="scenario-success" role="status">Misión completada. Objetivos y extracción confirmados por el historial de órdenes.</p>
   <p data-testid="scenario-debrief-metrics">Ronda {completedResult.rounds} · {completedResult.orders} órdenes · {completedResult.moves} movimientos</p>
   <p>Telemetría {completedResult.scanned?'recuperada':'no recuperada'}{scenario.console?' · Terminal '+(completedResult.operated?'restablecida':'pendiente'):''}{scenario.survivor?' · Superviviente '+(completedResult.rescued?'rescatada':'pendiente'):''}</p>
   <p className="scenario-debrief-scope">Simulación de entrenamiento; no acredita rescates ni órdenes de la campaña.</p>
   {recordNotice&&<p data-testid="scenario-record-notice">{recordNotice}</p>}
   <button type="button" data-testid="scenario-retry" onClick={()=>change(scenarioId)}>Repetir esta maniobra</button>
  </section>}
  {!hostileMode&&records.runs.length>0&&<details className="scenario-training-records" data-testid="scenario-training-records">
   <summary>Archivo de maniobras · {records.runs.length} de 3 misiones acreditadas</summary>
   <ul>{bestResults.map(result=><li key={result.scenarioId} data-testid={`scenario-record-${result.scenarioId}`}>
    <strong>{result.label}</strong> · Ronda {result.rounds} · {result.orders} órdenes
   </li>)}</ul>
   <p>Récords reconstruidos a partir de maniobras completadas, separados de la campaña principal.</p>
  </details>}
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
  <p className="scenario-disclaimer">{hostileMode
   ?'Encuentro hostil experimental · los enemigos avanzan al terminar el turno y bloquean rutas. Las amenazas no causan heridas todavía. Guardado v2 separado del entrenamiento y de la campaña.'
   :'Simulador local de entrenamiento · progreso guardado independientemente de la campaña si el navegador lo permite. Los contactos hostiles son visuales; activa el encuentro experimental para probar sus turnos.'}</p>
 </section>;
}
