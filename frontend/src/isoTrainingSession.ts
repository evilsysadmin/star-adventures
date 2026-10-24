// Independent local archive of *training* bests; never modify official campaign saves.
import {
  emptyTrainingArchive, deserializeTrainingArchive, serializeTrainingArchive,
  type TrainingArchive,
} from './isoTrainingRecords.ts';

export const TRAINING_RECORD_KEY='shadowops.star-adventures.tactical-training.v1';

export function restoreTrainingRecords(storage:Pick<Storage,'getItem'>|null):{
  archive:TrainingArchive; notice:string;
} {
  if(!storage)return {archive:emptyTrainingArchive(),notice:'Archivo de maniobras temporal · sin almacenamiento'};
  try {
    const raw=storage.getItem(TRAINING_RECORD_KEY);
    if(raw===null)return {archive:emptyTrainingArchive(),notice:''};
    return {archive:deserializeTrainingArchive(raw),notice:''};
  }catch{
    // Incompatible/future versions are not silently downgraded or overwritten.
    return {archive:emptyTrainingArchive(),notice:'Archivo de maniobras incompatible · no se sobrescribirá'};
  }
}
export function persistTrainingRecords(archive:TrainingArchive,
  storage:Pick<Storage,'getItem'|'setItem'>|null):boolean {
  if(!storage)return false;
  try {
    const current=storage.getItem(TRAINING_RECORD_KEY);
    if(current!==null)deserializeTrainingArchive(current);
    storage.setItem(TRAINING_RECORD_KEY,serializeTrainingArchive(archive));
    return true;
  }catch{return false;}
}
