import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action,publicState,gamesFor,prepareProfile} from '../lib/math.mjs';
import {challengeLevel,EXPLORER_TRACK} from '../lib/explorer.mjs';
import {cookiePrompt,cookieVoiceLines,cookieQuestion,isDragCookie,askLine,ASK_ROWS} from '../lib/cookie-division.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
// Plates fair → answer the three-choice question (the new last step of a drag round).
const finish=(p,q)=>{act(p,{kind:'cookie-check',questionId:q.id});if(p.session.cookieAsk)act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});};
const target=(q,id)=>q.mode==='bags'?Math.floor(id/q.bagSize):Math.floor(id/q.answer);

test('all levels keep drag sharing and every prompt is spoken',()=>{
 const p=freshProfile('explorer'),lines=new Set(cookieVoiceLines());
 assert.equal(challengeLevel(p,'cookies'),1);
 for(let level=1;level<=3;level++)for(let i=0;i<100;i++){
  const q=cookieQuestion(level,()=>((i*37)%97)/97);
  assert.equal(q.level,level);assert.equal(q.plan,'drag3');assert.ok(lines.has(q.prompt));
  if(q.mode==='bags'){assert.ok(level>=3);assert.equal(q.total,q.bagSize*q.answer);continue;}
  if(q.mode==='rows'){assert.ok(level>=2);assert.equal(q.total,q.plates*q.answer);continue;}
  assert.equal(q.mode,'share');
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
 finish(p,q);assert.deepEqual(p.session.result,{ok:true,answer:q.answer,xp:4,helped:true});
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
 // Help fades inside the level: two clean rounds each at show, hide, then own.
 const stages=['show','show','hide','hide','own','own'];
 for(let round=0;round<6;round++){
  const q=p.session.question;
  assert.ok(['share','bags','rows'].includes(q.mode));assert.equal(q.level,2);assert.equal(q.fade,stages[round]);
  assert.equal(publicState(p).session.question.answer,undefined);
  assert.equal(!!p.session.cookieAsk?.predict,q.fade==='own');
  if(round===5)act(p,{kind:'hint'}); // help during a prediction skips it
  if(p.session.cookieAsk?.predict){
   assert.throws(()=>{const d=[...p.session.cookieDraft];d[0]=0;act(p,{kind:'cookie-place',questionId:q.id,draft:d});},/question/);
   act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});assert.equal(p.session.cookiePredict,q.answer);
  }
  for(let id=0;id<q.total;id++){
   const draft=[...p.session.cookieDraft];draft[id]=target(q,id);act(p,{kind:'cookie-place',questionId:q.id,draft});
  }
  finish(p,q);
  assert.equal(p.session.result.ok,true);assert.equal(p.session.result.helped,round===5);
  if(round===4)assert.equal(p.session.cookieMessage,'You knew it!');
  act(p,{kind:'next'});
 }
 assert.equal(p.completed.cookies,1);assert.equal(p.completed.multiply,3);
 assert.equal(p.xp,79);assert.equal(challengeLevel(p,'cookies'),2);assert.equal(challengeLevel(p,'multiply'),2);

 assert.equal(p.session.finished,true);
});

