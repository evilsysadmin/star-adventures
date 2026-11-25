import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBrowserTimingLog,refreshBrowserTimings} from '../scripts/refresh-browser-shard-timings.mjs';
const files=Array.from({length:5},(_,i)=>'spec-'+(i+1)+'.spec.ts');
const log=(i,file=files[i-1],duration='12s')=>[
 '2026-11-25T22:13:07Z Playwright '+i+'/5: 1 spec files, 40 seconds historic workload',
 '2026-11-25T22:13:35Z   ✓  1 tests/'+file+':23:3 › test ('+duration+')',
 '2026-11-25T22:13:40Z   1 passed (12.8s)',
].join('\n');
const logs=files.map((_,i)=>log(i+1));
const prior={_fallbackSeconds:40,specSeconds:{[files[0]]:20}};
test('parse timestamped GitHub output and minute/millisecond durations',()=>{
 assert.equal(parseBrowserTimingLog(log(1,files[0],'1.2m')).seconds.get(files[0]),72);
 assert.equal(parseBrowserTimingLog(log(1,files[0],'50ms')).seconds.get(files[0]),.05);
 assert.equal(parseBrowserTimingLog(log(1)).tests,1);
});
test('proposal covers every checkout spec without mutating prior weights',()=>{
 const snapshot=JSON.stringify(prior);
 const result=refreshBrowserTimings(logs,files,prior,'123');
 assert.deepEqual(Object.keys(result.proposal.specSeconds),files);
 assert.equal(result.proposal.specSeconds[files[0]],13);
 assert.equal(result.proposal.specSeconds[files[1]],12);
 assert.equal(result.proposal._fallbackSeconds,40);
 assert.equal(JSON.stringify(prior),snapshot);
 assert.deepEqual(refreshBrowserTimings(logs.slice().reverse(),files,prior,'123'),result);
});
test('rejects partial, failed, duplicate or checkout-incompatible input',()=>{
 assert.throws(()=>parseBrowserTimingLog(log(1).replace('1 passed','2 passed')),/Incomplete/);
 assert.throws(()=>parseBrowserTimingLog(log(1).replace('✓','✘')),/Failed/);
 assert.throws(()=>refreshBrowserTimings(logs.slice(1),files,prior,'123'),/five logs/);
 assert.throws(()=>refreshBrowserTimings([...logs.slice(0,4),logs[0]],files,prior,'123'),/Duplicate browser shard/);
 assert.throws(()=>refreshBrowserTimings([...logs.slice(0,4),log(5,files[0])],files,prior,'123'),/Duplicate browser spec/);
 assert.throws(()=>refreshBrowserTimings(logs,[...files,'new.spec.ts'],prior,'123'),/checkout/);
});
