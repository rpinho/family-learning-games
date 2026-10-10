import {spawnSync} from 'node:child_process';

// Timing-sensitive browser audio assertions run without another test file consuming CPU.
// Every file still runs, with its original assertions and one shared wall-clock budget.
export function qualityGroups(files){
 const audio=files.filter(f=>/(^|\/)audio-exits\.test\.mjs$/.test(f));
 const rest=files.filter(f=>!audio.includes(f));
 return [...(audio.length?[{files:audio,concurrency:1}]:[]),...(rest.length?[{files:rest,concurrency:2}]:[])];
}
export function runQualityChecks(files,{cwd,executable=process.execPath,spawn=spawnSync,now=Date.now,timeoutMs=30*60*1000}={}){
 const started=now(),results=[];let pass=0,fail=0;
 for(const group of qualityGroups(files)){
  const remaining=timeoutMs-(now()-started);
  if(remaining<=0)return {ok:false,pass,fail:Number(undefined),stdout:results.map(r=>r.stdout||'').join('\n'),stderr:'Quality checks exhausted their shared time budget.'};
  const r=spawn(executable,['--test','--test-concurrency='+group.concurrency,'--test-reporter=tap',...group.files],{cwd,encoding:'utf8',maxBuffer:1<<26,timeout:remaining});results.push(r);
  const count=label=>Number((String(r.stdout||'').match(new RegExp('^# '+label+' (\\d+)$','m'))||[])[1]);
  const passed=count('pass'),failed=count('fail'),cancelled=count('cancelled');
  pass+=Number.isFinite(passed)?passed:0;fail+=failed;
  if(r.status!==0||r.error||!Number.isFinite(passed)||failed!==0||cancelled!==0)return {ok:false,pass,fail,stdout:results.map(x=>x.stdout||'').join('\n'),stderr:results.map(x=>x.stderr||x.error?.message||'').join('\n')};
 }
 return {ok:results.length>0,pass,fail,stdout:results.map(r=>r.stdout||'').join('\n'),stderr:results.map(r=>r.stderr||'').join('\n')};
}