test('levels 4-5 start from a lopsided layout that needs reasoning, not just dealing',()=>{
 const lines=new Set(cookieVoiceLines());
 for(const level of [4,5])for(let i=0;i<300;i++){
  const q=cookieQuestion(level,Math.random);
  if(q.mode==='bags'||q.mode==='rows')continue;
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
 for(let rev=1;rev<80;rev++){p.revision=rev;act(p,{kind:'start',game:'cookies'});if(p.session.question.mode==='fix')break;}
 const q=p.session.question;
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
 finish(p,q);
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

test('bags: each bag holds a fixed number, overfilling is refused, and the answer is the number of bags',()=>{
 let q;for(let i=0;i<200&&!(q&&q.mode==='bags');i++)q=cookieQuestion(4,Math.random);
 assert.equal(q.mode,'bags');assert.equal(q.total,q.bagSize*q.answer);assert.ok(q.plates>q.answer);
 const p=freshProfile('explorer');q={...q,id:'bags1',track:EXPLORER_TRACK};
 p.session={game:'cookies',round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:0,question:q,cookieDraft:Array(q.total).fill(null)};
 assert.equal(publicState(p).session.question.answer,undefined);
 const put=(id,bag)=>{const d=[...p.session.cookieDraft];d[id]=bag;act(p,{kind:'cookie-place',questionId:q.id,draft:d});};
 for(let id=0;id<q.bagSize;id++)put(id,0);
 assert.throws(()=>put(q.bagSize,0),/full/);
 for(let id=q.bagSize;id<q.total-1;id++)put(id,Math.floor(id/q.bagSize));
 put(q.total-1,q.answer); // last cookie in a new bag: one bag not full
 act(p,{kind:'cookie-check',questionId:q.id});assert.match(p.session.cookieMessage,/not full/);assert.equal(p.session.cookieAsk,undefined);
 put(q.total-1,q.answer-1);
 act(p,{kind:'cookie-check',questionId:q.id});assert.equal(p.session.cookieAsk.options.length,3);assert.ok(p.session.cookieAsk.options.includes(q.answer));
 assert.throws(()=>put(0,1)); // board is frozen while the question is open
 const wrong=p.session.cookieAsk.options.find(v=>v!==q.answer);
 act(p,{kind:'cookie-answer',questionId:q.id,value:wrong});assert.equal(p.session.result,null);assert.match(p.session.cookieMessage,/full bags/);
 act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});
 assert.equal(p.session.result.ok,true);assert.equal(p.session.result.helped,true);assert.equal(p.history.at(-1).askTries,1);
});
test('an independent share round needs the right count to earn full stars',()=>{
 const p=freshProfile('explorer'),q={...cookieQuestion(1,()=>0),id:'ask1',track:EXPLORER_TRACK};
 p.session={game:'cookies',round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:0,question:q,cookieDraft:Array(q.total).fill(null)};
 for(let id=0;id<q.total;id++){const d=[...p.session.cookieDraft];d[id]=Math.floor(id/q.answer);act(p,{kind:'cookie-place',questionId:q.id,draft:d});}
 act(p,{kind:'cookie-check',questionId:q.id});assert.equal(p.session.result,null);assert.ok(p.session.cookieAsk);
 assert.throws(()=>act(p,{kind:'cookie-answer',questionId:q.id,value:99}));
 act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});assert.deepEqual(p.session.result,{ok:true,answer:q.answer,xp:10,helped:false});
 act(p,{kind:'next'});assert.equal(p.session.cookieAsk,undefined);
});

test('rows of cookies: mixed into levels 2+, start at 3 rows, drag like plates, ask per row',()=>{
 const lines=new Set(cookieVoiceLines()),seen={1:0,2:0,3:0,4:0,5:0};
 for(const level of [1,2,3,4,5])for(let i=0;i<300;i++){
  const q=cookieQuestion(level,Math.random);if(q.mode!=='rows')continue;seen[level]++;
  assert.ok(q.plates>=3&&q.plates<=(level===2?4:5));assert.ok(q.answer>=3);assert.ok(q.total<=24);
  assert.equal(q.total,q.plates*q.answer);assert.ok(lines.has(q.prompt));assert.equal(q.plan,'drag3');
  assert.ok(isDragCookie(q),'rows must use the drag screen, never the old button screen');assert.equal(askLine(q),ASK_ROWS);
 }
 assert.equal(seen[1],0);for(const level of [2,3,4,5])assert.ok(seen[level]>40,`level ${level} rows ${seen[level]}`);
 assert.ok(lines.has(ASK_ROWS));
 let q;for(let i=0;i<200&&!(q&&q.mode==='rows');i++)q=cookieQuestion(2,Math.random);
 const p=freshProfile('explorer');q={...q,id:'rows1',track:EXPLORER_TRACK};
 p.session={game:'cookies',round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:0,question:q,cookieDraft:Array(q.total).fill(null)};
 const put=(id,row)=>{const d=[...p.session.cookieDraft];d[id]=row;act(p,{kind:'cookie-place',questionId:q.id,draft:d});};
 for(let id=0;id<q.total;id++)put(id,id===0?1:Math.floor(id/q.answer));
 act(p,{kind:'cookie-check',questionId:q.id});assert.match(p.session.cookieMessage,/long row to a short row/);
 put(0,0);act(p,{kind:'cookie-check',questionId:q.id});assert.ok(p.session.cookieAsk);
 const wrong=p.session.cookieAsk.options.find(v=>v!==q.answer);
 act(p,{kind:'cookie-answer',questionId:q.id,value:wrong});assert.match(p.session.cookieMessage,/one row/);
 act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer});assert.equal(p.session.result.ok,true);assert.equal(p.history.at(-1).question.mode,'rows');
});
