import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action,publicState,gamesFor,prepareProfile} from '../lib/math.mjs';
import {challengeLevel,EXPLORER_TRACK} from '../lib/explorer.mjs';
import {cookiePrompt,cookieVoiceLines,cookieQuestion} from '../lib/cookie-division.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});

test('all levels keep drag sharing and every prompt is spoken',()=>{
 const p=freshProfile('explorer'),lines=new Set(cookieVoiceLines());
 assert.equal(challengeLevel(p,'cookies'),1);
 for(let level=1;level<=3;level++)for(let i=0;i<100;i++){
  const q=cookieQuestion(level,()=>((i*37)%97)/97);
  assert.equal(q.level,level);assert.equal(q.mode,'share');assert.equal(q.plan,'drag3');
  assert.equal(q.total,q.plates*q.answer);assert.ok(q.total<=24);
  assert.equal(q.baked,q.total+q.eaten);assert.ok(lines.has(q.prompt));
  assert.equal(q.prompt,cookiePrompt(q.total,q.plates,q.mode,q.baked,q.eaten));
  assert.equal(q.leftover,0);assert.equal(q.eaten,0);
 }
 assert.equal(gamesFor(freshProfile('beginner')).some(g=>g.id==='cookies'),false);
 assert.throws(()=>act(freshProfile('beginner'),{kind:'start',game:'cookies'}));
});

test('cookie sharing saves each move, rejects shortcuts and gives a non-revealing hint',()=>{
 const p=freshProfile('explorer'),q={...cookieQuestion(1,()=>0),id:'legacy',track:'explorer-math-1'};
 delete q.mode;delete q.plan; // A partially placed old round survives the upgrade.
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

test('old and newer clients both start with draggable cookies',()=>{
 const old=freshProfile('explorer');act(old,{kind:'start',game:'cookies'});
 assert.equal(old.session.question.mode,'share');assert.equal(old.session.cookieDraft.length,old.session.question.total);
 const modern=freshProfile('explorer');act(modern,{kind:'start',game:'cookies',cookiePlanV2:true});
 assert.equal(modern.session.question.mode,'share');assert.equal(modern.session.cookieDraft.length,modern.session.question.total);
});

test('unfinished button-only problem becomes draggable without losing progress',()=>{
 const p=freshProfile('explorer');p.revision=44;p.xp=70;p.history=[{at:'earlier',game:'cookies'}];
 p.session={game:'cookies',round:2,correct:2,independent:2,helped:false,result:null,finished:false,started:100,question:{...cookieQuestion(2,()=>0),mode:'remainder',id:'button-only'},cookiePlanV2:true};
 prepareProfile(p);const q=p.session.question;
 assert.equal(q.mode,'share');assert.equal(q.plan,'drag3');assert.equal(q.level,1);
 assert.equal(p.session.round,2);assert.equal(p.session.correct,2);assert.equal(p.xp,70);assert.equal(p.revision,44);assert.equal(p.history.length,1);
 assert.ok(p.session.started>100);
 assert.equal(p.session.cookieDraft.length,q.total);assert.equal(publicState(p).session.question.answer,undefined);
 prepareProfile(p);assert.equal(p.session.question.id,q.id);
});

test('old easy wins seed moderate sharing; new independent rounds advance and hints ease it',()=>{
 const p=freshProfile('explorer');p.xp=25;p.completed={multiply:3};
 p.history=Array.from({length:8},()=>({game:'cookies',question:{track:EXPLORER_TRACK,skill:'cookies'},ok:true,helped:false}));
 assert.equal(challengeLevel(p,'cookies'),2);act(p,{kind:'start',game:'cookies'});
 for(let round=0;round<6;round++){
  const q=p.session.question;
  assert.equal(q.mode,'share');assert.equal(q.level,round<4?2:3);
  assert.equal(publicState(p).session.question.answer,undefined);
  for(let id=0;id<q.total;id++){
   const draft=[...p.session.cookieDraft];draft[id]=Math.floor(id/q.answer);act(p,{kind:'cookie-place',questionId:q.id,draft});
  }
  if(round>=4)act(p,{kind:'hint'});
  act(p,{kind:'cookie-check',questionId:q.id});
  assert.equal(p.session.result.ok,true);act(p,{kind:'next'});
 }
 assert.equal(p.completed.cookies,1);assert.equal(p.completed.multiply,3);
 assert.equal(p.xp,73);assert.equal(challengeLevel(p,'cookies'),2);assert.equal(challengeLevel(p,'multiply'),2);
 assert.equal(p.session.finished,true);
});

test('levels 4-5 start from a lopsided layout that needs reasoning, not just dealing',()=>{
 const lines=new Set(cookieVoiceLines());
 for(const level of [4,5])for(let i=0;i<300;i++){
  const q=cookieQuestion(level,Math.random);
  assert.equal(q.mode,level===4?'fix':'mixed');assert.equal(q.total,q.plates*q.answer);assert.ok(lines.has(q.prompt));
  assert.equal(q.start.length,q.total);
  const counts=Array.from({length:q.plates},(_,p)=>q.start.filter(v=>v===p).length),tray=q.start.filter(v=>v===null).length;
  assert.ok(Math.max(...counts.map(n=>Math.abs(n-q.answer)))>=1);
  if(level===4){assert.equal(tray,0);assert.ok(!counts.every(n=>n===counts[0]));assert.equal(!!q.hideCounts,false);}
  else{assert.ok(tray>=q.plates);assert.equal(q.hideCounts,true);}
 }
});

test('a fix round saves plate-to-plate moves, hides the answer, and only fair plates win',()=>{
 const p=freshProfile('explorer');
 p.history=Array.from({length:12},()=>({game:'cookies',question:{track:EXPLORER_TRACK,skill:'cookies',plan:'drag3',mode:'share'},ok:true,helped:false}));
 assert.equal(challengeLevel(p,'cookies'),4);
 act(p,{kind:'start',game:'cookies'});const q=p.session.question;
 assert.equal(q.mode,'fix');assert.deepEqual(p.session.cookieDraft,q.start);
 assert.equal(publicState(p).session.question.answer,undefined);
 act(p,{kind:'cookie-check',questionId:q.id});assert.match(p.session.cookieMessage,/Not equal/);assert.equal(p.session.result,null);
 // move plate-to-plate, one cookie at a time, until fair
 for(let guard=0;guard<60;guard++){
  const d=p.session.cookieDraft,counts=Array.from({length:q.plates},(_,i)=>d.filter(v=>v===i).length);
  if(counts.every(n=>n===q.answer))break;
  const from=counts.findIndex(n=>n>q.answer),to=counts.findIndex(n=>n<q.answer),id=d.indexOf(from);
  const next=[...d];next[id]=to;act(p,{kind:'cookie-place',questionId:q.id,draft:next});
 }
 act(p,{kind:'cookie-check',questionId:q.id});
 assert.equal(p.session.result.ok,true);assert.equal(p.session.result.helped,true); // one uneven check counts as corrected
 assert.equal(p.history.at(-1).question.mode,'fix');
});

test('the adaptive ladder now reaches level 5 and still eases on struggle',()=>{
 const p=freshProfile('explorer');
 p.history=Array.from({length:16},()=>({game:'cookies',question:{track:EXPLORER_TRACK,skill:'cookies',plan:'drag3'},ok:true,helped:false}));
 assert.equal(challengeLevel(p,'cookies'),5);
 p.history.push(...Array.from({length:2},()=>({game:'cookies',question:{track:EXPLORER_TRACK,skill:'cookies',plan:'drag3'},ok:true,helped:true})));
 assert.equal(challengeLevel(p,'cookies'),4);
});
