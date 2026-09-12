import test from 'node:test';
import assert from 'node:assert/strict';
import {hintState,useHint,wasHinted,HINT_REFILL_MS} from '../public/hints.mjs';
import {freshProfile,nextChallenge,applyAttempt,expectedAnswer,startDuel,useMatchHint} from '../public/engine.mjs';
import {soccerAction} from '../public/soccer.mjs';
import {readingAction} from '../public/reading.mjs';
import {soccerView} from '../public/soccer-view.mjs';
test('Two hints persist across reload, refill one at a time, and do not accrue beyond two',()=>{
 let p=freshProfile('beginner');assert.equal(hintState(p,1000).tokens,2);
 useHint(p,'soccer:1',1000);useHint(p,'reading:1',2000);p=JSON.parse(JSON.stringify(p));
 assert.equal(hintState(p,2000).tokens,0);assert.throws(()=>useHint(p,'new',2000),/89 seconds/);
 assert.equal(useHint(p,'soccer:1',2000),false);assert.equal(hintState(p,2000).tokens,0);
 assert.equal(hintState(p,91000).tokens,1);useHint(p,'new',91000);assert.equal(hintState(p,91000).tokens,0);
 assert.equal(hintState(p,900000).tokens,2);useHint(p,'later',900000);assert.equal(hintState(p,900001).tokens,1);
 assert.equal(hintState(freshProfile('explorer'),2000).tokens,2);
});
test('Soccer cannot farm goals or XP with hints; refreshing and starting again cannot refill them',()=>{
 const p=freshProfile('beginner');soccerAction(p,{kind:'start'});
 for(let i=0;i<5;i++){
  soccerAction(p,{kind:'ready'});const q=p.soccer.question;
  if(i<2){soccerAction(p,{kind:'hint',questionId:q.id});const rev=p.revision;soccerAction(p,{kind:'hint',questionId:q.id});assert.equal(p.revision,rev);}
  else assert.throws(()=>soccerAction(p,{kind:'hint',questionId:q.id}),/No hints left/);
  const r=soccerAction(p,{kind:'answer',questionId:q.id,answer:i<2?q.answer:q.options.find(a=>a!==q.answer),durationMs:1000});
  assert.equal(r.goal,false);assert.equal(r.xp,0);if(i<2){assert.equal(r.kind,'practice');assert.match(soccerView(p),/Practice shot — no goal/);}
  soccerAction(p,{kind:'next'});
 }
 assert.equal(p.xp,0);assert.equal(p.gems,0);assert.equal(p.soccer.stats.goals,0);
 soccerAction(p,{kind:'start'});assert.equal(hintState(p).tokens,0);
});
test('Hint allowance is shared by soccer, reading, and matches, not by browser or game',()=>{
 const p=freshProfile('beginner');soccerAction(p,{kind:'start'});soccerAction(p,{kind:'ready'});
 soccerAction(p,{kind:'hint',questionId:p.soccer.question.id});readingAction(p,{kind:'start',focus:'decode'});
 readingAction(p,{kind:'help',help:'read',questionId:p.reading.question.id});
 readingAction(p,{kind:'help',help:'show',questionId:p.reading.question.id});assert.equal(hintState(p).tokens,0);
 startDuel(p);assert.throws(()=>useMatchHint(p),/No hints left/);assert.equal(p.duel.rook,0);
});
test('Server-owned lesson reveals cannot be cleared by lying about assistance',()=>{
 const p=freshProfile('beginner'),q=nextChallenge(p);useHint(p,`lesson:${q.id}`);
 assert.ok(wasHinted(p,`lesson:${q.id}`));applyAttempt(p,q,{answer:expectedAnswer(q),helped:false,durationMs:1000,strokes:q.paths});
 assert.equal(p.history.at(-1).helped,true);
});
