import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action,publicState,gamesFor,makeQuestion} from '../lib/math.mjs';
import {challengeLevel} from '../lib/explorer.mjs';
import {cookiePrompt,cookieVoiceLines} from '../lib/cookie-division.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});

test('cookie questions start with small exact shares and all spoken prompts exist',()=>{
 const p=freshProfile('explorer'),lines=new Set(cookieVoiceLines());
 assert.equal(challengeLevel(p,'cookies'),1);
 for(let i=0;i<100;i++){
  p.revision=i;const q=makeQuestion(p,'cookies',i%6);
  assert.equal(q.level,1);assert.ok(q.plates===2||q.plates===3);
  assert.ok(q.answer>=2&&q.answer<=4);assert.equal(q.total,q.plates*q.answer);
  assert.equal(q.prompt,cookiePrompt(q.total,q.plates));assert.ok(lines.has(q.prompt));
 }
 assert.equal(gamesFor(freshProfile('beginner')).some(g=>g.id==='cookies'),false);
 assert.throws(()=>act(freshProfile('beginner'),{kind:'start',game:'cookies'}));
});

test('cookie sharing saves each move, rejects shortcuts and gives a non-revealing hint',()=>{
 const p=freshProfile('explorer');act(p,{kind:'start',game:'cookies'});const q=p.session.question;
 assert.equal(publicState(p).session.question.answer,undefined);
 assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:q.answer}));
 const put=(id,plate)=>{const draft=[...p.session.cookieDraft];draft[id]=plate;act(p,{kind:'cookie-place',questionId:q.id,draft});};
 put(0,0);assert.equal(publicState(p).session.cookieDraft[0],0);
 const skipped=[...p.session.cookieDraft];skipped[1]=0;skipped[2]=0;
 assert.throws(()=>act(p,{kind:'cookie-place',questionId:q.id,draft:skipped}));
 act(p,{kind:'hint'});assert.equal(publicState(p).session.question.answer,undefined);
 for(let id=1;id<q.total;id++)put(id,0);
 act(p,{kind:'cookie-check',questionId:q.id});assert.match(p.session.cookieMessage,/Not equal/);assert.equal(p.session.result,null);
 for(let id=q.answer;id<q.total;id++)put(id,Math.floor(id/q.answer));
 act(p,{kind:'cookie-check',questionId:q.id});assert.deepEqual(p.session.result,{ok:true,answer:q.answer,xp:4,helped:true});
 assert.equal(p.history.at(-1).cookieChecks,1);assert.equal(p.history.at(-1).distribution.length,q.plates);
 assert.throws(()=>act(p,{kind:'cookie-check',questionId:q.id}));
 act(p,{kind:'next'});assert.equal(p.session.cookieDraft.length,p.session.question.total);
 assert.ok(p.session.cookieDraft.every(v=>v===null));
});

test('six independent cookie rounds adapt only cookie skill and preserve other progress',()=>{
 const p=freshProfile('explorer');p.xp=25;p.completed={multiply:3};act(p,{kind:'start',game:'cookies'});
 for(let round=0;round<6;round++){
  const q=p.session.question;
  for(let id=0;id<q.total;id++){
   const draft=[...p.session.cookieDraft];draft[id]=id%q.plates;
   act(p,{kind:'cookie-place',questionId:q.id,draft});
  }
  act(p,{kind:'cookie-check',questionId:q.id});assert.equal(p.session.result.ok,true);act(p,{kind:'next'});
 }
 assert.equal(p.completed.cookies,1);assert.equal(p.completed.multiply,3);
 assert.equal(p.xp,85);assert.equal(challengeLevel(p,'cookies'),2);assert.equal(challengeLevel(p,'multiply'),2);
 assert.equal(p.session.finished,true);
});
