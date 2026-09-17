import test from 'node:test';
import assert from 'node:assert/strict';
import {useHint,wasHinted} from '../public/hints.mjs';
import {freshProfile,nextChallenge,applyAttempt,expectedAnswer,startDuel,useMatchHint} from '../public/engine.mjs';
import {soccerAction} from '../public/soccer.mjs';
import {readingAction,readingHintState} from '../public/reading.mjs';

test('Empty legacy balances never block help; grants survive reload and replay is deduplicated',()=>{
 let p=freshProfile('admin');p.hintBank={tokens:0,at:Date.now(),grants:['old']};
 for(let i=0;i<8;i++)assert.equal(useHint(p,'new:'+i),true);
 p=JSON.parse(JSON.stringify(p));assert.equal(useHint(p,'new:7'),false);assert.ok(wasHinted(p,'old'));
});
test('Reading gives an immediate cue then a paced model; reload/spam cannot skip the pause',()=>{
 let p=freshProfile('admin');readingAction(p,{kind:'start',focus:'decode'});
 const input={kind:'help',help:'show',questionId:p.reading.question.id};
 assert.equal(readingHintState(p).label,'Help me');
 readingAction(p,input);assert.deepEqual(p.reading.help,['cue']);assert.equal(readingHintState(p).waitSeconds,5);
 p=JSON.parse(JSON.stringify(p));const before=JSON.stringify(p);
 assert.equal(readingAction(p,input).kind,'help-wait');assert.equal(JSON.stringify(p),before);
 p.reading.hintReadyAt=Date.now()-1;readingAction(p,input);assert.deepEqual(p.reading.help,['cue','show']);
 const revision=p.revision;readingAction(p,input);assert.equal(p.revision,revision);
 const result=readingAction(p,{kind:'answer',questionId:p.reading.question.id,answer:p.reading.question.answer,durationMs:500});assert.equal(result.independent,false);
 readingAction(p,{kind:'next'});assert.equal(readingHintState(p).label,'Help me');assert.equal(readingHintState(p).waitSeconds,0);
});
test('Read-aloud starts the same pause; repeating a cue never extends it',()=>{
 const p=freshProfile('admin');readingAction(p,{kind:'start',focus:'story'});
 const input={kind:'help',help:'read',questionId:p.reading.question.id};readingAction(p,input);
 const at=p.reading.hintReadyAt;readingAction(p,input);assert.equal(p.reading.hintReadyAt,at);
 assert.equal(readingAction(p,{...input,help:'show'}).kind,'help-wait');
});
test('All soccer kicks can receive help, still counted as supported practice',()=>{
 const p=freshProfile('admin');soccerAction(p,{kind:'start'});
 for(let i=0;i<5;i++){
  soccerAction(p,{kind:'ready'});const q=p.soccer.question;
  soccerAction(p,{kind:'hint',questionId:q.id});const rev=p.revision;soccerAction(p,{kind:'hint',questionId:q.id});assert.equal(p.revision,rev);
  const r=soccerAction(p,{kind:'answer',questionId:q.id,answer:q.answer,durationMs:1000});
  assert.equal(r.goal,false);assert.equal(r.xp,0);assert.equal(r.kind,'practice');soccerAction(p,{kind:'next'});
 }
 assert.equal(p.xp,0);assert.equal(p.soccer.stats.goals,0);
 startDuel(p);assert.doesNotThrow(()=>useMatchHint(p));
});
test('Server-owned lesson reveals cannot be cleared by lying about assistance',()=>{
 const p=freshProfile('admin'),q=nextChallenge(p);useHint(p,`lesson:${q.id}`);
 applyAttempt(p,q,{answer:expectedAnswer(q),helped:false,durationMs:1000,strokes:q.paths});assert.equal(p.history.at(-1).helped,true);
});
