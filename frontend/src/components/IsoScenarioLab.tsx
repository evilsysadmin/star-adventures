import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IsoScenarioBoard } from './IsoScenarioBoard';
import {
 SCENARIOS, MAX_MOVE_STEPS, applyMissionAction, missionPath, nextMissionWaypoint,
 type MissionAction, type ScenarioId, type SquadId,
} from '../isoScenarioCampaign';
import { MAX_SCENARIO_COMMANDS } from '../isoScenarioCheckpoint';
import { addTrainingResult, trainingResult, type TrainingArchive } from '../isoTrainingRecords';
import { restoreTrainingRecords, persistTrainingRecords } from '../isoTrainingSession';
import { localStorageOrNull } from '../session';
import { newScenarioSession, restoreScenarioSession, persistScenarioSession } from '../isoScenarioSession';
import { newHostileEncounterSession, restoreHostileEncounterSession, persistHostileEncounterSession } from '../isoScenarioHostileSession';
import { replayHostileEncounterCommands } from '../isoScenarioHostileCheckpoint';
import { newCombatEncounterSession, restoreCombatEncounterSession, persistCombatEncounterSession } from '../isoScenarioCombatSession';
import { replayCombatEncounterCommands } from '../isoScenarioCombatCheckpoint';
import { COMBAT_OFFICER_MAX_HP } from '../isoScenarioCombatEncounter';
import { replayCombatCommands, type CombatReplayAction } from '../isoScenarioCombatReplay';
import { newCombatReplaySession, restoreCombatReplaySession, persistCombatReplaySession } from '../isoScenarioCombatReplaySession';
import { startCombatMissionAttemptSession, persistCombatMissionAttemptProgress } from '../isoScenarioCombatMissionInstanceSession';
import { COMBAT_HOSTILE_MAX_HP } from '../isoScenarioCombatFire';
import { playAcceptedTacticalShot } from '../isoTacticalShotAudio';
import { evaluateCombatAim } from '../isoScenarioCombatAim';
import { compactCombatFireLabel, describeCombatAim } from '../isoCombatAimFeedback';
import type { HostileId } from '../isoScenarioHostileTurn';
import './isoScenarioLab.css';

const order: readonly ScenarioId[]=['relay','derelict','evacuation'];
const officers: readonly {id:SquadId;name:string;role:string}[]=[
 {id:'science',name:'Científica',role:'Reconocimiento'},
 {id:'security',name:'Seguridad',role:'Terminales'},
 {id:'medic',name:'Médica',role:'Rescate'},
];
const pos=(id:string)=>id.split(':').map(Number) as [number,number];

