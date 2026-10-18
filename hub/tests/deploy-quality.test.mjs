import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityGroups,runQualityChecks,failingFiles,RETRY_BUDGET_MS} from '../../scripts/deploy/quality-checks.mjs';
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
 assert.deepEqual(qualityGroups([files[0],files[2]]),[{files:[files[0],files[2]],concurrency:2,background:true}]);
 assert.equal(runQualityChecks([]).ok,false);
});
test('the timing-sensitive audio group runs at normal priority; the bulk suite runs in the background (10-16)',()=>{
 const calls=[];runQualityChecks(files,{cwd:'/w',executable:'node',spawn:(exe,args)=>{calls.push([exe,...args]);return {status:0,stdout:tap(1)};}});
 assert.equal(calls[0][0],'node');assert.ok(calls[0].includes('hub/tests/audio-exits.test.mjs'));
 assert.deepEqual(calls[1].slice(0,6),['nice','-n','19','taskpolicy','-b','node']);assert.ok(calls[1].includes('book/tests/example.test.mjs'));
});
// 10-18: a failure under load gets one rerun of its own file, alone, at normal priority; a real break still refuses.
const failure=(n,name,file,extra='')=>'not ok '+n+' - '+name+'\n  ---\n  duration_ms: 420007\n  location: \'/w/'+file+':23:1\'\n'+extra+'  ...\n';
test('a bulk failure under load passes after its own file passes alone at normal priority (10-18)',()=>{
 const calls=[];const r=runQualityChecks(files,{cwd:'/w',executable:'node',spawn:(exe,args,opts)=>{calls.push({exe,args,opts});
  if(calls.length===1)return {status:0,stdout:tap(1)};
  if(calls.length===2)return {status:1,stdout:'ok 1 - fine\n'+failure(2,'every room fits','hub/tests/example.test.mjs','  failureType: \'testTimeoutFailure\'\n')+tap(41,0,1)};
  return {status:0,stdout:tap(3)};}});
 assert.equal(r.ok,true);assert.equal(calls.length,3);assert.equal(r.pass,43);assert.equal(r.fail,0);
 assert.equal(calls[2].exe,'node');assert.deepEqual(calls[2].args,['--test','--test-concurrency=1','--test-reporter=tap','hub/tests/example.test.mjs']);
 assert.deepEqual(r.retried,[{file:'hub/tests/example.test.mjs',tests:['every room fits']}]);
 assert.match(r.stdout,/# RETRY alone at normal priority/);
});
test('the isolated audio check also gets one rerun, and a second failure refuses (10-18)',()=>{
 let calls=0;const fails={status:1,stdout:failure(1,'all exits silence','hub/tests/audio-exits.test.mjs')+tap(0,1)};
 const r=runQualityChecks(files,{cwd:'/w',spawn:()=>(++calls,fails)});
 assert.equal(r.ok,false);assert.equal(calls,2);assert.deepEqual(r.retried,[]);
 let n=0;const ok=runQualityChecks(files,{cwd:'/w',spawn:()=>++n===1?fails:{status:0,stdout:tap(n===2?1:42)}});
 assert.equal(ok.ok,true);assert.equal(n,3);assert.equal(ok.pass,43);
});
test('no rerun for unlocated failures, failures outside the group, too many files, crashes or timeouts (10-18)',()=>{
 const many=['a','b','c','d'].map(x=>'hub/tests/'+x+'.test.mjs');
 const cases=[
  [files,{status:1,stdout:'not ok 1 - model\n'+tap(7,1)}],
  [files,{status:1,stdout:failure(1,'elsewhere','hub/tests/other.test.mjs')+tap(7,1)}],
  [many,{status:1,stdout:many.map((f,i)=>failure(i+1,'t'+i,f)).join('')+tap(3,4)}],
  [files,{status:null,error:Error('timed out'),stdout:failure(1,'x','hub/tests/example.test.mjs')+tap(1,1)}],
  [files,{status:1,stdout:failure(1,'x','hub/tests/example.test.mjs')}],
 ];
 for(const [list,bad]of cases){let calls=0;const r=runQualityChecks(list,{cwd:'/w',spawn:()=>++calls===1&&list===files?{status:0,stdout:tap(1)}:bad});
  assert.equal(r.ok,false);assert.equal(calls,list===files?2:1);}
});
test('the rerun gets its own extra budget beyond the shared deadline (10-18)',()=>{
 const timeouts=[];let clock=0;const r=runQualityChecks(files,{cwd:'/w',timeoutMs:1000,now:()=>clock,spawn:(exe,args,opts)=>{timeouts.push(opts.timeout);clock+=400;
  return timeouts.length===2?{status:1,stdout:failure(1,'x','hub/tests/example.test.mjs')+tap(5,1)}:{status:0,stdout:tap(1)};}});
 assert.equal(r.ok,true);assert.deepEqual(timeouts,[1000,600,200+RETRY_BUDGET_MS]);
});
test('failingFiles maps TAP locations to the group files and rejects anything unlocated',()=>{
 const f=['hub/tests/example.test.mjs'];
 assert.deepEqual([...failingFiles(failure(1,'a',f[0])+failure(2,'b',f[0]),f,'/w')],[[f[0],['a','b']]]);
 assert.equal(failingFiles('not ok 1 - a\n  ---\n  ...\n',f,'/w'),null);
 assert.equal(failingFiles(tap(3),f,'/w'),null);
});
