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
  const request=(a)=>fetch(base+'/api/dribble?player=admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rulesVersion:2,...a})});
  assert.equal((await fetch(base+'/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/config.json')).status,404);
  assert.equal((await fetch(base+'/api/dribble?player=unknown')).status,400);
  const first=await(await request({type:'start',revision:0})).json();
  assert.equal(first.profile.revision,1);
  assert.equal((await request({type:'level',level:2,revision:0})).status,409);
  const fake=await(await request({type:'feint',move:'left',roundId:first.profile.round.id,revision:1})).json();
  assert.equal(fake.profile.round.balanced,false);
  const escaped=await(await request({type:'move',move:'right',roundId:first.profile.round.id,revision:2})).json();
  assert.equal(escaped.profile.dribbles,1);assert.equal(escaped.profile.goals,0);
  assert.equal(JSON.parse(await readFile(join(data,'admin.json'),'utf8')).dribbles,1);
  assert.deepEqual((await readdir(data)).sort(),['admin.json','logs']);
  const savedBeforeMenu=await readFile(join(data,'admin.json'),'utf8');
  const menu=await(await fetch(base+'/api/menu?player=admin')).json();
  assert.equal(menu.order[0],'dribble-duel');assert.equal(new Set(menu.order).size,8);
  assert.deepEqual(Object.keys(menu),['order']);
  assert.equal((await(await fetch(base+'/api/menu?player=beginner')).json()).order[0],'letter-quest');
  assert.equal((await fetch(base+'/api/menu?player=unknown')).status,400);
  assert.equal((await fetch(base+'/api/menu?player=admin',{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(base+'/menu-order.mjs')).status,404);
  assert.equal(await readFile(join(data,'admin.json'),'utf8'),savedBeforeMenu);

  const redirect=await fetch(base+'/assets/runtime.js',{headers:{Referer:base+'/g/word-arcade/admin/'},redirect:'manual'});
  assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'/g/word-arcade/admin/assets/runtime.js');
  assert.equal((await fetch(base+'/assets/runtime.js',{headers:{Referer:'https://untrusted.example/g/word-arcade/admin/'},redirect:'manual'})).status,404);
  for(const path of ['/dribble-live.mjs','/live-pitch.mjs','/dribble-ui.mjs','/chess/tokens.mjs'])assert.equal((await fetch(base+path)).status,200);
  const live=await(await request({type:'live-start',liveRules:1,revision:escaped.profile.revision})).json();
  assert.equal(live.profile.live.level,1);assert.equal(live.profile.dribbles,1);
  const checkpoint=await(await request({type:'live-checkpoint',liveRules:1,revision:live.profile.revision,roundId:live.profile.live.round.id,inputs:'iwee'})).json();
  assert.equal(checkpoint.profile.live.round.inputs,'iwee');
  const reloaded=await(await fetch(base+'/api/dribble?player=admin')).json();assert.equal(reloaded.profile.live.round.inputs,'iwee');
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
