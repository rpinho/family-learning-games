import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('HTTP help remains available after old allowance is exhausted; staged cue persists',async()=>{
 const data=await mkdtemp(join(tmpdir(),'hint-budget-http-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14338',HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Server exited')));});
  const base='http://127.0.0.1:14338';let state=await(await fetch(base+'/api/admin/state')).json();
  const post=async(action,input)=>{const r=await fetch(base+'/api/admin/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.profile.revision,...input})});const d=await r.json();if(r.ok)state=d;return {r,d};};
  await post('soccer',{kind:'start',level:1});
  for(let i=0;i<2;i++){
   await post('soccer',{kind:'ready'});const q=state.profile.soccer.question;
   assert.equal((await post('soccer',{kind:'hint',questionId:q.id})).r.status,200);
   await post('soccer',{kind:'answer',questionId:q.id,answer:q.answer,durationMs:500});await post('soccer',{kind:'next'});
  }
  state=await(await fetch(base+'/api/admin/state')).json();assert.equal(state.profile.hintBank.grants.length,2);assert.equal(state.profile.xp,0);
  await post('reading',{kind:'start',focus:'decode'});
  const input={kind:'help',help:'show',questionId:state.profile.reading.question.id};
  const cue=await post('reading',input);assert.equal(cue.r.status,200);assert.deepEqual(state.profile.reading.help,['cue']);
  const before=await readFile(join(data,'admin.json'),'utf8');
  assert.equal((await post('reading',input)).d.result.kind,'help-wait');
  assert.equal(await readFile(join(data,'admin.json'),'utf8'),before);
  state=await(await fetch(base+'/api/admin/state')).json();assert.deepEqual(state.profile.reading.help,['cue']);
  assert.equal((await fetch(base+'/hints.mjs')).status,200);
  assert.equal((await fetch(base+'/reading-client.mjs')).status,200);
  assert.ok(Math.abs(state.serverNow-Date.now())<10000);
  assert.equal((await(await fetch(base+'/api/beginner/state')).json()).profile.hintBank,undefined);
 }finally{if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}}
});
