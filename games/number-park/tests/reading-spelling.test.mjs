import test from 'node:test';
import assert from 'node:assert/strict';
import {spellingSupport} from '../lib/reading-spelling.mjs';
import {PACKS, freshReading, readingLesson, readingAction} from '../lib/reading.mjs';

test('retry points to a mismatched position and retains correctly placed letters',()=>{
  const q={kind:'build',word:'sit',helped:true,result:{ok:false}};
  const slots=['s','t','a'];
  assert.deepEqual(spellingSupport(q,slots),{index:1,letter:'i'});
  slots[1]='i';
  assert.deepEqual(spellingSupport(q,slots),{index:2,letter:'t'});
  assert.deepEqual(spellingSupport(q,slots,0),null);
  slots[2]='t';assert.equal(spellingSupport(q,slots),null);
});
test('clean attempts, completed words and read-aloud never reveal a letter',()=>{
  for(const q of [{kind:'build',word:'cat',helped:false},{kind:'change',word:'cat',helped:true,result:{ok:true}},{kind:'read',word:'cat',helped:true}])assert.equal(spellingSupport(q,['','','']),null);
});
test('every existing build and change can be repaired one letter at a time without automatic submission',()=>{
  for(let level=0;level<PACKS.length;level++)for(let lesson=0;lesson<12;lesson++){
    const s=readingLesson({...freshReading(),level,lessons:lesson},lesson,1000);
    for(const q of s.questions.filter(q=>['build','change'].includes(q.kind))){
      q.helped=true;const slots=q.kind==='change'?[...q.from]:[...q.word].map(()=>q.bank.find(l=>l!==q.word[0]));
      let cue,repairs=0;while((cue=spellingSupport(q,slots))){assert.ok(q.bank.includes(cue.letter));slots[cue.index]=cue.letter;assert.ok(++repairs<=q.word.length);}
      assert.equal(slots.join(''),q.word);assert.equal(q.result,null);assert.equal(q.attempts,0);
    }
  }
});
test('a supported correction saves one practice result and cannot manufacture independent credit',()=>{
  const p={reading:freshReading(),revision:0};readingAction(p,{kind:'reading_start'},1000);
  const s=p.reading.session;s.round=3;const q=s.questions[3];
  readingAction(p,{kind:'reading_answer',questionId:q.id,answer:'sat'},1100);
  assert.equal(q.result.ok,false);const slots=[...'sat'],cue=spellingSupport(q,slots);slots[cue.index]=cue.letter;
  readingAction(p,{kind:'reading_answer',questionId:q.id,answer:slots.join('')},1200);
  assert.equal(q.result.independent,false);assert.equal(q.result.stars,1);assert.equal(p.reading.history.length,2);
  assert.throws(()=>readingAction(p,{kind:'reading_answer',questionId:q.id,answer:q.word},1300));
});
