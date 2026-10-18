import {spawnSync} from 'node:child_process';
import {isAbsolute,relative} from 'node:path';

// Timing-sensitive browser audio assertions run without another test file consuming CPU, at NORMAL priority.
// The bulk suite runs at background priority so it never competes with the children's play. Every file still runs,
// with its original assertions and one shared wall-clock budget. (10-16: the whole promote ran under nice 19 +
// taskpolicy -b, so audio-exits lost its 150 ms budget to the agents' test runs and refused a one-line fix four times.)
export function qualityGroups(files){
 const audio=files.filter(f=>/(^|\/)audio-exits\.test\.mjs$/.test(f));
 const rest=files.filter(f=>!audio.includes(f));
 return [...(audio.length?[{files:audio,concurrency:1,background:false}]:[]),...(rest.length?[{files:rest,concurrency:2,background:true}]:[])];
}
export const BACKGROUND=['nice','-n','19','taskpolicy','-b'];
// A test that fails only because the machine was busy gets ONE rerun of its own file, alone, at normal priority, before
// the gate refuses (10-18: 30 refusals in 3 days, nearly all audio-exits and the room-fit sweep under load ≈11; every
// one passed when rerun alone by hand). Only failures whose TAP location names a file of this group are retried, at most
// RETRY_FILE_LIMIT files; the rerun must pass completely, so a real break fails twice and is still refused.
export const RETRY_FILE_LIMIT=3,RETRY_BUDGET_MS=15*60*1000;
export function failingFiles(stdout,files,cwd){
 const out=new Map(),lines=String(stdout||'').split('\n');
 for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^not ok \d+ - (.*)$/);if(!m)continue;
  let file=null;
  for(let j=i+1;j<lines.length&&!/^\s*\.\.\.\s*$/.test(lines[j])&&!/^(not )?ok \d+ /.test(lines[j]);j++){
   const loc=lines[j].match(/^\s+location: '(.+):\d+:\d+'$/);if(!loc)continue;
   const rel=isAbsolute(loc[1])&&cwd?relative(cwd,loc[1]):loc[1];if(files.includes(rel))file=rel;break;
  }
  if(!file)return null;
  out.set(file,[...(out.get(file)||[]),m[1]]);
 }
 return out.size?out:null;
}
export function runQualityChecks(files,{cwd,executable=process.execPath,spawn=spawnSync,now=Date.now,timeoutMs=30*60*1000,background=BACKGROUND}={}){
 const started=now(),results=[],retried=[];let pass=0,fail=0;
 const tally=r=>{const count=label=>Number((String(r.stdout||'').match(new RegExp('^# '+label+' (\\d+)$','m'))||[])[1]);return {passed:count('pass'),failed:count('fail'),cancelled:count('cancelled')};};
 const clean=(r,t)=>r.status===0&&!r.error&&Number.isFinite(t.passed)&&t.failed===0&&t.cancelled===0;
 const refuse=()=>({ok:false,pass,fail,retried,stdout:results.map(x=>x.stdout||'').join('\n'),stderr:results.map(x=>x.stderr||x.error?.message||'').join('\n')});
 for(const group of qualityGroups(files)){
  const remaining=timeoutMs-(now()-started);
  if(remaining<=0)return {ok:false,pass,fail:Number(undefined),retried,stdout:results.map(r=>r.stdout||'').join('\n'),stderr:'Quality checks exhausted their shared time budget.'};
  const args=['--test','--test-concurrency='+group.concurrency,'--test-reporter=tap',...group.files],[exe,...pre]=group.background&&background?.length?background:[executable];
  const r=spawn(exe,[...pre,...(group.background&&background?.length?[executable]:[]),...args],{cwd,encoding:'utf8',maxBuffer:1<<26,timeout:remaining});results.push(r);
  const t=tally(r);
  pass+=Number.isFinite(t.passed)?t.passed:0;fail+=t.failed;
  if(clean(r,t))continue;
  // No retry for a crash, a timed-out run, an unparsed result or failures outside this group's files.
  const failing=!r.error&&Number.isFinite(t.passed)&&failingFiles(r.stdout,group.files,cwd);
  if(!failing||failing.size>RETRY_FILE_LIMIT)return refuse();
  const again=[...failing.keys()],budget=timeoutMs-(now()-started)+RETRY_BUDGET_MS;
  const r2=spawn(executable,['--test','--test-concurrency=1','--test-reporter=tap',...again],{cwd,encoding:'utf8',maxBuffer:1<<26,timeout:budget});
  r2.stdout='# RETRY alone at normal priority after a failure under load: '+again.join(' ')+'\n'+(r2.stdout||'');results.push(r2);
  if(!clean(r2,tally(r2)))return refuse();
  for(const [file,tests]of failing)retried.push({file,tests});
  const healed=(t.failed||0)+(t.cancelled||0);pass+=healed;fail-=t.failed||0;
 }
 return {ok:results.length>0,pass,fail,retried,stdout:results.map(r=>r.stdout||'').join('\n'),stderr:results.map(r=>r.stderr||'').join('\n')};
}
