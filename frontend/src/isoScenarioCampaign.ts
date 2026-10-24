// Independent authored sandbox missions: pure state, no WebGL, network, RNG or saves.
// Existing 8×8 tactical-training contract remains authoritative for the legacy POC.
export type ScenarioId = 'relay' | 'derelict' | 'evacuation';
export type SquadId = 'science' | 'security' | 'medic';
export type ScenarioHostile = Readonly<{
  id: 'aegis' | 'veil'; label: string; cell: string;
}>;
export type MissionAction =
  | { type: 'move'; officer: SquadId; cell: string }
  | { type: 'scan'; officer: 'science' }
  | { type: 'operate'; officer: 'security' }
  | { type: 'rescue'; officer: 'medic' }
  | { type: 'extract'; officer: SquadId }
  | { type: 'end-turn' };
export type Scenario = Readonly<{
  id: ScenarioId; label: string; briefing: string;
  size: 8 | 10 | 12; walls: readonly string[]; cover: readonly string[];
  start: Readonly<Record<SquadId,string>>;
  hostiles: readonly ScenarioHostile[];
  sensor: string; console: string | null; survivor: string | null; extraction: string;
}>;
export type MissionState = Readonly<{
  scenarioId: ScenarioId; locations: Readonly<Record<SquadId,string>>;
  round: number; ap: number;
  scanned: boolean; consoleOnline: boolean; rescued: boolean; completed: boolean;
  events: readonly string[];
}>;
const ids: readonly SquadId[] = ['science','security','medic'];
const wall = (column:number,rows:readonly number[]) => rows.map(row=>`${column}:${row}`);
export const SCENARIOS: Readonly<Record<ScenarioId,Scenario>> = Object.freeze({
 relay:{
  id:'relay',label:'Repetidor silencioso',size:10,
  briefing:'Recupera telemetría, restablece el repetidor y alcanza la baliza de extracción.',
  walls:wall(4,[0,1,2,3,4,5,6]),cover:['2:3','3:6','6:4','7:4','7:8'],
  start:{science:'1:1',security:'1:4',medic:'1:7'},
  hostiles:[{id:'aegis',label:'Incursor Aegis',cell:'6:6'},{id:'veil',label:'Agente Velo',cell:'8:5'}],
  sensor:'8:1',console:'8:7',survivor:null,extraction:'9:9',
 },
 derelict:{
  id:'derelict',label:'Instalación abandonada',size:12,
  briefing:'Explora el complejo, restablece seguridad y rescata a la superviviente.',
  walls:[...wall(5,[1,2,3,4,6,7,8,9]),...wall(8,[3,4,5,6])],
  cover:['3:3','4:7','6:8','7:2','9:7','10:4','2:9'],
  start:{science:'1:1',security:'2:1',medic:'1:3'},
  hostiles:[{id:'aegis',label:'Incursor Aegis',cell:'7:6'},{id:'veil',label:'Agente Velo',cell:'10:6'}],
  sensor:'9:1',console:'9:9',survivor:'10:10',extraction:'11:11',
 },
 evacuation:{
  id:'evacuation',label:'Evacuación en el cañón',size:10,
  briefing:'Localiza la señal vital, rescata al explorador y llega al transporte.',
  walls:[...wall(4,[2,3,4,6,7]),'6:3','6:4'],
  cover:['2:4','3:7','5:5','7:6','8:2'],
  start:{science:'1:1',security:'1:3',medic:'2:1'},
  hostiles:[{id:'aegis',label:'Incursor Aegis',cell:'7:7'},{id:'veil',label:'Agente Velo',cell:'8:5'}],
  sensor:'7:1',console:null,survivor:'8:7',extraction:'9:9',
 },
});
const point=(value:string,size:number):{x:number;y:number}|null=>{
 if(!/^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(value))return null;
 const [x,y]=value.split(':').map(Number);
 return Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&x<size&&y<size?{x,y}:null;
};
const distance=(a:string,b:string,size:number)=>{
 const p=point(a,size),q=point(b,size);
 if(!p||!q)throw new RangeError('Invalid scenario tile');
 return Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
};
const blocked=(scenario:Scenario)=>new Set([
 ...scenario.walls,...scenario.cover,scenario.sensor,
 ...(scenario.console?[scenario.console]:[]),
 ...(scenario.survivor?[scenario.survivor]:[]),
]);
export function validateScenario(scenario:Scenario):void {
 if(!scenario||![8,10,12].includes(scenario.size))throw new TypeError('Unsupported scenario board');
 const occupied=[...scenario.walls,...scenario.cover,scenario.sensor,scenario.extraction,
  ...(scenario.console?[scenario.console]:[]),...(scenario.survivor?[scenario.survivor]:[]),
  ...ids.map(id=>scenario.start[id]),...scenario.hostiles.map(hostile=>hostile.cell)];
 if(occupied.some(at=>!point(at,scenario.size))||new Set(occupied).size!==occupied.length)
  throw new TypeError('Scenario objects must be on unique valid tiles');
 if(!Array.isArray(scenario.hostiles)||scenario.hostiles.length!==2||
   new Set(scenario.hostiles.map(hostile=>hostile.id)).size!==2||
   scenario.hostiles.some(hostile=>!hostile||!['aegis','veil'].includes(hostile.id)||!hostile.label))
  throw new TypeError('Scenario must define two original hostile contacts');
}
export function createMission(scenarioId:ScenarioId):MissionState {
 const scenario=SCENARIOS[scenarioId];
 if(!scenario)throw new RangeError('Unknown scenario');
 validateScenario(scenario);
 return {scenarioId,locations:{...scenario.start},round:1,ap:3,
  scanned:false,consoleOnline:false,rescued:false,completed:false,events:[]};
}
export function validateMission(state:MissionState):void {
 if(!state||!SCENARIOS[state.scenarioId])throw new TypeError('Invalid mission');
 const scenario=SCENARIOS[state.scenarioId],seen=new Set<string>();
 for(const officer of ids){
  const at=state.locations?.[officer];
  if(!at||!point(at,scenario.size)||blocked(scenario).has(at)||seen.has(at))
   throw new TypeError('Invalid or overlapping squad');
  seen.add(at);
 }
 if(!Number.isInteger(state.round)||state.round<1||!Number.isInteger(state.ap)||state.ap<0||state.ap>3||
  typeof state.scanned!=='boolean'||typeof state.consoleOnline!=='boolean'||
  typeof state.rescued!=='boolean'||typeof state.completed!=='boolean'||!Array.isArray(state.events))
   throw new TypeError('Invalid mission flags');
 if((state.consoleOnline&&!state.scanned)||(state.rescued&&(!state.scanned||(!!scenario.console&&!state.consoleOnline)))||
    (state.completed&&(!state.scanned||(!!scenario.console&&!state.consoleOnline)||
     (!!scenario.survivor&&!state.rescued))))throw new TypeError('Impossible mission progress');
}
const steps=[[0,-1],[1,0],[0,1],[-1,0]] as const;
export function missionPath(
 state:MissionState,officer:SquadId,destination:string,
 additionalBlocked:readonly string[]=[]
):readonly string[]|null {
 validateMission(state);
 const def=SCENARIOS[state.scenarioId],origin=state.locations[officer];
 if(!origin||!point(destination,def.size))return null;
 if(origin===destination)return [origin];
 const obstacles=blocked(def);
 for(const id of ids)if(id!==officer)obstacles.add(state.locations[id]);
 // Opt-in occupied cells (e.g. hostile contacts) participate in BFS itself.
 // Legacy callers omit this argument and keep the original route contract.
 for(const cell of additionalBlocked)obstacles.add(cell);
 if(obstacles.has(destination))return null;
 const parent=new Map<string,string|null>([[origin,null]]),queue=[origin];
 for(let i=0;i<queue.length;i++){
  const current=queue[i];
  if(current===destination)break;
  const p=point(current,def.size)!;
  for(const [dx,dy] of steps){
   const x=p.x+dx,y=p.y+dy,cell=`${x}:${y}`;
   if(x>=0&&y>=0&&x<def.size&&y<def.size&&!obstacles.has(cell)&&!parent.has(cell)){
    parent.set(cell,current);queue.push(cell);
   }
  }
 }
 if(!parent.has(destination))return null;
 const route:string[]=[];let at:string|null=destination;
 while(at!==null){route.push(at);at=parent.get(at)??null;}
 return route.reverse();
}
export function applyMissionAction(
 state:MissionState,action:MissionAction,additionalBlocked:readonly string[]=[]
):MissionState {
 validateMission(state);
 if(state.completed)throw new RangeError('Mission already completed');
 const def=SCENARIOS[state.scenarioId];
 if(action.type==='end-turn')return {...state,round:state.round+1,ap:3,
   events:[...state.events,`Turno ${state.round+1}: nueva orden`]};
 if(state.ap<1)throw new RangeError('No action points remaining');
 const officer=action.officer;
 if(!ids.includes(officer))throw new RangeError('Unknown officer');
 const at=state.locations[officer];
 let update:Partial<MissionState>={};let log:string;
 switch(action.type){
  case 'move':{
   const route=missionPath(state,officer,action.cell,additionalBlocked);
   if(!route||route.length<2||route.length>6)
    throw new RangeError('Destination blocked, unchanged or beyond 5-step allowance');
   update={locations:{...state.locations,[officer]:action.cell}};
   log=`${officer}: marcha ${route.length-1} casillas hasta ${action.cell}`;break;
  }
  case 'scan':{
   if(officer!=='science'||state.scanned||distance(at,def.sensor,def.size)>2)
    throw new RangeError('Science officer must be near unscanned sensor');
   update={scanned:true};log='Científica: telemetría recuperada';break;
  }
  case 'operate':{
   if(officer!=='security'||!def.console||!state.scanned||state.consoleOnline||
      distance(at,def.console,def.size)>1)
    throw new RangeError('Security must operate reachable console after scanning');
   update={consoleOnline:true};log='Seguridad: controles restablecidos';break;
  }
  case 'rescue':{
   if(officer!=='medic'||!def.survivor||!state.scanned||
      (!!def.console&&!state.consoleOnline)||state.rescued||
      distance(at,def.survivor,def.size)>1)
    throw new RangeError('Medic must reach survivor after prerequisites');
   update={rescued:true};log='Médica: superviviente asegurada';break;
  }
  case 'extract':{
   if(at!==def.extraction||!state.scanned||(!!def.console&&!state.consoleOnline)||
      (!!def.survivor&&!state.rescued))
    throw new RangeError('Extraction requires objectives and an officer on beacon');
   update={completed:true};log='Extracción confirmada; misión completada';break;
  }
  default:throw new RangeError('Unknown mission action');
 }
 return {...state,...update,ap:state.ap-1,events:[...state.events,log]};
}
