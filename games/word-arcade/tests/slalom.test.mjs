import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fresh,act,voiceLines,GAMES} from '../lib/engine.mjs';
import {slalomRun,easeGate,SLALOM_LINES,SLALOM_GATES,CVC_WORDS,CVC_FAMILIES,canSoundOut,afterGate,supportGate,easyNext,slalomChoice,pickFamily,familyTargets,familyWords,SLALOM_FAMILIES,trickyWords,trickyLetters,familyBreakItem,wordPicture,FAMILY_PICTURES,soundOutLine} from '../lib/slalom.mjs';

test('letter finish reviews at most three distinct missed or hinted letters, with misses first',()=>{
 const gates=['O','E','S','a','R','I','L','E'].map(answer=>({track:'letters',answer}));
 const outcomes=[{ok:true},{ok:true,hinted:true},{ok:true},{ok:true,hinted:true},{ok:false},{ok:false},{ok:false},{ok:false}];
 assert.deepEqual(trickyLetters(gates,outcomes),[4,5,6]);
 assert.deepEqual(trickyLetters(gates,outcomes,2),[4,5]);
 assert.deepEqual(trickyLetters(gates,outcomes.map(()=>({ok:true}))),[]);
 assert.deepEqual(trickyLetters(gates,[{ok:false},{ok:false},{ok:true},{ok:true},{ok:true},{ok:true},{ok:true},{ok:false}]),[0,1]);
});
import {literacyFrom,PICTURE_NAMES,PICTURE_REJECTED} from '../lib/word-break.mjs';
const send=(p,input,ctx)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id},ctx);
const beginner={...literacyFrom(null,'letters'),source:'letter-quest',letters:[...'FRANCISOETL'],lower:['f','r','a'],learning:[...'FRANCISOETL','f','r','a']};
const explorer={...literacyFrom(null,'words'),source:'letter-quest',wordLevel:2};
const lines=new Set(voiceLines());
function checkGate(g){
 assert.equal(new Set(g.options).size,g.options.length,g.options.join());assert.ok(g.options.includes(g.answer));assert.equal(g.options[g.lane],g.answer);
 for(const line of [g.prompt,g.praise,g.correction,g.recap,g.recapSoundOut].filter(Boolean))assert.ok(lines.has(line),line);
}
test('Letter Slalom is one arcade mission with its own identity',()=>{assert.ok(GAMES.some(g=>g.id==='slalom'&&g.name==='Letter Slalom'));});
test('Beginner: letters he knows from Letter Quest, pairs first then triplets, with look-alike distractors',()=>{
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
  assert.ok(CVC_FAMILIES.includes(g.answer.slice(1)),g.answer);assert.equal(g.praise,`${g.answer}!`);assert.equal(g.correction,`It's ${g.answer}.`);assert.equal(g.recapSoundOut,`Sound out ${g.answer}.`);
  for(const o of g.options.filter(o=>o!==g.answer)){assert.ok(CVC_WORDS.includes(o),o);assert.equal(o[0],g.answer[0],`${o} vs ${g.answer}`);assert.equal([...o].filter((c,k)=>c!==g.answer[k]).length,1);assert.notEqual(o[0],'');}
 });
 // no digraphs or blends anywhere in his run
 for(let seed=1;seed<40;seed++)assert.ok(slalomRun(explorer,{seed}).every(g=>g.options.every(o=>/^[a-z]{3}$/.test(o)&&!/(sh|ch|th|wh|ck)/.test(o))));
 // one word family per run, even when Letter Quest shows sentences (no sentence rows in a family run)
 for(let seed=1;seed<40;seed++)for(const level of [explorer,{...explorer,sentenceReady:true}]){const run=slalomRun(level,{seed});assert.equal(new Set(run.map(g=>g.answer.slice(1))).size,1);assert.ok(run.every(g=>g.kind==='read-word'));}
});
test('A missed gate makes the next triplet a pair, keeping the answer',()=>{const g=slalomRun(beginner,{seed:4})[6],e=easeGate(g);assert.equal(e.options.length,2);assert.ok(e.options.includes(g.answer));assert.equal(e.options[e.lane],g.answer);assert.equal(easeGate(e),e);});
test('A run never fails: one pass per gate, misses name the answer and continue, then it completes',()=>{
 const p=fresh('beginner');send(p,{kind:'start',game:'slalom'},{literacy:beginner});
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
test('No play-time limit: long play never locks a player out, and old saved wind-down state is ignored',()=>{
 const p=fresh('explorer');p.play={since:0,last:0,restUntil:Date.now()+3600000};const saved=structuredClone(p.play);
 for(let run=0;run<6;run++){const r=send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(r.kind,'start');for(let i=0;i<8;i++){const a=send(p,{kind:'answer',answer:p.session.q.answer,durationMs:1});assert.equal(a.windDown,undefined);}assert.equal(p.session.phase,'complete');}
 assert.equal(send(p,{kind:'start',game:'blaster'}).kind,'start');assert.deepEqual(p.play,saved,'old state left alone, unused');
 assert.throws(()=>send(p,{kind:'rest'}),/Unknown action/);
});
test('Every spoken slalom line has a voice clip',()=>{for(const l of Object.values(SLALOM_LINES))assert.ok(lines.has(l),l);
 for(let seed=0;seed<120;seed++)for(const level of [beginner,explorer,{...explorer,sentenceReady:true,sentenceLevel:3,wordLevel:3},{...literacyFrom(null,'mixed')},literacyFrom(null,'letters')])slalomRun(level,{seed}).forEach(checkGate);});
test('The server builds a run from the Letter Quest save without changing it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wa-slalom-')),letters=await mkdtemp(join(tmpdir(),'wa-lq-')),save=JSON.stringify({completed:3});await writeFile(join(letters,'beginner.json'),save);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14331',HOST:'127.0.0.1',WORD_ARCADE_DATA:dir,LETTER_QUEST_DATA:letters},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});const base='http://127.0.0.1:14331';
  const r=await fetch(base+'/api/beginner/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'start',game:'slalom',revision:0})}),d=await r.json();
  assert.equal(r.status,200);const known=[...'FRANC'];
  for(const g of d.profile.session.gates){assert.equal(g.track,'letters');if(g.kind==='find-letter')assert.ok(known.includes(g.answer.toUpperCase()),g.answer);else assert.ok(known.includes(g.answer),g.answer);}
  assert.equal(await readFile(join(letters,'beginner.json'),'utf8'),save);
 }finally{child.kill();}
});
test('Finish-line friends: listed models and standees that exist are offered and served; nothing else',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wa-slalom-')),assets=await mkdtemp(join(tmpdir(),'wa-3d-'));const {mkdir}=await import('node:fs/promises');
 await writeFile(join(assets,'companions.json'),JSON.stringify({beginner:['toy-a','missing','../x',{id:'bo',standee:'standees/bo.png',fallback:'toy-c'},{id:'birdie',standee:'standees/birdie.png',fallback:'toy-b'}],explorer:['toy-b']}));
 for(const n of ['toy-a','toy-b','toy-c','secret'])await writeFile(join(assets,n+'.glb'),'glTF');await mkdir(join(assets,'standees'));await writeFile(join(assets,'standees','bo.png'),'PNG');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14332',HOST:'127.0.0.1',WORD_ARCADE_DATA:dir,LETTER_QUEST_DATA:dir,FAMILY_ASSETS3D:assets},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});const base='http://127.0.0.1:14332';
  assert.deepEqual((await(await fetch(base+'/api/beginner/companions')).json()).friends,[{id:'toy-a',kind:'model',url:'companion/toy-a.glb'},{id:'bo',kind:'standee',url:'companion/bo.png'},{id:'toy-b',kind:'model',url:'companion/toy-b.glb'}]);
  assert.deepEqual((await(await fetch(base+'/api/admin/companions')).json()).friends,[]);
  const r=await fetch(base+'/companion/toy-a.glb');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'model/gltf-binary');
  const g=await fetch(base+'/companion/bo.png');assert.equal(g.status,200);assert.equal(g.headers.get('content-type'),'image/png');
  assert.equal((await fetch(base+'/companion/toy-c.glb')).status,404,'a fallback is served only when used');
  assert.equal((await fetch(base+'/companion/secret.glb')).status,404);assert.equal((await fetch(base+'/companion/..%2Fsecret.glb')).status,404);assert.equal((await fetch(base+'/companion/birdie.png')).status,404);
  assert.equal((await fetch(base+'/api/beginner/companions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
 }finally{child.kill();}
});
test('Public narration has a device fallback and every spoken slalom line is declared',async()=>{
 const {readdir}=await import('node:fs/promises');
 for(const dir of ['app','lib']){for(const f of await readdir(new URL(`../${dir}/`,import.meta.url))){if(!/\.(m?js|jsx|tsx?)$/.test(f))continue;const src=await readFile(new URL(`../${dir}/${f}`,import.meta.url),'utf8');if(f!=='voice.mjs')assert.ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(src),`${dir}/${f} bypasses the narration adapter`);}}
 for(const l of Object.values(SLALOM_LINES))assert.ok(lines.has(l),l);
});
test('Hinted passes are recorded apart from unaided ones; the ride choice is remembered in the save',()=>{
 const p=fresh('explorer');send(p,{kind:'start',game:'slalom',ride:'board'},{literacy:explorer});assert.equal(p.slalom.ride,'board');assert.equal(p.session.ride,'board');
 const a=send(p,{kind:'answer',answer:p.session.q.answer,durationMs:10,hinted:true});assert.equal(a.ok,true);
 send(p,{kind:'answer',answer:p.session.q.answer,durationMs:10});
 assert.deepEqual(p.session.results.map(r=>[r.independent,r.hinted]),[[false,true],[true,false]]);assert.equal(p.session.assisted,1);assert.equal(p.xp,18);
 send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(p.session.ride,'board','remembered');
 send(p,{kind:'start',game:'slalom',ride:'ski'},{literacy:explorer});assert.equal(p.slalom.ride,'ski');
 assert.throws(()=>send(p,{kind:'start',game:'slalom',ride:'sled'},{literacy:explorer}),/skis or a snowboard/);
});
test('Only words made of recorded letter sounds are ever sounded out',()=>{
 for(let seed=0;seed<80;seed++)for(const level of [explorer,{...explorer,sentenceReady:true}])for(const g of slalomRun(level,{seed}))if(g.recapSoundOut)assert.ok(canSoundOut(g.answer),g.answer);
});

