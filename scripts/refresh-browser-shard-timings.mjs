// Offline operator tool. Use logs from one completed successful main CI run:
// gh run view RUN_ID --job JOB_ID --log > shard-N.log (repeat for all five browser jobs)
// node scripts/refresh-browser-shard-timings.mjs RUN_ID shard-{1,2,3,4,5}.log > /tmp/timings.json
// Inspect the proposal before replacing browser-shard-timings.json. This tool
// never accesses GitHub, changes test selection, writes repository files or deploys.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {findBrowserSpecs,planBrowserShards} from './run-browser-shard.mjs';

export function parseBrowserTimingLog(raw){
 const text=raw.replace(/\x1b\[[0-9;]*m/g,'');
 const lines=text.split(/\r?\n/);
 const headers=lines.flatMap(line=>[...line.matchAll(/Playwright ([1-5])\/5: (\d+) spec files,/g)]);
 if(headers.length!==1)throw new Error('Expected one five-shard browser header');
 const index=Number(headers[0][1]),expectedSpecs=Number(headers[0][2]);
 const seconds=new Map();let tests=0;
 for(const line of lines){
  if(/[✘×]\s+\d+\s+tests\//.test(line))throw new Error('Failed or retried test: use a clean successful run');
  if(!/✓\s+\d+\s+tests\//.test(line))continue;
  const match=line.match(/tests\/(.+?\.spec\.ts):\d+:\d+.*\(([\d.]+)(ms|s|m)\)\s*$/);
  if(!match)throw new Error('Unrecognized passed-test timing');
  const duration=Number(match[2])*(match[3]==='ms'?.001:match[3]==='m'?60:1);
  if(!Number.isFinite(duration)||duration<0)throw new Error('Invalid test duration');
  seconds.set(match[1],(seconds.get(match[1])??0)+duration);tests++;
 }
 const summaries=lines.flatMap(line=>[...line.matchAll(/(?:^|\s)(\d+) passed \([\d.]+(?:ms|s|m)\)\s*$/g)]);
 if(summaries.length!==1||Number(summaries[0][1])!==tests||!tests||seconds.size!==expectedSpecs)
  throw new Error('Incomplete or inconsistent browser log');
 return {index,tests,seconds};
}

export function refreshBrowserTimings(logs,files,prior,runId){
 if(!/^[1-9]\d*$/.test(String(runId))||logs.length!==5||new Set(files).size!==files.length)
  throw new Error('Expected five logs, unique specs and a numeric run ID');
 const measured=new Map(),shards=new Set();let tests=0;
 for(const raw of logs){
  const parsed=parseBrowserTimingLog(raw);
  if(shards.has(parsed.index))throw new Error('Duplicate browser shard');
  shards.add(parsed.index);tests+=parsed.tests;
  for(const [file,seconds] of parsed.seconds){
   if(measured.has(file))throw new Error('Duplicate browser spec: '+file);
   measured.set(file,seconds);
  }
 }
 if(measured.size!==files.length||files.some(file=>!measured.has(file)))
  throw new Error('Measured specs do not match current checkout');
 const specSeconds=Object.fromEntries([...files].sort().map(file=>{
  const fresh=measured.get(file),old=prior.specSeconds?.[file];
  const weight=Number.isFinite(old)&&old>0?.85*fresh+.15*old:fresh;
  return [file,Math.max(1,Math.round(weight))];
 }));
 const fallback=prior._fallbackSeconds;
 const before=planBrowserShards(files,prior.specSeconds,5,fallback);
 const after=planBrowserShards(files,specSeconds,5,fallback);
 const load=plan=>plan.map(shard=>Math.round(shard.files.reduce((sum,file)=>sum+measured.get(file),0)));
 return {proposal:{
  _source:'Operator-supplied successful main CI run '+runId+'; '+tests+' reported browser tests across '+files.length+' specs',
  _units:'85% latest measured test seconds/spec + 15% prior weight where available; new specs use measured seconds; clean run only',
  _fallbackSeconds:fallback,specSeconds,
 },before:load(before),after:load(after)};
}

function main(){
 const [runId,...paths]=process.argv.slice(2);
 if(paths.length!==5)throw new Error('Usage: node scripts/refresh-browser-shard-timings.mjs RUN_ID LOG1 LOG2 LOG3 LOG4 LOG5');
 const root=resolve(import.meta.dirname,'..');
 const files=findBrowserSpecs(join(root,'frontend','tests'));
 const prior=JSON.parse(readFileSync(join(root,'scripts','browser-shard-timings.json'),'utf8'));
 const result=refreshBrowserTimings(paths.map(path=>readFileSync(path,'utf8')),files,prior,runId);
 console.error('Modeled cumulative test seconds: '+result.before.join(', ')+' -> '+result.after.join(', '));
 process.stdout.write(JSON.stringify(result.proposal,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
