import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {readingState,readingQuestion,readingAction,READING_TYPES,WORD_CHANGES,validReadingInk} from '../public/reading.mjs';
import {readingHome,readingView} from '../public/reading-view.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
import {summarize} from '../diagnostic-report.mjs';
const act=(p,input)=>readingAction(p,{questionId:p.reading?.question?.id,...input});
function correct(p){const q=p.reading.question;
 if(['dictation','change','sentence'].includes(q.type)){const used=[];const draft=(q.type==='sentence'?q.answer.split(' '):[...q.answer]).map(t=>{const i=q.tiles.findIndex((x,i)=>x===t&&(q.type!=='sentence'||!used.includes(i)));used.push(i);return i;});act(p,{kind:'draft',draft});}
 if(q.type==='act')act(p,{kind:'draft',draft:q.answer.split('|').map(id=>q.options.findIndex(o=>o.id===id))});
 if(q.type==='write')act(p,{kind:'ink',ink:[[[10,20],[30,40],[40,20]]]});
 return act(p,{kind:'answer',answer:q.answer,durationMs:6000});
}
test('Seven different reading activities persist without rewriting old mastery or double rewards',()=>{
 let p=freshProfile();const old={skills:p.skills,seq:p.seq,completed:p.completed};assert.equal(p.reading,undefined);assert.equal(readingState(p).phase,'lobby');act(p,{kind:'start'});
 for(const [type] of READING_TYPES){assert.equal(p.reading.question.type,type);const result=correct(p);assert.equal(result.kind,type==='write'?'writing':'correct');assert.equal(result.independent,type!=='write');assert.throws(()=>correct(p));p=JSON.parse(JSON.stringify(p));act(p,{kind:'next'});}
 assert.equal(p.reading.phase,'complete');assert.equal(p.xp,92);assert.equal(p.gems,5);assert.equal(p.reading.history.length,1);assert.equal(p.reading.history[0].results[6].ink.length,1);
 assert.deepEqual({skills:p.skills,seq:p.seq,completed:p.completed},old);assert.throws(()=>act(p,{kind:'next'}));act(p,{kind:'start'});assert.equal(p.reading.run,2);assert.equal(p.xp,92);
});
test('Reading tasks never speak the printed answer before an unaided decoding attempt',()=>{
 for(const type of ['decode','act','story']){const p=freshProfile();act(p,{kind:'start',focus:type});const q=p.reading.question;assert.equal(q.listenLine,undefined);assert.notEqual(q.prompt,q.helpLine);
  const revision=p.revision;act(p,{kind:'help',help:'read'});assert.equal(p.revision,revision+1);act(p,{kind:'help',help:'read'});assert.equal(p.revision,revision+1);
  assert.deepEqual(JSON.parse(JSON.stringify(p)).reading.help,['read']);const r=correct(p);assert.equal(r.independent,false);assert.equal(r.xp,6);
 }
});
test('Wrong answers keep the same question, auto-help after two misses, and do not award mastery',()=>{
 const p=freshProfile();act(p,{kind:'start',focus:'decode',level:2});const q=structuredClone(p.reading.question),wrong=q.options.find(o=>o.value!==q.answer).value;
 for(let i=0;i<2;i++){const r=act(p,{kind:'answer',answer:wrong,durationMs:1000});assert.equal(r.kind,'incorrect');assert.deepEqual(p.reading.question,q);}
 assert.equal(p.xp,0);assert.equal(p.reading.skills.decode.level,1);assert.deepEqual(p.reading.help,['show']);assert.equal(correct(p).independent,false);
});
test('Difficulty is skill-specific; two unaided successes raise it and new content rotates',()=>{
 const p=freshProfile();act(p,{kind:'start',focus:'dictation'});const words=[];
 for(let i=0;i<7;i++){words.push(p.reading.question.word);correct(p);act(p,{kind:'next'});}assert.ok(new Set(words).size>=5);assert.equal(p.reading.skills.dictation.level,3);assert.equal(p.reading.skills.decode,undefined);
 act(p,{kind:'start',focus:'decode'});assert.equal(p.reading.question.level,1);
});
test('Word transformations change exactly one letter; generated reading tasks have complete voice coverage',()=>{
 for(const pairs of WORD_CHANGES)for(const [a,b] of pairs){assert.equal(a.length,b.length);assert.equal([...a].filter((c,i)=>c!==b[i]).length,1,`${a} -> ${b}`);}
 const voice=new Set(allVoiceLines());for(const id of ['explorer','beginner'])for(let run=1;run<=30;run++)for(let level=1;level<=3;level++)for(const [type] of READING_TYPES){
  const p={id,reading:{...readingState({}),run,focus:type,skills:{[type]:{level}}}};const q=readingQuestion(p);assert.ok(voice.has(q.prompt),q.prompt);assert.ok(voice.has(q.helpLine),q.helpLine);if(q.listenLine)assert.ok(voice.has(q.listenLine));
  if(q.type==='decode')assert.equal(q.options.filter(o=>o.value===q.answer).length,1);
 }
});
test('Whole-word writing is stored for review, not falsely graded, and validates coordinates',()=>{
 const p=freshProfile();act(p,{kind:'start',focus:'write'});assert.equal(validReadingInk([[[0,0],[100,100]]]),true);assert.equal(validReadingInk([[[0,0],[101,100]]]),false);
 assert.throws(()=>act(p,{kind:'answer',durationMs:1000}));assert.throws(()=>act(p,{kind:'ink',ink:[[[0,0],[NaN,4]]]}));
 const ink=[[[1,2],[30,50]],[[40,5],[55,75]]];act(p,{kind:'ink',ink});assert.deepEqual(JSON.parse(JSON.stringify(p)).reading.ink,ink);const r=act(p,{kind:'answer',durationMs:2000});assert.equal(r.kind,'writing');assert.equal(r.ok,false);assert.equal(p.xp,0);assert.deepEqual(r.ink,ink);assert.equal(p.reading.skills.write,undefined);
});
test('Invalid drafts and stale questions cannot change reading progress; skipping cannot farm rewards',()=>{
 const p=freshProfile();act(p,{kind:'start',focus:'sentence'});assert.throws(()=>act(p,{kind:'draft',draft:[999]}));assert.throws(()=>act(p,{kind:'draft',draft:[0,0]}));assert.throws(()=>act(p,{kind:'help',questionId:'stale',help:'show'}));assert.throws(()=>act(p,{kind:'start'}));
 for(let i=0;i<7;i++){act(p,{kind:'skip'});act(p,{kind:'next'});}assert.equal(p.xp,0);assert.equal(p.gems,0);
});
test('Choosing a different activity archives unfinished work and keeps earned XP',()=>{
 const p=freshProfile();act(p,{kind:'start'});correct(p);act(p,{kind:'next'});act(p,{kind:'draft',draft:[0]});const xp=p.xp;
 act(p,{kind:'start',focus:'story',replace:true,level:2});assert.equal(p.xp,xp);assert.equal(p.reading.run,2);assert.equal(p.reading.question.type,'story');assert.equal(p.reading.question.level,2);assert.equal(p.reading.history[0].unfinished,true);assert.deepEqual(p.reading.history[0].draft,[0]);assert.equal(p.reading.history[0].results.length,1);
});
test('Word transformer starts from a real word and replaces a selected letter',()=>{
 const p=freshProfile();act(p,{kind:'start',focus:'change'});const q=p.reading.question;assert.equal(p.reading.draft.map(i=>q.tiles[i]).join(''),q.from);
 const changed=[...q.from].findIndex((c,i)=>c!==q.word[i]);act(p,{kind:'position',position:changed});assert.equal(p.reading.cursor,changed);assert.throws(()=>act(p,{kind:'position',position:99}));
 const draft=[...p.reading.draft];draft[p.reading.cursor]=q.tiles.indexOf(q.word[changed]);act(p,{kind:'draft',draft});assert.equal(act(p,{kind:'answer',durationMs:6000}).independent,true);
});
test('Reading UI is safe and evidence stays separate in diagnostics',async()=>{
 const p=freshProfile('admin');p.name='<script>x</script>';assert.doesNotMatch(readingHome(p),/<script>/);assert.match(readingHome(p),/Word transformer/);assert.match(readingHome(p),/No alphabet drills/);
 act(p,{kind:'start',focus:'story'});assert.match(readingView(p),/Read it to me/);const before={question:p.reading.question};const result=correct(p),rows=[{type:'reading_action',player:'admin',session:'test',before,input:{kind:'answer'},result}];
 rows.push({type:'reading_action',player:'admin',session:'test',before,input:{kind:'next'},result:{kind:'next'}});
 assert.deepEqual((await summarize(rows)).reading,[]);const r=(await summarize(rows,{player:'admin'})).reading[0];assert.equal(r.independent,1);assert.equal(r.activity,'story');assert.equal(r.assisted,0);
});