const words=p=>p.session.gates.map(g=>g.answer);
function playRun(p,missAt=[],opts={}){send(p,{kind:'start',game:'slalom',...opts},{literacy:explorer});for(let i=0;i<8;i++){const q=p.session.q;send(p,{kind:'answer',answer:missAt.includes(i)?q.options.find(o=>o!==q.answer):q.answer,durationMs:10});}assert.equal(p.session.phase,'complete');}
test('Letters or words: Beginner never gets a choice; Explorer defaults to letters, his tap is remembered, and two word runs read over 70% offer words',()=>{
 assert.deepEqual(slalomChoice('beginner',{track:'words'},'letters'),{toggle:false,track:'letters',ready:false,accuracy:null});
 const d=fresh('beginner');send(d,{kind:'start',game:'slalom',track:'words'},{literacy:beginner});assert.equal(d.session.track,'letters');assert.equal(d.slalom?.track,undefined);
 const p=fresh('explorer');send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(p.session.track,'letters','letters until he reads words well');assert.ok(p.session.gates.every(g=>g.track==='letters'));
 assert.throws(()=>send(p,{kind:'start',game:'slalom',track:'sentences'},{literacy:explorer}),/letters or words/);
 playRun(p,[],{track:'words'});assert.equal(p.slalom.track,'words');assert.equal(p.session.track,'words');
 send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(p.session.track,'words','remembered');
 // readiness: over 70% on his own across the last two complete word runs
 const runs=(a,b)=>({wordRuns:[{family:'at',rows:8,read:a},{family:'an',rows:8,read:b}]});
 assert.equal(slalomChoice('explorer',runs(6,5),'words').ready,false);assert.equal(slalomChoice('explorer',runs(6,6),'words').ready,true);
 assert.equal(slalomChoice('explorer',runs(6,6),'words').track,'words');assert.equal(slalomChoice('explorer',{...runs(6,6),track:'letters'},'words').track,'letters','his own choice wins; the star offers words');
 assert.equal(slalomChoice('explorer',{wordRuns:[{family:'at',rows:8,read:8}]},'words').ready,false,'two runs needed');
});
test('Word runs: one family, 3-4 target words each asked at least twice, pictures only from the reviewed lists',()=>{
 for(const f of SLALOM_FAMILIES){assert.ok(familyWords(f).length>=3,f);for(const seed of [1,2,3]){const t=familyTargets(f,{n:4,seed});assert.equal(t.length,Math.min(4,familyWords(f).length));assert.ok(t.every(w=>w.slice(1)===f&&canSoundOut(w)));}}
 for(let seed=1;seed<40;seed++){const f=SLALOM_FAMILIES[seed%SLALOM_FAMILIES.length],targets=familyTargets(f,{seed}),run=slalomRun(explorer,{seed,family:f,targets});
  assert.ok(run.every(g=>g.family===f&&targets.includes(g.answer)));for(const w of targets)assert.ok(run.filter(g=>g.answer===w).length>=2,w);
  run.forEach((g,i)=>{checkGate(g);if(i)assert.notEqual(g.answer,run[i-1].answer);assert.ok(g.options.length<=(i<2?2:3));assert.equal(lines.has(g.supportPrompt),true,g.supportPrompt);});}
 // pictured words come first
 assert.deepEqual(familyTargets('at',{n:3,seed:5}).filter(w=>wordPicture(w)).length,3);
 for(const [e,w] of Object.entries(FAMILY_PICTURES)){assert.equal(PICTURE_REJECTED[e],undefined,e);assert.ok(!PICTURE_NAMES[e]||PICTURE_NAMES[e]===w,e);assert.ok(CVC_WORDS.includes(w),w);}
});
test('Two misses in a row: every row left becomes a pair with the sound-out as its question (server and browser agree)',()=>{
 const p=fresh('explorer');playRun(p,[],{track:'words'});
 send(p,{kind:'start',game:'slalom'},{literacy:explorer});let browser={gates:p.session.gates.map(g=>({...g})),support:false,missRun:0};
 for(let i=0;i<3;i++){const q=p.session.q,miss=i>=1;const r=send(p,{kind:'answer',answer:miss?q.options.find(o=>o!==q.answer):q.answer,durationMs:10});
  browser=afterGate(browser.gates,i,!miss,browser);assert.equal(!!r.support,i===2);}
 assert.equal(p.session.support,true);assert.equal(p.session.supportFrom,3);
 for(let k=3;k<8;k++){const g=p.session.gates[k];assert.equal(g.options.length,2);assert.equal(g.support,true);assert.equal(g.prompt,soundOutLine(g.answer));assert.ok(lines.has(g.prompt));assert.deepEqual(browser.gates[k].options,g.options);assert.equal(browser.gates[k].prompt,g.prompt);}
 assert.equal(p.session.q.prompt,soundOutLine(p.session.q.answer));
 const g=slalomRun(beginner,{seed:3});let st={gates:g,support:false,missRun:0};st=afterGate(st.gates,4,false,st);st=afterGate(st.gates,5,false,st);assert.equal(st.support,false);assert.ok(st.gates.every(x=>!x.support));
 assert.equal(supportGate(g[6]).support,undefined);
});
test('A hard run (over 40% of the last 8 rows missed) makes the next run easier: same family, 3 words, four pairs',()=>{
 assert.equal(easyNext([true,true,true,false,false,false,false,false]),false);assert.equal(easyNext([true,true,true,true,false,false,false,false]),true);assert.equal(easyNext([]),false);
 const p=fresh('explorer');playRun(p,[0,2,4,6],{track:'words'});const fam=p.session.family;assert.equal(p.slalom.wordRuns.at(-1).missed,4);
 send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(p.session.easy,true);assert.equal(p.session.family,fam);assert.equal(p.session.targets.length,3);
 p.session.gates.forEach((g,i)=>assert.ok(g.options.length<=(i<4?2:3)));
 for(let i=0;i<8;i++)send(p,{kind:'answer',answer:p.session.q.answer,durationMs:10});
 send(p,{kind:'start',game:'slalom'},{literacy:explorer});assert.equal(p.session.easy,false);assert.equal(p.session.family,pickFamily([{family:fam}]),'on to the next family');assert.equal(p.session.targets.length,4);
});
test('Per-word tallies go to the save for the learner model: a clean read is a hit, a miss or the glow an error',()=>{
 const p=fresh('explorer');send(p,{kind:'start',game:'slalom',track:'words'},{literacy:explorer});
 const [a,b,c]=[0,1,2].map(i=>p.session.gates[i]);
 send(p,{kind:'answer',answer:a.answer,durationMs:10});send(p,{kind:'answer',answer:p.session.q.options.find(o=>o!==b.answer),durationMs:10});send(p,{kind:'answer',answer:p.session.q.answer,durationMs:10,hinted:true});
 const t=p.drills['slalom:words'].skills,sum=w=>t[w]||{hits:0,errors:0};
 const expect={};for(const [w,h,e] of [[a.answer,1,0],[b.answer,0,1],[c.answer,0,1]]){expect[w]??={hits:0,errors:0};expect[w].hits+=h;expect[w].errors+=e;}
 for(const [w,x] of Object.entries(expect)){assert.equal(sum(w).hits,x.hits,w);assert.equal(sum(w).errors,x.errors,w);}
 assert.deepEqual(p.slalom.rows,[false,true,false]);
 // letters runs never write word tallies
 const d=fresh('beginner');playRun(d,[1]);assert.equal(d.drills?.['slalom:words'],undefined);
});
test('After the run: only the missed words are replayed, and the word break stays in the family',()=>{
 const gates=slalomRun(explorer,{seed:9,family:'ug',targets:['bug','hug','rug','tug']});
 const out=gates.map((g,k)=>({ok:k!==2&&k!==5,hinted:k===6}));
 const tricky=trickyWords(gates,out);assert.deepEqual(tricky,[...new Set([2,5,6].map(k=>gates[k].answer))]);
 assert.deepEqual(trickyWords(gates,gates.map(()=>({ok:true}))),[]);
 for(let i=0;i<40;i++){const item=familyBreakItem('ug',{tricky,targets:['bug','hug'],r:Math.random});assert.equal(item.answer,tricky[0]);assert.ok(item.options.includes(item.answer));assert.equal(new Set(item.options).size,item.options.length);
  assert.ok(item.options.some(o=>o!==item.answer&&o.slice(1)==='ug'),'a family neighbour');assert.ok(lines.has(item.spoken),item.spoken);}
 const clean=familyBreakItem('at',{targets:['cat','hat']});assert.ok(['cat','hat'].includes(clean.answer));
 for(const w of tricky)assert.ok(lines.has(soundOutLine(w)));
});
