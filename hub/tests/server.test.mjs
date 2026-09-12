import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('Hub persists only the chosen profile, rejects replay/foreign origins, and scopes runtime imports',async()=>{
 const data=await mkdtemp(join(tmpdir(),'family-hub-test-'));
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DATA:data,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 try{
  const output=await new Promise((resolve,reject)=>{child.stdout.once('data',x=>resolve(String(x)));child.once('error',reject);child.once('exit',c=>reject(Error('Server exited '+c)));});
  const base='http://127.0.0.1:'+output.match(/localhost:(\d+)/)[1];
  const request=(a)=>fetch(base+'/api/dribble?player=admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});
  assert.equal((await fetch(base+'/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/config.json')).status,404);
  assert.equal((await fetch(base+'/api/dribble?player=unknown')).status,400);
  const first=await(await request({type:'start',revision:0})).json();
  assert.equal(first.profile.revision,1);
  assert.equal((await request({type:'level',level:2,revision:0})).status,409);
  const move=['left','middle','right'].find(x=>x!==first.profile.round.blocked);
  const goal=await(await request({type:'move',move,roundId:first.profile.round.id,revision:1})).json();
  assert.equal(goal.profile.goals,1);
  assert.equal(JSON.parse(await readFile(join(data,'admin.json'),'utf8')).goals,1);
  assert.deepEqual((await readdir(data)).sort(),['admin.json','logs']);
  const redirect=await fetch(base+'/assets/runtime.js',{headers:{Referer:base+'/g/word-arcade/admin/'},redirect:'manual'});
  assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'/g/word-arcade/admin/assets/runtime.js');
  assert.equal((await fetch(base+'/assets/runtime.js',{headers:{Referer:'https://untrusted.example/g/word-arcade/admin/'},redirect:'manual'})).status,404);
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
