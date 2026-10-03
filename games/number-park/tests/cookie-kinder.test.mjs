import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshProfile,action,publicState,gamesFor,GAMES} from '../lib/math.mjs';
import {cookieProgress,challengeLevel} from '../lib/explorer.mjs';
import {KINDER_TRACK,KINDER_LEVELS,KINDER_MAX_TOTAL,KINDER_START,KINDER_UNEVEN,kinderProgress,kinderQuestion,kinderVoiceLines,kinderPrompt,kinderWin,KINDER_TIP,KINDER_HINT} from '../lib/cookie-kinder.mjs';
import {daySummary} from '../lib/day-summary.mjs';
const act=(p,input,now)=>action(p,{...input,revision:p.revision},now);
// Deal one-for-you-one-for-me onto the plates, one saved move at a time.
const deal=(p,now)=>{const q=p.session.question;for(let id=0;id<q.total;id++){const draft=[...p.session.cookieDraft];draft[id]=id%q.plates;act(p,{kind:'cookie-place',questionId:q.id,draft},now);}};
const clean=(p,now)=>{deal(p,now);act(p,{kind:'cookie-check',questionId:p.session.question.id},now);};
const next=p=>act(p,{kind:'next'});

test('Beginner keeps every small-number game and gains Cookie sharing; Explorer keeps his own list',()=>{
 const d=gamesFor(freshProfile('beginner'));
 assert.deepEqual(d.slice(0,GAMES.length),GAMES);assert.equal(d.at(-1).id,'cookies');assert.equal(d.at(-1).title,'Cookie sharing');
 assert.equal(gamesFor(freshProfile('explorer')).filter(g=>g.id==='cookies').length,1);
 assert.equal(gamesFor(freshProfile('explorer')).find(g=>g.id==='cookies').title,'Cookie division');
});

test('Every kindergarten round is fair sharing of 10 or fewer cookies onto 2 or 3 plates, every line is voiced',()=>{
 const lines=new Set(kinderVoiceLines());
 for(const level of Object.keys(KINDER_LEVELS).map(Number))for(let i=0;i<60;i++){
  const q=kinderQuestion(level,()=>((i*41)%97)/97);
  assert.equal(q.track,KINDER_TRACK);assert.equal(q.mode,'share');assert.equal(q.plan,'drag3');assert.equal(q.fade,'show');
  assert.ok([2,3].includes(q.plates));assert.ok(q.total>=2&&q.total<=KINDER_MAX_TOTAL);assert.equal(q.total,q.plates*q.answer);
  assert.equal(q.leftover,0);assert.ok(lines.has(q.prompt));assert.ok(lines.has(kinderWin(q.answer)));
  assert.doesNotMatch(q.prompt,/÷|divid|left over|remainder/i);
  if(level<=2)assert.equal(q.plates,2);
 }
 for(const l of [KINDER_TIP,KINDER_HINT,KINDER_UNEVEN])assert.ok(lines.has(l));
 assert.equal(kinderPrompt(4,2),'Share 4 cookies with 2 friends.');

});

test('A fair share wins at once: no question step, no number choices, no symbols; uneven plates are pointed out',()=>{
 const p=freshProfile('beginner');act(p,{kind:'start',game:'cookies'});
 const q=p.session.question;assert.equal(q.level,KINDER_START);assert.equal(p.session.cookieAsk,undefined);
 assert.equal(publicState(p).session.question.answer,undefined);
 // Everything on plate 0 first: the check flags it and does not end the round.
 for(let id=0;id<q.total;id++){const draft=[...p.session.cookieDraft];draft[id]=0;act(p,{kind:'cookie-place',questionId:q.id,draft});}
 act(p,{kind:'cookie-check',questionId:q.id});
 assert.equal(p.session.result,null);assert.equal(p.session.cookieMessage,KINDER_UNEVEN);assert.equal(p.session.cookieAsk,undefined);
 // Move half to the other plate(s), one at a time.
 for(let id=0;id<q.total;id++){if(id%q.plates===0)continue;const draft=[...p.session.cookieDraft];draft[id]=id%q.plates;act(p,{kind:'cookie-place',questionId:q.id,draft});}
 act(p,{kind:'cookie-check',questionId:q.id});
 assert.deepEqual(p.session.result,{ok:true,answer:q.answer,xp:4,helped:true});assert.equal(p.session.cookieAsk,undefined);
 const h=p.history.at(-1);assert.equal(h.question.track,KINDER_TRACK);assert.equal(h.cookieChecks,1);assert.deepEqual(h.distribution,Array(q.plates).fill(q.answer));
 assert.throws(()=>act(p,{kind:'cookie-answer',questionId:q.id,value:q.answer}));
});

