import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('HTTP game saves, conflict recovery, player isolation and private files',async t=>{
 const data=await mkdtemp(join(tmpdir(),'three-in-a-row-test-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',TTT_DATA:data}});t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});});
 const get=async p=>(await fetch(url+p)).json(),post=async body=>fetch(url+'/api/action?player=admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const fresh=await get('/api/state?player=beginner');assert.equal(fresh.revision,0);assert.equal(fresh.game,null);
 let r=await post({type:'start',revision:0});assert.equal(r.status,200);let p=await r.json();
 r=await post({type:'move',cell:0,revision:p.revision});p=await r.json();assert.equal(p.game.phase,'bot');
 const persisted=JSON.parse(await readFile(join(data,'admin.json'),'utf8'));assert.equal(persisted.game.board[0],'X');assert.equal(persisted.revision,p.revision);
 assert.equal((await post({type:'move',cell:0,revision:0})).status,409);
 r=await post({type:'bot',revision:p.revision});p=await r.json();assert.equal(p.game.phase,'you');assert.equal(p.game.board.filter(Boolean).length,2);
 assert.equal((await get('/api/state?player=beginner')).revision,0);
 for(const path of ['/','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest','/app.mjs','/style.css'])assert.equal((await fetch(url+path)).status,200,path);
 assert.equal((await fetch(url+'/api/state?player=admin',{headers:{Origin:'https://elsewhere.example'}})).status,403);
 assert.equal((await fetch(url+'/admin.json')).status,404);assert.equal((await fetch(url+'/logs/2026-09-12.jsonl')).status,404);
 assert.equal((await fetch(url+'/api/state?player=unknown')).status,400);
 const logs=await readFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),'utf8');assert.ok(logs.includes('"type":"action"'));assert.ok(logs.includes('"type":"rejected"'));
});
