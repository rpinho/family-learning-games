import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS,PHONEMES,freshReading,readingLesson,readingVoiceLines,wordKey} from '../lib/reading.mjs';
import {freshProfile,action,publicState} from '../lib/math.mjs';
const step=(p,input,now=Date.now())=>action(p,{revision:p.revision,...input},now);
const question=p=>p.reading.session.questions[p.reading.session.round];
function finish(p,help=false,now=Date.now()){
 const q=question(p),send=input=>step(p,{questionId:q.id,...input},now);
 if(help)send({kind:'reading_hint'});
 if(['sounds','blend'].includes(q.kind)){const n=q.kind==='sounds'?q.letters.length:q.word.length;for(let i=0;i<n;i++)send({kind:'reading_sound',index:i});send({kind:'reading_answer',answer:'done'});}
 else if(['read','story'].includes(q.kind))send({kind:'reading_answer',answer:help?'together':'alone',observer:'grownup'});
 else send({kind:'reading_answer',answer:q.kind==='listen'?q.target:q.word});
 send({kind:'reading_next'});
}
test('every pack uses only introduced sounds, real one-letter changes, varied targets and voiced content',()=>{
 const lines=readingVoiceLines();let known=[];
 for(let level=0;level<PACKS.length;level++){
  const pack=PACKS[level];known.push(...pack.newSounds);for(const l of known)assert.ok(PHONEMES[l]);
  for(const [a,b] of pack.pairs){assert.equal(a.length,b.length);assert.equal([...a].filter((l,i)=>l!==b[i]).length,1);}
  for(const text of [...pack.words,...pack.pairs.flat(),...pack.stories])for(const l of text.toLowerCase().replace(/[^a-z]/g,''))assert.ok(known.includes(l),text+' untaught '+l);
  for(let n=0;n<30;n++){
   const r={...freshReading(),level,lessons:n},s=readingLesson(r,n,1000);assert.equal(s.questions.length,7);
   assert.equal(new Set(s.questions[1].options).size,s.questions[1].options.length);
   for(const q of s.questions){assert.ok(lines.includes(q.prompt));if(q.word)assert.ok(lines.includes(wordKey(q.word)));if(q.bank)for(const l of q.word)assert.ok(q.bank.includes(l));}
   assert.ok(!pack.pairs[n%pack.pairs.length].includes(s.questions[5].word));
  }
 }
});
test('reading saves separately, survives reload, and cannot finish before sound steps or replay a result',()=>{
 let p=freshProfile('beginner');step(p,{kind:'start',game:'subtract'});const before={xp:p.xp,session:structuredClone(p.session),history:structuredClone(p.history),drawing:structuredClone(p.drawing)};
 step(p,{kind:'reading_start'});const q=question(p);
 assert.throws(()=>step(p,{kind:'reading_answer',questionId:q.id,answer:'done'}));
 for(let i=0;i<q.letters.length;i++)step(p,{kind:'reading_sound',questionId:q.id,index:i});
 step(p,{kind:'reading_answer',questionId:q.id,answer:'done'});assert.equal(q.result.independent,false);const stars=p.reading.stars;
 assert.throws(()=>step(p,{kind:'reading_answer',questionId:q.id,answer:'done'}));assert.equal(p.reading.stars,stars);
 p=JSON.parse(JSON.stringify(p));assert.equal(question(p).heard.length,4);assert.equal(publicState(p).reading.stars,stars);
 assert.deepEqual({xp:p.xp,session:p.session,history:p.history,drawing:p.drawing},before);
 assert.throws(()=>step(p,{kind:'reading_next',questionId:'stale'}));
});
test('wrong answers and hints remain supported practice; retries cannot manufacture independence',()=>{
 const p=freshProfile('admin');step(p,{kind:'reading_start'});finish(p);const q=question(p);
 step(p,{kind:'reading_answer',questionId:q.id,answer:q.options.find(l=>l!==q.target)});assert.equal(q.result.ok,false);assert.equal(q.helped,true);
 step(p,{kind:'reading_answer',questionId:q.id,answer:q.target});assert.equal(q.result.independent,false);assert.equal(q.result.stars,1);
});
test('guided completion cannot increase reading level; multiple unaided skills plus adult word checks can',()=>{
 for(const help of [true,false]){
  const p=freshProfile('admin');
  for(let lesson=0;lesson<2;lesson++){step(p,{kind:'reading_start'});while(!p.reading.session.finished)finish(p,help);}
  assert.equal(p.reading.lessons,2);assert.equal(p.reading.level,help?0:1);assert.equal(p.xp,0);assert.equal(p.lessons,0);assert.equal(p.ceiling,13);
  if(!help)assert.equal(new Set(p.reading.history.filter(h=>h.kind==='read'&&h.independent).map(h=>h.word)).size,2);
 }
});
test('read-aloud requires explicitly attributed adult observation; hearing the answer removes independent credit',()=>{
 const p=freshProfile('admin');step(p,{kind:'reading_start'});while(question(p).kind!=='read')finish(p);const q=question(p);
 assert.throws(()=>step(p,{kind:'reading_answer',questionId:q.id,answer:'alone'}));
 step(p,{kind:'reading_hint',questionId:q.id});step(p,{kind:'reading_answer',questionId:q.id,answer:'alone',observer:'grownup'});
 assert.equal(q.result.independent,false);assert.equal(p.reading.history.at(-1).parentConfirmed,true);
});
test('next-day reading checks revisit earlier words without replaying todays modeled word',()=>{
 const r=freshReading();r.seen={am:1000,mat:500};const s=readingLesson(r,2,1000+86400001),q=s.questions[5];
 assert.equal(q.word,'am');assert.equal(q.delayed,true);assert.equal(q.novel,false);
 const current=readingLesson(r,2,2000).questions[5];assert.equal(current.word,'at');assert.equal(current.delayed,false);assert.equal(current.novel,true);
});