export function IsoScenarioLab({fieldEncounter=false,onFieldResolved,onReturnToSurface}:{fieldEncounter?:boolean;onFieldResolved?:(result:'truce'|'victory')=>void;onReturnToSurface?:()=>void}={}){
 const [startup]=useState(()=>restoreScenarioSession(localStorageOrNull()));
 const [history,setHistory]=useState(startup.history);
 const [hostileStartup]=useState(()=>restoreHostileEncounterSession(localStorageOrNull()));
 const [hostileHistory,setHostileHistory]=useState(hostileStartup.history);
 const [hostileMode,setHostileMode]=useState(false);
 const [combatStartup]=useState(()=>restoreCombatEncounterSession(localStorageOrNull()));
 const [combatHistory,setCombatHistory]=useState(combatStartup.history);
 const [combatMode,setCombatMode]=useState(false);
 const [replayStartup]=useState(()=>restoreCombatReplaySession(localStorageOrNull()));
 const [replayHistory,setReplayHistory]=useState(()=>fieldEncounter?newCombatReplaySession('evacuation'):replayStartup.history);
 const [replayMode,setReplayMode]=useState(fieldEncounter);
 const [initialRecords]=useState(()=>{
  const stored=restoreTrainingRecords(localStorageOrNull());
  if(!startup.history.state.completed)return stored;
  const archive=addTrainingResult(stored.archive,startup.history);
  const saved=persistTrainingRecords(archive,localStorageOrNull());
  return {archive,notice:saved?'':(stored.notice||'Récord no guardado · almacenamiento no disponible')};
 });
 const [records,setRecords]=useState<TrainingArchive>(initialRecords.archive);
 const [recordNotice,setRecordNotice]=useState(initialRecords.notice);
 const replay=replayMode?replayHistory.combat:null;
 const scenarioId=replayMode?replayHistory.scenarioId:combatMode?combatHistory.scenarioId:hostileMode?hostileHistory.scenarioId:history.scenarioId;
 const mission=replay?replay.encounter.mission:combatMode?combatHistory.encounter.mission:hostileMode?hostileHistory.encounter.mission:history.state;
 const hostilePositions=replay?replay.encounter.positions:combatMode?combatHistory.encounter.positions:hostileMode?hostileHistory.encounter.positions:undefined;
 const activeActions=replayMode?replayHistory.actions:combatMode?combatHistory.actions:hostileMode?hostileHistory.actions:history.actions;
 const combat=replay?replay.encounter:combatMode?combatHistory.encounter:null;
 const hostileHealth=replay?.hostileHealth;
 const [officer,setOfficer]=useState<SquadId>('science');
 const [selected,setSelected]=useState(startup.history.state.locations.science);
 const [focus,setFocus]=useState(false);
 const [notice,setNotice]=useState(fieldEncounter?'Contacto hostil detectado · negocia o asegura el perímetro':startup.notice);
 // Fire feedback is transient presentation only; never enters the replay/save.
 const [shot,setShot]=useState<{id:number;from:string;to:string;officer:SquadId}|null>(null);
 const nextShotId=useRef(0);
 // The explicit Play action should reveal the playable board immediately.
 const boardRef=useRef<HTMLDivElement>(null);
 // A physical surface interaction must reveal the actual playable board,
 // not strand the player above a long tactical briefing on mobile.
 useEffect(()=>{
  if(!fieldEncounter)return;
  const frame=requestAnimationFrame(()=>{
   boardRef.current?.scrollIntoView({block:'center',behavior:'auto'});
   boardRef.current?.focus({preventScroll:true});
  });
  return ()=>cancelAnimationFrame(frame);
 },[fieldEncounter]);
 // Only accepted live enemy turns trigger presentation. Replaying an F5 save
 // restores health but never replays a wound as if it had just happened.
 const [officerHit,setOfficerHit]=useState<{id:number;officers:readonly SquadId[]}|null>(null);
 const nextOfficerHitId=useRef(0);
 const presentHits=(hits:readonly {officer:SquadId}[])=>{
  setOfficerHit(hits.length?{
   id:++nextOfficerHitId.current,
   officers:[...new Set(hits.map(hit=>hit.officer))],
  }:null);
 };
 const scenario=SCENARIOS[scenarioId];
 const completedResult=useMemo(()=>!hostileMode&&!combatMode&&!replayMode&&mission.completed
  ?trainingResult({scenarioId:history.scenarioId,actions:history.actions}):null,[history,hostileMode,combatMode,replayMode]);
 const bestResults=useMemo(()=>records.runs.map(trainingResult),[records]);
 const route=missionPath(mission,officer,selected,
  hostilePositions?Object.entries(hostilePositions).filter(([id])=>!hostileHealth||hostileHealth[id as HostileId]>0).map(([,cell])=>cell):[]);
 // Keep the distant destination selected while advancing one validated
 // five-cell segment at a time. No direct-line shortcut or extra AP.
 const move:MissionAction={type:'move',officer,cell:nextMissionWaypoint(route)??selected};
 const scan:MissionAction={type:'scan',officer:'science'};
 const operate:MissionAction={type:'operate',officer:'security'};
 const rescue:MissionAction={type:'rescue',officer:'medic'};
 const extract:MissionAction={type:'extract',officer};
 const fireTarget=replay
  ?(Object.keys(replay.hostileHealth) as HostileId[]).find(id=>
    replay.hostileHealth[id]>0&&replay.encounter.positions[id]===selected)
  :undefined;
 const fireAim=replay&&fireTarget?evaluateCombatAim({
  ...replay.encounter,
  positions:Object.fromEntries(Object.entries(replay.encounter.positions)
   .filter(([id])=>replay.hostileHealth[id as HostileId]>0)) as Record<HostileId,string>,
 },officer,fireTarget):null;
 const fireReady=!!(replay&&fireTarget&&activeActions.length<MAX_SCENARIO_COMMANDS&&
  !replay.victory&&!replay.encounter.failed&&(()=>{
   try{replayCombatCommands(scenarioId,[...replayHistory.actions,{type:'fire',officer,hostile:fireTarget}]);return true;}
   catch{return false;}
  })());
 // The renderer receives only the reducer's actual range/cover decision.
 // No speculative hit chance, no duplicated LOS rules in Three.js.
 const aimPreview=replay&&fireTarget&&fireAim?{
  from:replay.encounter.mission.locations[officer],
  to:replay.encounter.positions[fireTarget],
  allowed:fireReady,
  blocker:fireAim.blocker,
  reason:fireReady?'ready':fireAim.reason,
 }:null;
 const parleyReady=!!(replay&&activeActions.length<MAX_SCENARIO_COMMANDS&&
  !replay.victory&&!replay.truce&&!replay.encounter.failed&&(()=>{
   try{replayCombatCommands(scenarioId,[...replayHistory.actions,{type:'parley',officer:'security'}]);return true;}
   catch{return false;}
  })());
 const executeReplay=(command:CombatReplayAction)=>{
  if(replayHistory.actions.length>=MAX_SCENARIO_COMMANDS){
   setNotice('Límite de órdenes alcanzado · reinicia el combate');return;
  }
  try{
   const next=replayCombatCommands(scenarioId,[...replayHistory.actions,command]);
   const saved=fieldEncounter?true:persistCombatMissionAttemptProgress(next,localStorageOrNull()).replaySaved;
   setReplayHistory(next);
   if(fieldEncounter&&!replayHistory.combat.truce&&!replayHistory.combat.victory){
    if(next.combat.truce)onFieldResolved?.('truce');
    else if(next.combat.victory)onFieldResolved?.('victory');
   }
   presentHits(command.type==='end-turn'?next.combat.encounter.hits:[]);
   if(command.type==='fire'){
    // The reducer has accepted this shot. Play immediately in the click gesture;
    // never on replay/F5, invalid targets, or a blocked command.
    playAcceptedTacticalShot();
    setShot({
     id:++nextShotId.current,
     officer:command.officer,
     from:replayHistory.combat.encounter.mission.locations[command.officer],
     to:replayHistory.combat.encounter.positions[command.hostile],
    });
   }
   const hits=next.combat.encounter.hits.map(hit=>hit.hostile+' hiere a '+hit.officer+': '+hit.remainingHp+'/'+COMBAT_OFFICER_MAX_HP+' PV');
   setNotice((saved?'':'Combate v4 no guardado · ')+[
    next.combat.encounter.mission.events.at(-1)||'Orden ejecutada',...hits,
    ...(next.combat.victory&&!replay?.victory?['Amenazas neutralizadas · continúa los objetivos y solicita extracción']:[]),
    ...(next.combat.encounter.mission.completed?['Extracción confirmada · misión completada']:[]),
    ...(next.combat.encounter.failed?['Escuadra incapacitada · encuentro terminado']:[]),
   ].join(' · '));
  }catch(error){setNotice(error instanceof Error?error.message:'Orden rechazada');}
 };
 const available=(command:MissionAction)=>{
  if(mission.completed||combat?.failed||activeActions.length>=MAX_SCENARIO_COMMANDS)return false;
  try{
   if(replayMode)replayCombatCommands(scenarioId,[...replayHistory.actions,command]);
   else if(combatMode)replayCombatEncounterCommands(scenarioId,[...combatHistory.actions,command]);
   else if(hostileMode)replayHostileEncounterCommands(scenarioId,[...hostileHistory.actions,command]);
   else applyMissionAction(mission,command);
   return true;
  }catch{return false;}
 };
 const execute=(command:MissionAction)=>{
  if(replayMode){executeReplay(command);return;}
  if(activeActions.length>=MAX_SCENARIO_COMMANDS){
   setNotice('Límite de órdenes alcanzado · inicia otra misión');return;
  }
  try{
   if(combatMode){
    const next=replayCombatEncounterCommands(scenarioId,[...combatHistory.actions,command]);
    const saved=persistCombatEncounterSession(next,localStorageOrNull());
    setCombatHistory(next);
    presentHits(command.type==='end-turn'?next.encounter.hits:[]);
    const hits=next.encounter.hits.map(hit=>
     `${hit.hostile} hiere a ${hit.officer}: ${hit.remainingHp}/${COMBAT_OFFICER_MAX_HP} PV`);
    setNotice((saved?'':'Combate no guardado · ')+[
     next.encounter.mission.events.at(-1)||'Orden ejecutada',
     ...hits,
     ...(next.encounter.failed?['Escuadra incapacitada · encuentro terminado']:[]),
    ].join(' · '));
    return;
   }
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
  setShot(null);setOfficerHit(null);
  if(replayMode){
   const next=newCombatReplaySession(id);
   const storage=localStorageOrNull();
   const instanceId=globalThis.crypto?.randomUUID?.();
   const saved=fieldEncounter?true:instanceId
    ?startCombatMissionAttemptSession(instanceId,id,storage).replaySaved
    :persistCombatReplaySession(next,storage);
   setReplayHistory(next);
   setOfficer('science');setSelected(next.combat.encounter.mission.locations.science);setFocus(false);
   setNotice(saved?'Nuevo combate v4 · progreso guardado':'Combate v4 temporal · no guardado');
   return;
  }
  if(combatMode){
   const next=newCombatEncounterSession(id);
   const saved=persistCombatEncounterSession(next,localStorageOrNull());
   setCombatHistory(next);
   setOfficer('science');setSelected(next.encounter.mission.locations.science);setFocus(false);
   setNotice(saved?'Nuevo combate experimental · progreso guardado':'Combate temporal · no guardado');
   return;
  }
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
 const switchEncounter=(mode:'training'|'hostile'|'combat'|'replay')=>{
  setShot(null);setOfficerHit(null);
  setHostileMode(mode==='hostile');
  setCombatMode(mode==='combat');
  setReplayMode(mode==='replay');
  const target=mode==='replay'?replayHistory.combat.encounter.mission:
   mode==='combat'?combatHistory.encounter.mission:
   mode==='hostile'?hostileHistory.encounter.mission:history.state;
  setOfficer('science');setSelected(target.locations.science);setFocus(false);
  setNotice(mode==='replay'?replayStartup.notice:mode==='combat'?combatStartup.notice:
   mode==='hostile'?hostileStartup.notice:startup.notice);
 };
 const startPlayableCombat=()=>{
  switchEncounter('replay');
  // The scene remains in its existing layout; move the viewport only after
  // the combat controls have rendered, and give keyboard users the board.
  requestAnimationFrame(()=>{
   // Center the actual playable board rather than the mode controls: on
   // narrow screens the guide and roster otherwise push the canvas below
   // the initial viewport despite scrolling to the controls.
   boardRef.current?.scrollIntoView({block:'center',behavior:'auto'});
   boardRef.current?.focus({preventScroll:true});
  });
 };
 const choose=(cell:string)=>{
  setSelected(cell);
  for(const id of ['science','security','medic'] as const)
   if(mission.locations[id]===cell){setOfficer(id);break;}
 };
 // First tap previews a destination or aims at a hostile. Repeating a tap
 // on the SAME reachable empty tile issues the next validated five-cell
 // stage; repeat to continue toward a distant destination. A living hostile
 // still fires on the second tap. AP, BFS, cover and LOS remain authoritative.
 // Roster, contact chips and keyboard selection remain selection-only.
 const onBoardPick=(cell:string)=>{
  if(replayMode&&cell===selected&&fireTarget&&fireReady&&
     replay?.encounter.positions[fireTarget]===cell){
   executeReplay({type:'fire',officer,hostile:fireTarget});
   return;
  }
  if(cell===selected&&available(move)){
   execute(move);
   return;
  }
  choose(cell);
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
 const endTurnButton=<button type="button" data-testid="scenario-end-turn"
  className={replayMode?'scenario-turn-overlay':undefined}
  disabled={mission.completed||!!combat?.failed||activeActions.length>=MAX_SCENARIO_COMMANDS}
  onClick={()=>execute({type:'end-turn'})}>
  {replayMode?'Fin de turno · +3 AP':'Fin de turno · recuperar 3 órdenes'}
 </button>;
 const objectives=[
  {key:'sensor',text:'Analizar señal',at:scenario.sensor,done:mission.scanned},
  ...(scenario.console?[{key:'console',text:'Operar terminal',at:scenario.console,done:mission.consoleOnline}]:[]),
  ...(scenario.survivor?[{key:'survivor',text:'Rescatar superviviente',at:scenario.survivor,done:mission.rescued}]:[]),
  {key:'extraction',text:'Extraer equipo',at:scenario.extraction,done:mission.completed},
 ];
 const hostileSelector=hostilePositions&&<div className="scenario-hostile-status" data-testid="scenario-hostile-status"
    aria-label={replay?.truce?'Contactos en tregua':replayMode?'Contactos enemigos · selecciona un objetivo':'Posiciones enemigas verificadas'}>
    {(['aegis','veil'] as const).map(id=>{
     const label=id==='aegis'?'Aegis':'Velo';
     const text=label+' '+hostilePositions[id]+(hostileHealth?' · PV '+hostileHealth[id]+'/'+COMBAT_HOSTILE_MAX_HP:'')+(replay?.truce?' · EN TREGUA':'');
     return replayMode
      ? <button key={id} type="button" data-testid={`scenario-hostile-${id}`}
       aria-label={`Seleccionar objetivo ${label} en ${hostilePositions[id]}`}
       aria-pressed={selected===hostilePositions[id]&&hostileHealth?.[id]!==0}
       disabled={hostileHealth?.[id]===0||!!replay?.victory||!!replay?.truce||!!replay?.encounter.failed}
       onClick={()=>choose(hostilePositions[id])}>{text}</button>
      : <span key={id} data-testid={`scenario-hostile-${id}`}>{text}</span>;
    })}
   </div>;
 // During live combat, the map and orders precede mission selection.
 // Advanced tools always follow the objectives, preserving their open state
 // when switching between live combat and training. DOM and visual order match.
 const missionSelector = !fieldEncounter && <div className="scenario-selector" role="group" aria-label="Elegir misión táctica">
   {order.map(id=><button key={id} type="button"
    data-testid={`scenario-tab-${id}`} aria-pressed={scenarioId===id}
    onClick={()=>change(id)}>
    <strong>{SCENARIOS[id].label}</strong>
    <span>{SCENARIOS[id].size} × {SCENARIOS[id].size} · {id==='relay'?'Comunicaciones':id==='derelict'?'Exploración / rescate':'Evacuación'}</span>
   </button>)}
  </div>;
 const viewTools = !fieldEncounter && <div className="scenario-viewtools">
   <strong className="scenario-primary-mode" data-testid="scenario-primary-mode">
    {replayMode?'Combate táctico · disparos, enemigos y negociación':
     'Modo de pruebas · inicia el combate táctico para jugar'}
   </strong>
   <details className="scenario-mode-advanced" data-testid="scenario-mode-advanced">
    <summary>Otras simulaciones · herramientas de prueba</summary>
    <div className="scenario-mode-select" role="group" aria-label="Modos históricos de pruebas tácticas">
    <button type="button" data-testid="scenario-training-toggle" aria-pressed={!hostileMode&&!combatMode&&!replayMode}
     onClick={()=>switchEncounter('training')}>Entrenamiento</button>
    <button type="button" data-testid="scenario-hostile-toggle" aria-pressed={hostileMode}
     onClick={()=>switchEncounter('hostile')}>Patrulla · sin daño</button>
    <button type="button" data-testid="scenario-combat-toggle" aria-pressed={combatMode}
     onClick={()=>switchEncounter('combat')}>Combate v3 · daño</button>
    <button type="button" data-testid="scenario-replay-toggle" aria-pressed={replayMode}
     onClick={()=>switchEncounter('replay')}>Combate completo</button>
    </div>
   </details>
   <button type="button" data-testid="scenario-focus-toggle" aria-pressed={focus}
    onClick={()=>setFocus(value=>!value)}>{focus?'Ver mapa completo':'Acercar cámara a la casilla'}</button>
   <span data-testid="scenario-camera-mode">{focus?'Detalle de casilla':'Vista táctica completa'} · {scenario.size} × {scenario.size}</span>
  </div>;
 return <section className="scenario-lab" data-testid="scenario-lab" aria-labelledby="scenario-heading">
  <header className="scenario-head">
   <span className="scenario-eyebrow">{fieldEncounter?'SUPERFICIE · CONTACTO HOSTIL':'OPERACIONES TÁCTICAS · LABORATORIO JUGABLE'}</span>
   <h2 id="scenario-heading">{fieldEncounter?'Asegura el perímetro del puesto':'Tres misiones, un equipo'}</h2>
   <p>{fieldEncounter?'Dos contactos armados vigilan el perímetro. Acerca a Seguridad para negociar un alto el fuego, o combate. El rescate médico es posible sin enfrentarse a nadie. Esta incursión es temporal.':'Elige un objetivo, despliega a la escuadra y resuelve la misión. Toca dos veces un destino libre para avanzar. Si está lejos, sigue tocándolo para recorrer la ruta en tramos de hasta cinco casillas, sin atravesar obstáculos.'}</p>
   {!fieldEncounter&&!replayMode&&<button className="scenario-play-combat" type="button"
    data-testid="scenario-play-combat" onClick={startPlayableCombat}>
    Jugar combate con disparos
   </button>}
  </header>
  {!replayMode&&missionSelector}
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
  {replayMode&&replay?.truce&&<p className="scenario-fire-guide" data-testid="scenario-truce" role="status">
   Alto el fuego aceptado: ambos contactos han dejado de atacar. Completa los objetivos y solicita extracción sin disparar.
  </p>}
  {replayMode&&!replay?.truce&&<p className="scenario-fire-guide" data-testid="scenario-fire-guide" role="status">
   <strong>Sobre el mapa:</strong> toca una casilla libre para ver la ruta y vuelve a tocarla para mover. Para disparar, selecciona un oficial y toca un enemigo. Tócalo otra vez para disparar, o usa el botón Disparar. O acerca a Seguridad a dos casillas o menos de un contacto vivo para pedir alto el fuego sin disparar.
   {fireTarget?(fireReady?' '+describeCombatAim(fireAim):activeActions.length>=MAX_SCENARIO_COMMANDS
    ?' Límite de órdenes alcanzado · reinicia el combate.'
    :fireAim?.allowed?' Orden de disparo no disponible en este turno.':' '+describeCombatAim(fireAim))
    :' Selecciona un contacto Aegis o Velo.'}
  </p>}
  <div className="scenario-roster" role="group" aria-label="Seleccionar oficial">
   {officers.map(unit=><button type="button" key={unit.id}
    data-testid={`scenario-unit-${unit.id}`} aria-pressed={officer===unit.id}
    disabled={mission.completed||!!combat?.failed}
    onClick={()=>{setOfficer(unit.id);setSelected(mission.locations[unit.id]);}}>
    <strong>{unit.name}</strong><span>{unit.role}</span>
    <small>{mission.locations[unit.id]}</small>
    {combat&&<small data-testid={`scenario-hp-${unit.id}`}>PV {combat.health[unit.id]} / {COMBAT_OFFICER_MAX_HP}</small>}
   </button>)}
  </div>
  <div onKeyDown={onKeyboard} className="scenario-board-shell" ref={boardRef} tabIndex={0}
   aria-label="Mapa táctico: usa las flechas para seleccionar una casilla" data-testid="scenario-keyboard">
   {replayMode&&hostileSelector}
   <IsoScenarioBoard key={scenarioId} scenario={scenario} mission={mission}
    selected={selected} focus={focus} route={route} hostilePositions={hostilePositions} hostileHealth={hostileHealth} shot={shot} officerHit={officerHit} aimPreview={aimPreview} onPick={onBoardPick}/>
   {replayMode&&endTurnButton}
   {replayMode&&<button className="scenario-fire-overlay" type="button" data-testid="scenario-fire"
    disabled={!fireReady}
    aria-label={replay?.truce?'Alto el fuego acordado':fireTarget
     ?fireReady?'Disparar a '+fireTarget:fireAim?.reason==='ready'
      ?'Orden de disparo no disponible en este turno'
      :fireTarget+': '+describeCombatAim(fireAim)
     :'Selecciona un enemigo para disparar'}
    title={fireTarget&&!fireReady?describeCombatAim(fireAim):undefined}
    onClick={()=>fireTarget&&executeReplay({type:'fire',officer,hostile:fireTarget})}>
    {compactCombatFireLabel(fireAim,fireTarget??null,fireReady,!!replay?.truce)}
   </button>}
  </div>
  <div className="scenario-cell-bar">
   <div><span>CASILLA ELEGIDA</span>
    <strong data-testid="scenario-selected">{selected}</strong>
    <small data-testid="scenario-route">{route&&route.length>1
     ?`Ruta: ${route.length-1} casillas${route.length>MAX_MOVE_STEPS+1?' · avanza por tramos de '+MAX_MOVE_STEPS:''}`
     :route?'Oficial en su casilla':'Sin ruta disponible'}</small>
   </div>
   {!replayMode&&hostileSelector}
   <div className="scenario-legend">
    <span> <i className="scenario-dot sci"/> Ciencia</span>
    <span> <i className="scenario-dot tech"/> Terminal</span>
    <span> <i className="scenario-dot evac"/> Extracción</span>
    <span> <i className="scenario-dot hostile"/> {replay?.truce?'Contacto en tregua':'Contacto hostil'}</span>
   </div>
  </div>
  <div className="scenario-orders" role="group" aria-label="Órdenes tácticas con resultados reales">
   <button type="button" data-testid="scenario-move" disabled={!available(move)}
    onClick={()=>execute(move)}>{route&&route.length>MAX_MOVE_STEPS+1
     ?`Avanzar ${MAX_MOVE_STEPS} casillas hacia ${selected}`:'Mover · máximo 5 casillas'}</button>
   {replayMode&&<button type="button" data-testid="scenario-parley" disabled={!parleyReady}
    onClick={()=>executeReplay({type:'parley',officer:'security'})}>Pedir alto el fuego · Seguridad a 2 casillas</button>}
   <button type="button" data-testid="scenario-scan" disabled={!available(scan)}
    onClick={()=>execute(scan)}>Escanear señal</button>
   <button type="button" data-testid="scenario-operate" disabled={!available(operate)}
    onClick={()=>execute(operate)}>Operar terminal</button>
   <button type="button" data-testid="scenario-rescue" disabled={!available(rescue)}
    onClick={()=>execute(rescue)}>Rescatar</button>
   <button type="button" data-testid="scenario-extract" disabled={!available(extract)}
    onClick={()=>execute(extract)}>Solicitar extracción</button>
   {!replayMode&&endTurnButton}
  </div>
  <p className="scenario-notice" data-testid="scenario-notice" role="status">{notice}</p>
  {combat&&(combat.failed||mission.completed||!!replay?.victory||!!replay?.truce)&&<section className="scenario-debrief"
   data-testid="scenario-combat-result" aria-label="Resultado del combate experimental">
   <strong>{combat.failed?'Escuadra incapacitada · combate terminado':fieldEncounter
    ?replay?.truce?'Alto el fuego acordado · continúa el rescate':replay?.victory?'Perímetro asegurado · continúa el rescate':'Incursión táctica finalizada · continúa el rescate'
    :mission.completed?'Extracción confirmada · misión completada':replay?.truce?'Alto el fuego acordado · completa objetivos y solicita extracción':'Amenazas neutralizadas · completa objetivos y solicita extracción'}</strong>
   <p>{fieldEncounter?(combat.failed?'La escuadra ha caído. El perímetro sigue siendo peligroso.':'El encuentro táctico ha terminado, pero los civiles aún necesitan asistencia médica en el puesto de socorro. Puedes continuar sin completar más objetivos del tablero.'):'Estado reconstruido del encuentro '+(replayMode?'v4':'v3')+'; no modifica el entrenamiento ni la campaña.'}</p>
   {fieldEncounter&&!combat.failed&&(replay?.truce||replay?.victory||mission.completed)&&onReturnToSurface&&
    <button type="button" className="scenario-resume-rescue" data-testid="scenario-resume-rescue"
     onClick={onReturnToSurface}>Continuar rescate en superficie ↩</button>}
   <button type="button" data-testid="scenario-combat-retry" onClick={()=>change(scenarioId)}>Reiniciar combate</button>
  </section>}
  <div className="scenario-objectives" data-testid="scenario-objectives">
   {objectives.map(item=><div key={item.key}
    className={item.done?'scenario-objective completed':'scenario-objective'}>
    <span aria-hidden="true">{item.done?'✓':'◇'}</span>
    <span>{item.text} <small>{item.at}</small></span>
   </div>)}
  </div>
  {replayMode&&missionSelector}
  {viewTools}
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
  {!hostileMode&&!combatMode&&!replayMode&&records.runs.length>0&&<details className="scenario-training-records" data-testid="scenario-training-records">
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
  <p className="scenario-disclaimer">{replayMode
   ?'Combate táctico · selecciona un oficial y después a un enemigo para disparar. Los disparos consumen una orden, los contactos derrotados desaparecen y la partida sobrevive a F5.'
   :combatMode
   ?'Combate experimental v3 · los contactos adyacentes causan un punto de daño al terminar el turno. Un oficial a 0 PV termina el encuentro. Sin contraataques ni curación todavía. Guardado independiente de v1, v2 y la campaña.'
   :hostileMode
   ?'Encuentro hostil experimental · los enemigos avanzan al terminar el turno y bloquean rutas. Las amenazas no causan heridas todavía. Guardado v2 separado del entrenamiento y de la campaña.'
   :'Simulador local de entrenamiento · progreso guardado independientemente de la campaña si el navegador lo permite. Los contactos hostiles son visuales; activa el encuentro experimental para probar sus turnos.'}</p>
 </section>;
}
