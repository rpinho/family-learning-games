import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {targetsFor,challengeFor,FLIGHT_MS,aimAt} from '../engine.mjs';
test('Server saves separate profiles, rejects repeated arrows and never serves private logs',async t=>{
 const data=await mkdtemp(join(tmpdir(),'target-trail-test-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',TARGET_DATA:data}});t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.once('error',reject);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
 const post=body=>fetch(url+'/api/action?player=admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 let p=await(await post({type:'start',revision:0})).json();const target=targetsFor(p.round,0,500+FLIGHT_MS)[challengeFor(p.round,0).answerIndex],drift=aimAt(p.round,400,250,500),input={type:'shot',rules:2,shot:0,revision:p.revision,x:target.x-(drift.x-400),y:target.y-(drift.y-250),elapsed:500};
 p=await(await post(input)).json();assert.equal(p.round.score,10);assert.equal((await post(input)).status,409);assert.equal(JSON.parse(await readFile(join(data,'admin.json'),'utf8')).shots,1);
 const other=await(await fetch(url+'/api/state?player=beginner')).json();assert.equal(other.shots,0);assert.equal(other.revision,0);
 for(const path of ['/','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest','/app.mjs','/engine.mjs','/challenges.mjs','/style.css'])assert.equal((await fetch(url+path)).status,200,path);
 assert.equal((await fetch(url+'/api/state?player=admin',{headers:{Origin:'https://example.com'}})).status,403);for(const path of ['/admin.json','/logs/today.jsonl','/../server.mjs'])assert.equal((await fetch(url+path)).status,404);
 const log=await readFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),'utf8');assert.ok(log.includes('"type":"action"'));assert.ok(log.includes('"type":"rejected"'));
});
