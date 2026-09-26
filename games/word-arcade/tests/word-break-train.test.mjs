import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {question} from '../lib/engine.mjs';
test('Sentence Express carriages give no position cues',()=>{
 for(let level=1;level<=3;level++)for(let n=0;n<48;n++){const q=question('train',level,n),words=q.answer.split(' ');
  assert.equal(q.slots,words.length);assert.ok(q.tiles.every(t=>!/[.?!,]/.test(t)),'no punctuation tile marks the end');assert.ok(words.every(w=>q.tiles.includes(w)));
  assert.ok(q.tiles.slice(0,words.length).filter((w,i)=>w===words[i]).length<=1);for(let k=1;k<words.length;k++)assert.notDeepEqual(q.tiles,[...words.slice(k),...words.slice(0,k)]);
  assert.deepEqual(question('train',level,n).tiles,q.tiles,'deterministic');}
 const names=Array.from({length:12},(_,n)=>question('train',1,n).answer.split(' ')).filter(w=>/^[A-Z]/.test(w.at(-1))&&w.at(-1)!=='I').length;assert.ok(names<5);
});
test('Word-break level route is read-only',async()=>{const dir=await mkdtemp(join(tmpdir(),'wa-wb-')),letters=await mkdtemp(join(tmpdir(),'wa-lq-'));await writeFile(join(letters,'beginner.json'),JSON.stringify({completed:17}));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14327',HOST:'127.0.0.1',WORD_ARCADE_DATA:dir,LETTER_QUEST_DATA:letters},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});const base='http://127.0.0.1:14327';
  const d=await(await fetch(base+'/api/beginner/word-break')).json();assert.equal(d.track,'letters');assert.equal(d.letters.length,11);
  assert.equal((await fetch(base+'/api/beginner/word-break',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
  assert.equal((await fetch(base+'/api/nobody/word-break')).status,404);}finally{child.kill();}
});
