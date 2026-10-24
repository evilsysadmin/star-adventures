// Persistent *training* records from completed, replay-validated tactical missions.
// No official/covert campaign credit: these drills are independent simulations.
import {
  SCENARIOS, type ScenarioId, type MissionAction,
} from './isoScenarioCampaign.ts';
import {
  replayScenarioCommands, type ScenarioHistory,
} from './isoScenarioCheckpoint.ts';

export const TRAINING_RECORD_VERSION = 1;
export const MAX_TRAINING_RECORD_BYTES = 65536;
const scenarioOrder: readonly ScenarioId[] = ['relay', 'derelict', 'evacuation'];

export type TrainingRun = Readonly<{
  scenarioId: ScenarioId;
  actions: readonly MissionAction[];
}>;
export type TrainingArchive = Readonly<{
  version: 1;
  runs: readonly TrainingRun[];
}>;
export type TrainingResult = Readonly<{
  scenarioId: ScenarioId;
  label: string;
  rounds: number;
  orders: number;
  moves: number;
  scanned: boolean;
  operated: boolean;
  rescued: boolean;
  extracted: true;
}>;

const object = (v:unknown):v is Record<string,unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v:Record<string,unknown>, keys:readonly string[]) =>
  Object.keys(v).length===keys.length && keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const isScenarioId=(v:unknown):v is ScenarioId =>
  typeof v==='string' && Object.prototype.hasOwnProperty.call(SCENARIOS,v);

export function emptyTrainingArchive():TrainingArchive {
  return {version:TRAINING_RECORD_VERSION,runs:[]};
}
function validatedRun(input:unknown):TrainingRun {
  if(!object(input)||!exact(input,['scenarioId','actions'])||
     !isScenarioId(input.scenarioId)||!Array.isArray(input.actions))
    throw new TypeError('Malformed tactical training result');
  const actual=replayScenarioCommands(input.scenarioId,input.actions as MissionAction[]);
  if(!actual.state.completed)throw new TypeError('Unfinished tactical drill cannot earn a result');
  return {scenarioId:actual.scenarioId,actions:actual.actions};
}
function validatedArchive(input:unknown):TrainingArchive {
  if(!object(input)||!exact(input,['version','runs'])||
     input.version!==TRAINING_RECORD_VERSION||!Array.isArray(input.runs)||
     input.runs.length>scenarioOrder.length)
    throw new TypeError('Invalid training archive version or length');
  const runs=input.runs.map(validatedRun);
  if(new Set(runs.map(run=>run.scenarioId)).size!==runs.length)
    throw new TypeError('Duplicate tactical training result');
  runs.sort((a,b)=>scenarioOrder.indexOf(a.scenarioId)-scenarioOrder.indexOf(b.scenarioId));
  return {version:TRAINING_RECORD_VERSION,runs};
}
export function trainingResult(input:TrainingRun):TrainingResult {
  const run=validatedRun(input);
  const state=replayScenarioCommands(run.scenarioId,run.actions).state;
  return {
    scenarioId:run.scenarioId,label:SCENARIOS[run.scenarioId].label,
    rounds:state.round,
    orders:run.actions.filter(action=>action.type!=='end-turn').length,
    moves:run.actions.filter(action=>action.type==='move').length,
    scanned:state.scanned,operated:state.consoleOnline,
    rescued:state.rescued,extracted:true,
  };
}
function better(a:TrainingResult,b:TrainingResult) {
  return a.rounds<b.rounds || (a.rounds===b.rounds&&a.orders<b.orders);
}
export function addTrainingResult(archive:TrainingArchive, history:ScenarioHistory):TrainingArchive {
  const safeArchive=validatedArchive(archive);
  if(!object(history)||!isScenarioId(history.scenarioId))
    throw new TypeError('Unknown tactical result');
  const safeRun=validatedRun({scenarioId:history.scenarioId,actions:history.actions});
  const canonical=replayScenarioCommands(safeRun.scenarioId,safeRun.actions);
  if(JSON.stringify(history.state)!==JSON.stringify(canonical.state))
    throw new TypeError('Training result must match its actual replayed state');
  const existing=safeArchive.runs.find(run=>run.scenarioId===safeRun.scenarioId);
  if(existing&&!better(trainingResult(safeRun),trainingResult(existing)))return safeArchive;
  return validatedArchive({
    version:TRAINING_RECORD_VERSION,
    runs:[...safeArchive.runs.filter(run=>run.scenarioId!==safeRun.scenarioId),safeRun],
  });
}
export function serializeTrainingArchive(archive:TrainingArchive):string {
  const raw=JSON.stringify(validatedArchive(archive));
  if(raw.length>MAX_TRAINING_RECORD_BYTES)throw new RangeError('Training archive too large');
  return raw;
}
export function deserializeTrainingArchive(raw:string):TrainingArchive {
  if(typeof raw!=='string'||raw.length>MAX_TRAINING_RECORD_BYTES)
    throw new TypeError('Invalid training archive payload');
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new TypeError('Malformed training archive JSON');}
  return validatedArchive(parsed);
}
