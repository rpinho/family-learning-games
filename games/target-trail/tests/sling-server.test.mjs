import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('Word-break levels come from Letter Quest read-only; sling page and rounds are served',async t=>{
 const data=await mkdtemp(join(tmpdir(),'target-trail-sling-')),letters=await mkdtemp(join(tmpdir(),'lq-read-'));
 const lq=JSON.stringify({completed:17,skills:{},secret:'not served'});await writeFile(join(letters,'beginner.json'),lq);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',TARGET_DATA:data,LETTER_QUEST_DATA:letters}});t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.once('error',reject);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});});
 const level=await(await fetch(url+'/api/word-break?player=beginner')).json();assert.equal(level.track,'letters');assert.deepEqual(level.letters,[...'FRANCISOETL']);assert.equal(level.secret,undefined);
 assert.equal((await(await fetch(url+'/api/word-break?player=explorer')).json()).source,'default');
 assert.equal((await fetch(url+'/api/word-break?player=beginner',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 assert.match(await(await fetch(url+'/?mode=sling&player=beginner')).text(),/sling-app\.mjs/);
 for(const path of ['/sling-app.mjs','/sling.mjs','/sling-legacy.mjs','/word-break.mjs','/sling.svg'])assert.equal((await fetch(url+path)).status,200,path);
 const post=body=>fetch(url+'/api/action?player=beginner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const p=await(await post({type:'sling-start',revision:0,literacy:{letters:['Z']}})).json();assert.deepEqual(p.sling.round.letters,[...'FRANCISOETL']);
 assert.equal(JSON.parse(await readFile(join(letters,'beginner.json'),'utf8')).secret,'not served');assert.equal(await readFile(join(letters,'beginner.json'),'utf8'),lq);
});
