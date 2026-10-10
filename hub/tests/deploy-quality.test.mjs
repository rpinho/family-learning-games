import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityGroups,runQualityChecks} from '../../scripts/deploy/quality-checks.mjs';
const files=['book/tests/example.test.mjs','hub/tests/audio-exits.test.mjs','hub/tests/example.test.mjs'];
const tap=(pass,fail=0,cancelled=0)=>'# pass '+pass+'\n# fail '+fail+'\n# cancelled '+cancelled+'\n';
test('every source test runs exactly once and audio is isolated before the remaining suite',()=>{
 const groups=qualityGroups(files);assert.deepEqual(groups.map(g=>g.concurrency),[1,2]);
 assert.deepEqual(groups[0].files,[files[1]]);assert.deepEqual(groups[1].files,[files[0],files[2]]);
 assert.deepEqual(groups.flatMap(g=>g.files).sort(),[...files].sort());
});
test('both groups must pass and their test counts share a single deadline',()=>{
 const calls=[];let clock=0;
 const r=runQualityChecks(files,{cwd:'/synthetic',executable:'node',timeoutMs:1000,now:()=>clock,spawn:(exe,args,opts)=>{calls.push({exe,args,opts});clock+=200;return {status:0,stdout:tap(calls.length===1?1:42),stderr:''};}});
 assert.equal(r.ok,true);assert.equal(r.pass,43);assert.equal(r.fail,0);
 assert.deepEqual(calls.map(c=>c.opts.timeout),[1000,800]);assert.ok(calls[0].args.includes('--test-concurrency=1'));assert.ok(calls[1].args.includes('--test-concurrency=2'));
 assert.ok(calls.every(c=>c.opts.cwd==='/synthetic'));
});
test('an isolated audio failure stops validation without running or crediting the bulk suite',()=>{
 let calls=0;const r=runQualityChecks(files,{spawn:()=>{calls++;return {status:1,stdout:'not ok 1 - audio\n'+tap(0,1),stderr:'timing detail'};}});
 assert.equal(r.ok,false);assert.equal(calls,1);assert.equal(r.pass,0);assert.match(r.stderr,/timing detail/);
});
test('a bulk failure cannot be hidden by a passing isolated audio check',()=>{
 let calls=0;const r=runQualityChecks(files,{spawn:()=>++calls===1?{status:0,stdout:tap(1)}:{status:1,stdout:'not ok 1 - model\n'+tap(7,1)}});
 assert.equal(r.ok,false);assert.equal(calls,2);assert.equal(r.pass,8);assert.match(r.stdout,/not ok 1 - model/);
});
test('canceled, incomplete and timed-out executions refuse validation',()=>{
 for(const result of [{status:0,stdout:tap(1,0,1)},{status:0,stdout:'incomplete'},{status:null,error:Error('timed out'),stdout:''}]){
  const r=runQualityChecks(files,{spawn:()=>result});assert.equal(r.ok,false);
 }
 let calls=0,clock=0;const r=runQualityChecks(files,{timeoutMs:100,now:()=>clock,spawn:()=>{calls++;clock=101;return {status:0,stdout:tap(1)};}});
 assert.equal(r.ok,false);assert.equal(calls,1);assert.match(r.stderr,/shared time budget/);
});
test('a suite without the timing-sensitive file still runs completely and empty suites never pass',()=>{
 assert.deepEqual(qualityGroups([files[0],files[2]]),[{files:[files[0],files[2]],concurrency:2}]);
 assert.equal(runQualityChecks([]).ok,false);
});
