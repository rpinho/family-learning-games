import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fresh,act,voiceLines,GAMES} from '../lib/engine.mjs';
import {slalomRun,easeGate,SLALOM_LINES,SLALOM_GATES,CVC_WORDS,CVC_FAMILIES} from '../lib/slalom.mjs';
import {literacyFrom,tilesOf} from '../lib/word-break.mjs';
import {WIND_DOWN_MS,REST_MS,REST_LINE} from '../lib/rest.mjs';
const send=(p,input,ctx)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id},ctx);
const beginner={...literacyFrom(null,'letters'),source:'letter-quest',letters:[...'SATPINMDGOE'],lower:['s','a','t'],learning:[...'SATPINMDGOE','s','a','t']};
const explorer={...literacyFrom(null,'words'),source:'letter-quest',wordLevel:2};
const lines=new Set(voiceLines());
function checkGate(g){
 assert.equal(new Set(g.options).size,g.options.length,g.options.join());assert.ok(g.options.includes(g.answer));assert.equal(g.options[g.lane],g.answer);
 for(const line of [g.prompt,g.correction,g.recap,g.after].filter(Boolean))assert.ok(lines.has(line),line);
}
test('Letter Slalom is one arcade mission with its own identity',()=>{assert.ok(GAMES.some(g=>g.id==='slalom'&&g.name==='Letter Slalom'));});
test('Beginner: letters the child knows from Letter Quest, pairs first then triplets, with look-alike distractors',()=>{
 for(let seed=1;seed<60;seed++){const run=slalomRun(beginner,{seed});assert.equal(run.length,SLALOM_GATES);
  run.forEach((g,i)=>{checkGate(g);assert.equal(g.track,'letters');assert.equal(g.options.length,i<4?2:3);
   if(g.kind==='find-letter')assert.ok(beginner.letters.includes(g.answer)||beginner.lower.includes(g.answer),g.answer);
   if(g.kind==='first-letter'){assert.ok(g.picture);assert.equal(g.answer,g.word[0].toUpperCase());assert.ok(beginner.letters.includes(g.answer));}});
  for(let i=2;i<run.length;i++)assert.ok(!(run[i].lane===run[i-1].lane&&run[i].lane===run[i-2].lane&&run[i].options.length>1&&run[i-1].options.length===run[i].options.length&&run[i-2].options.length===run[i].options.length),'same lane three times');
 }
 const kinds=new Set(Array.from({length:30},(_,s)=>slalomRun(beginner,{seed:s}).map(g=>g.kind)).flat());assert.deepEqual([...kinds].sort(),['find-letter','first-letter']);
});
test('Explorer: CVC words only; look-alikes share the first letter and differ in the vowel or last letter; sounded out after',()=>{
 for(let seed=1;seed<80;seed++)slalomRun(explorer,{seed}).forEach((g,i)=>{checkGate(g);assert.equal(g.track,'words');assert.equal(g.kind,'read-word','no sentences before Letter Quest shows sentence building');assert.ok(g.options.length<=(i<2?2:3));
  assert.ok(CVC_FAMILIES.includes(g.answer.slice(1)),g.answer);assert.equal(g.after,`Sound out ${g.answer}.`);assert.ok(lines.has(g.after));
  for(const o of g.options.filter(o=>o!==g.answer)){assert.ok(CVC_WORDS.includes(o),o);assert.equal(o[0],g.answer[0],`${o} vs ${g.answer}`);assert.equal([...o].filter((c,k)=>c!==g.answer[k]).length,1);assert.notEqual(o[0],'');}
 });
 // no digraphs or blends anywhere in his run
 for(let seed=1;seed<40;seed++)assert.ok(slalomRun(explorer,{seed}).every(g=>g.options.every(o=>/^[a-z]{3}$/.test(o)&&!/(sh|ch|th|wh|ck)/.test(o))));
 // sentences (the next word of a spoken sentence) only once Letter Quest shows he builds sentences on his own; still CVC targets
 const ready=Array.from({length:20},(_,seed)=>slalomRun({...explorer,sentenceReady:true},{seed})).flat().filter(g=>g.kind==='next-word');
 assert.ok(ready.length>10);for(const g of ready){assert.equal(tilesOf(g.sentence)[g.before.length],g.answer);assert.ok(CVC_WORDS.includes(g.answer));assert.ok(g.options.every(o=>o[0]===g.answer[0]));}
 for(let seed=1;seed<60;seed++){const sentences=slalomRun({...explorer,sentenceReady:true},{seed}).filter(g=>g.sentence).map(g=>g.sentence);assert.equal(new Set(sentences).size,sentences.length,'a sentence repeats in one run');}
});
test('A missed gate makes the next triplet a pair, keeping the answer',()=>{const g=slalomRun(beginner,{seed:4})[6],e=easeGate(g);assert.equal(e.options.length,2);assert.ok(e.options.includes(g.answer));assert.equal(e.options[e.lane],g.answer);assert.equal(easeGate(e),e);});
test('A run never fails: one pass per gate, misses name the answer and continue, then it completes',()=>{
 const p=fresh('beginner');send(p,{kind:'start',game:'slalom'},{literacy:beginner,now:0});
 assert.equal(p.session.gates.length,8);assert.equal(p.session.q.id,`${p.session.run}:0`);
 let xp=0;
 for(let i=0;i<8;i++){const q=p.session.q,wrong=i===1||i===4,choice=wrong?q.options.find(o=>o!==q.answer):q.answer;
  const r=send(p,{kind:'answer',answer:choice,durationMs:5000},{now:1000*i});
  assert.equal(r.ok,!wrong);assert.equal(r.answer,q.answer);assert.equal(r.correction,wrong?q.correction:'');assert.equal(r.line,'');if(!wrong)xp+=12;
  if(wrong&&i<7&&i+1>=4)assert.equal(p.session.q.options.length,2);
  if(i<7){assert.equal(p.session.phase,'question');assert.equal(p.session.round,i+1);}}
 assert.equal(p.session.phase,'complete');assert.equal(p.xp,xp);assert.equal(p.games.slalom.played,1);assert.equal(p.games.slalom.best,undefined);
 assert.equal(p.session.results.length,8);assert.equal(p.session.correct,6);
 assert.throws(()=>send(p,{kind:'answer',answer:'F',durationMs:1}),/no longer active|Already/);
});
test('Gate answers must be one of the gate letters; stale gates are rejected',()=>{
 const p=fresh('explorer');send(p,{kind:'start',game:'slalom'},{literacy:explorer});
 assert.throws(()=>send(p,{kind:'answer',answer:'zzz',durationMs:10}),/Choose a gate/);
 const first=p.session.q.id;send(p,{kind:'answer',answer:p.session.q.answer,durationMs:10});
 assert.throws(()=>act(p,{kind:'answer',answer:'x',durationMs:1,revision:p.revision,questionId:first}),/no longer active/);
});
test('Calm wind-down: a run finishing after 20 minutes of play is the last one; new starts rest; grown-ups can lift it',()=>{
 const p=fresh('explorer');let t=0;
 send(p,{kind:'start',game:'rhyme'},{now:t});
 while(t<WIND_DOWN_MS){t+=5*60000;send(p,{kind:'help'},{now:t});}
 send(p,{kind:'start',game:'slalom'},{literacy:explorer,now:t});let last;
 for(let i=0;i<8;i++)last=send(p,{kind:'answer',answer:p.session.q.answer,durationMs:1},{now:t+i*1000});
 assert.equal(last.windDown,true);assert.equal(p.play.restUntil,t+7000+REST_MS);
 const r=send(p,{kind:'start',game:'blaster'},{now:t+60000});assert.equal(r.kind,'resting');assert.equal(r.line,REST_LINE);assert.equal(p.session.game,'slalom');assert.ok(lines.has(REST_LINE));
 send(p,{kind:'rest'},{now:t+61000});assert.equal(send(p,{kind:'start',game:'blaster'},{now:t+62000}).kind,'start');
 // A 10-minute pause starts a fresh stretch; Admin is never put to rest.
 const q=fresh('beginner');send(q,{kind:'start',game:'slalom'},{literacy:beginner,now:0});send(q,{kind:'help'},{now:0});
 for(let i=0;i<8;i++)send(q,{kind:'answer',answer:q.session.q.answer,durationMs:1},{now:(i<7?0:WIND_DOWN_MS+11*60000)});assert.equal(q.play.restUntil,undefined);
 const a=fresh('admin');send(a,{kind:'start',game:'slalom'},{now:0});for(let i=0;i<8;i++)send(a,{kind:'answer',answer:a.session.q.answer,durationMs:1},{now:i*4*60000});assert.equal(a.play.restUntil,undefined);
});
test('Every spoken slalom line has a voice clip',()=>{for(const l of Object.values(SLALOM_LINES))assert.ok(lines.has(l),l);
 for(let seed=0;seed<120;seed++)for(const level of [beginner,explorer,{...explorer,sentenceReady:true,sentenceLevel:3,wordLevel:3},{...literacyFrom(null,'mixed')},literacyFrom(null,'letters')])slalomRun(level,{seed}).forEach(checkGate);});
