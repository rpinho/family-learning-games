import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('Word-break levels are read-only and derived from Letter Quest',async t=>{
 const data=mkdtempSync(join(tmpdir(),'maze-wb-')),letters=mkdtempSync(join(tmpdir(),'maze-lq-'));writeFileSync(join(letters,'beginner.json'),JSON.stringify({completed:17}));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',MAZE_DATA_DIR:data,LETTER_QUEST_DATA:letters}});t.after(()=>child.kill());
 const base=await new Promise((resolve,reject)=>{child.stdout.once('data',d=>resolve(String(d).trim().split(' ').at(-1)));child.once('error',reject);});
 const d=await(await fetch(base+'/api/word-break?player=beginner')).json();assert.equal(d.track,'letters');assert.equal(d.letters.length,11);
 assert.equal((await(await fetch(base+'/api/word-break?player=explorer')).json()).track,'words');
 const js=await fetch(base+'/word-break.mjs');assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
});
