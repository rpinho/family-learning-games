import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('Word-break levels are read-only and derived from Letter Quest',async t=>{
 const data=await mkdtemp(join(tmpdir(),'three-wb-')),letters=await mkdtemp(join(tmpdir(),'three-lq-'));await writeFile(join(letters,'explorer.json'),JSON.stringify({completed:39,maze:{practiceSkills:{reading:{level:2}}},secret:'x'}));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',TTT_DATA:data,LETTER_QUEST_DATA:letters}});t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});});
 const f=await(await fetch(url+'/api/word-break?player=explorer')).json();assert.equal(f.track,'words');assert.equal(f.wordLevel,2);assert.equal(f.secret,undefined);
 assert.equal((await(await fetch(url+'/api/word-break?player=beginner')).json()).track,'letters');assert.equal((await fetch(url+'/api/word-break?player=nobody')).status,400);
 assert.equal((await fetch(url+'/word-break.mjs')).status,200);
});