test('The server builds a run from the Letter Quest save without changing it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wa-slalom-')),letters=await mkdtemp(join(tmpdir(),'wa-lq-')),save=JSON.stringify({completed:3});await writeFile(join(letters,'beginner.json'),save);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14331',HOST:'127.0.0.1',WORD_ARCADE_DATA:dir,LETTER_QUEST_DATA:letters},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});const base='http://127.0.0.1:14331';
  const r=await fetch(base+'/api/beginner/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'start',game:'slalom',revision:0})}),d=await r.json();
  assert.equal(r.status,200);const known=literacyFrom({completed:3},'letters').letters;
  for(const g of d.profile.session.gates){assert.equal(g.track,'letters');if(g.kind==='find-letter')assert.ok(known.includes(g.answer.toUpperCase()),g.answer);else assert.ok(known.includes(g.answer),g.answer);}
  assert.equal(await readFile(join(letters,'beginner.json'),'utf8'),save);
 }finally{child.kill();}
});
test('Finish-line friends: only models listed for that player and present on disk are offered or served',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wa-slalom-')),assets=await mkdtemp(join(tmpdir(),'wa-3d-'));
 await writeFile(join(assets,'companions.json'),JSON.stringify({beginner:['toy-a','missing','../x'],explorer:['toy-b']}));
 for(const n of ['toy-a','toy-b','secret'])await writeFile(join(assets,n+'.glb'),'glTF');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14332',HOST:'127.0.0.1',WORD_ARCADE_DATA:dir,LETTER_QUEST_DATA:dir,FAMILY_ASSETS3D:assets},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});const base='http://127.0.0.1:14332';
  assert.deepEqual((await(await fetch(base+'/api/beginner/companions')).json()).files,['toy-a']);
  assert.deepEqual((await(await fetch(base+'/api/admin/companions')).json()).files,[]);
  const r=await fetch(base+'/companion/toy-a.glb');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'model/gltf-binary');
  assert.equal((await fetch(base+'/companion/secret.glb')).status,404);assert.equal((await fetch(base+'/companion/..%2Fsecret.glb')).status,404);
  assert.equal((await fetch(base+'/api/beginner/companions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 }finally{child.kill();}
});
test('Every spoken slalom line is in the voice line list',()=>{for(const l of [REST_LINE,...Object.values(SLALOM_LINES)])assert.ok(lines.has(l),l);});
