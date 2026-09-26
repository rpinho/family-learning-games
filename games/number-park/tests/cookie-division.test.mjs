import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action,publicState,gamesFor,makeQuestion} from '../lib/math.mjs';
import {challengeLevel} from '../lib/explorer.mjs';
import {cookiePrompt,cookieVoiceLines,cookieQuestion} from '../lib/cookie-division.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});

test('Explorer starts with remainders, then snack problems; every prompt is spoken',()=>{
 const p=freshProfile('explorer'),lines=new Set(cookieVoiceLines());
 assert.equal(challengeLevel(p,'cookies'),2);
 for(let level=1;level<=3;level++)for(let i=0;i<100;i++){
  const q=cookieQuestion(level,()=>((i*37)%97)/97);
  assert.equal(q.level,level);assert.equal(q.total,q.plates*q.answer+q.leftover);
  assert.equal(q.baked,q.total+q.eaten);assert.ok(lines.has(q.prompt));
  assert.equal(q.prompt,cookiePrompt(q.total,q.plates,q.mode,q.baked,q.eaten));
  if(level===1)assert.equal(q.mode,'share');
  if(level===2){assert.equal(q.mode,'remainder');assert.ok(q.leftover>0);}
  if(level===3){assert.equal(q.mode,'snack');assert.ok(q.eaten>=2);}
 }
 assert.equal(gamesFor(freshProfile('beginner')).some(g=>g.id==='cookies'),false);
 assert.throws(()=>act(freshProfile('beginner'),{kind:'start',game:'cookies'}));
});

test('cookie sharing saves each move, rejects shortcuts and gives a non-revealing hint',()=>{
 const p=freshProfile('explorer'),q={...cookieQuestion(1,()=>0),id:'legacy',track:'explorer-math-1'};
 delete q.mode; // Existing saves may contain a partially placed old round.
 p.session={game:'cookies',round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:0,question:q,cookieDraft:Array(q.total).fill(null)};
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
 act(p,{kind:'next'});assert.equal(p.session.question.mode,'share');assert.equal(p.session.cookieDraft.length,p.session.question.total);
});

test('old clients keep sharing while the new client opts into the harder plan',()=>{
 const old=freshProfile('explorer');act(old,{kind:'start',game:'cookies'});
 assert.equal(old.session.question.mode,'share');assert.equal(old.session.cookiePlanV2,false);
 const modern=freshProfile('explorer');act(modern,{kind:'start',game:'cookies',cookiePlanV2:true});
 assert.equal(modern.session.question.mode,'remainder');assert.equal(modern.session.cookiePlanV2,true);
});

test('mental cookie answers require quotient and leftovers, with corrections but no reveal',()=>{
 const p=freshProfile('explorer');act(p,{kind:'start',game:'cookies',cookiePlanV2:true});const q=p.session.question;
 assert.equal(q.mode,'remainder');assert.equal(publicState(p).session.question.answer,undefined);assert.equal(publicState(p).session.question.leftover,undefined);
 assert.throws(()=>act(p,{kind:'cookie-place',questionId:q.id,draft:[]}));
 assert.throws(()=>act(p,{kind:'cookie-check',questionId:q.id,perPlate:99,leftover:0}));
 act(p,{kind:'cookie-check',questionId:q.id,perPlate:q.answer-1,leftover:q.leftover});assert.equal(p.session.result,null);assert.equal(p.session.cookieChecks,1);assert.equal(publicState(p).session.question.answer,undefined);
 act(p,{kind:'cookie-check',questionId:q.id,perPlate:q.answer,leftover:q.leftover});assert.equal(p.session.result.ok,true);assert.equal(p.session.result.xp,4);
 assert.equal(p.history.at(-1).leftover,q.leftover);
});

test('four independent remainder rounds open two-step snack problems without changing other skills',()=>{
 const p=freshProfile('explorer');p.xp=25;p.completed={multiply:3};act(p,{kind:'start',game:'cookies',cookiePlanV2:true});
 for(let round=0;round<6;round++){
  const q=p.session.question;
  assert.equal(q.mode,round<4?'remainder':'snack');
  assert.equal(publicState(p).session.question.leftover,undefined);
  if(q.mode==='snack')assert.ok(q.baked>q.total);
  assert.equal(p.session.cookieDraft,undefined);
  act(p,{kind:'cookie-check',questionId:q.id,perPlate:q.answer,leftover:q.leftover});
  assert.equal(p.session.result.ok,true);act(p,{kind:'next'});
 }
 assert.equal(p.completed.cookies,1);assert.equal(p.completed.multiply,3);
 assert.equal(p.xp,85);assert.equal(challengeLevel(p,'cookies'),3);assert.equal(challengeLevel(p,'multiply'),2);
 assert.equal(p.session.finished,true);
});
