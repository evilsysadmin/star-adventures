import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyTrainingArchive } from '../src/isoTrainingRecords.ts';
import { TRAINING_RECORD_KEY,restoreTrainingRecords,persistTrainingRecords } from '../src/isoTrainingSession.ts';
test('training archive uses a dedicated key and recovers a valid empty archive',()=>{
 const memory=new Map();
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const initial=restoreTrainingRecords(storage);
 assert.equal(initial.notice,'');
 assert.deepEqual(initial.archive,emptyTrainingArchive());
 assert.equal(persistTrainingRecords(initial.archive,storage),true);
 assert.deepEqual(restoreTrainingRecords(storage).archive,emptyTrainingArchive());
 assert.deepEqual([...memory.keys()],[TRAINING_RECORD_KEY]);
});
test('incompatible future archive is not silently overwritten',()=>{
 let writes=0;
 const storage={getItem:()=>JSON.stringify({version:2,runs:[]}),setItem:()=>{writes++;}};
 assert.match(restoreTrainingRecords(storage).notice,/incompatible/);
 assert.equal(persistTrainingRecords(emptyTrainingArchive(),storage),false);
 assert.equal(writes,0);
});
test('corrupt records and storage read/write errors degrade to temporary records',()=>{
 for(const broken of ['{',JSON.stringify({version:1,runs:[{scenarioId:'evacuation',actions:[]}]})]){
  let writes=0;
  const storage={getItem:()=>broken,setItem:()=>{writes++;}};
  assert.match(restoreTrainingRecords(storage).notice,/incompatible/);
  assert.equal(persistTrainingRecords(emptyTrainingArchive(),storage),false);
  assert.equal(writes,0);
 }
 assert.match(restoreTrainingRecords(null).notice,/temporal/);
 assert.equal(persistTrainingRecords(emptyTrainingArchive(),null),false);
 const unavailable={getItem:()=>{throw Error('security')},setItem:()=>{throw Error('quota')}};
 assert.match(restoreTrainingRecords(unavailable).notice,/incompatible/);
 assert.equal(persistTrainingRecords(emptyTrainingArchive(),unavailable),false);
 const writeBlocked={getItem:()=>null,setItem:()=>{throw Error('quota')}};
 assert.equal(persistTrainingRecords(emptyTrainingArchive(),writeBlocked),false);
});