test('Adaptive inside the easy band: three clean rounds up, two rough rounds down, Help taps alone neither',()=>{
 const p=freshProfile('beginner');act(p,{kind:'start',game:'cookies'});
 for(let i=0;i<3;i++){clean(p);assert.equal(p.session.result.xp,10);next(p);}
 assert.equal(kinderProgress(p).level,KINDER_START+1);assert.equal(p.session.question.level,KINDER_START+1);
 // Help tap only.
 act(p,{kind:'hint'});clean(p);next(p);assert.equal(kinderProgress(p).level,KINDER_START+1);
 // Two rough rounds (uneven first).
 for(let i=0;i<2;i++){const q=p.session.question;for(let id=0;id<q.total;id++){const draft=[...p.session.cookieDraft];draft[id]=0;act(p,{kind:'cookie-place',questionId:q.id,draft});}
  act(p,{kind:'cookie-check',questionId:q.id});for(let id=0;id<q.total;id++){if(id%q.plates===0)continue;const draft=[...p.session.cookieDraft];draft[id]=id%q.plates;act(p,{kind:'cookie-place',questionId:q.id,draft});}
  act(p,{kind:'cookie-check',questionId:q.id});assert.ok(p.session.result.ok);if(p.session.round<5)next(p);}
 assert.equal(kinderProgress(p).level,KINDER_START);
 // Never leaves the band.
 const top=freshProfile('beginner');top.history=Array.from({length:40},()=>({ok:true,helped:false,cookieChecks:0,question:{track:KINDER_TRACK}}));
 assert.equal(kinderProgress(top).level,5);
 top.history=Array.from({length:40},()=>({ok:true,helped:true,cookieChecks:2,question:{track:KINDER_TRACK}}));assert.equal(kinderProgress(top).level,1);
});

test('Easier/Harder replaces the current round at once and adaptation continues from the chosen level',()=>{
 const p=freshProfile('beginner');act(p,{kind:'start',game:'cookies'});
 const before=p.session.question;deal(p);const xp=p.xp,round=p.session.round;
 // Mid-round, with cookies already placed.
 act(p,{kind:'cookie-level',delta:1});
 assert.equal(p.session.question.level,KINDER_START+1);assert.notEqual(p.session.question.id,before.id);
 assert.ok(p.session.cookieDraft.every(v=>v===null));assert.equal(p.session.cookieDraft.length,p.session.question.total);
 assert.equal(p.session.round,round);assert.equal(p.xp,xp);assert.equal(p.history.length,0);
 act(p,{kind:'cookie-level',delta:-1});act(p,{kind:'cookie-level',delta:-1});assert.equal(p.session.question.level,KINDER_START-1);
 act(p,{kind:'cookie-level',delta:-1});assert.equal(p.session.question.level,1); // floor
 assert.equal(p.kinderCookies.changes.length,4);
 for(let i=0;i<3;i++){clean(p);next(p);}
 assert.equal(kinderProgress(p).level,2);assert.equal(p.session.question.level,2);
 assert.throws(()=>act(p,{kind:'cookie-level',delta:3}));
 assert.throws(()=>act(freshProfile('explorer'),{kind:'cookie-level',delta:1}));
});

test('Explorer’s cookie track and saves are untouched by kindergarten rows',()=>{
 const f=freshProfile('explorer');act(f,{kind:'start',game:'cookies'});
 assert.equal(f.session.question.track,'explorer-math-1');
 const before=cookieProgress(f);f.history.push(...Array.from({length:10},()=>({ok:true,helped:false,cookieChecks:0,question:{track:KINDER_TRACK,skill:'cookies',plan:'drag3',fade:'show'}})));
 assert.deepEqual(cookieProgress(f),before);assert.equal(challengeLevel(f,'cookies'),before.level);
});

test('Existing Beginner progress is preserved and the parent summary names the kindergarten level',()=>{
 const p=freshProfile('beginner');p.xp=330;p.lessons=30;p.completed={pattern:22};p.history=[{at:'2026-09-19T23:22:04.749Z',game:'subtract',question:{kind:'subtract'},ok:false,helped:false}];
 const now=Date.parse('2026-10-01T15:00:00Z');act(p,{kind:'start',game:'cookies'},now);clean(p,now);
 assert.equal(p.completed.pattern,22);assert.equal(p.lessons,30);assert.equal(p.history[0].game,'subtract');assert.equal(p.xp,340);
 const s=daySummary(p,'2026-10-01','America/New_York');
 assert.equal(s.levels.kinderCookies.level,KINDER_START);assert.equal(s.levels.cookies,undefined);
 assert.equal(s.games[0].title,'Cookie sharing');
});
