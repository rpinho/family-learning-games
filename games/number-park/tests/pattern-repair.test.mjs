import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,publicState} from '../lib/math.mjs';
import {nearPatternGap,patternLevel} from '../lib/play-practice.mjs';
test('Repair changes manipulation, not difficulty bounds; every slot is solvable across tiers',()=>{
 for(const level of [1,2,3])for(let n=0;n<150;n++){
  const p=freshProfile('beginner');p.revision=n;
  p.history=Array.from({length:level===1?2:level===3?5:0},()=>({ok:level===3,helped:false,question:{patternVersion:2}}));
  const q=makeQuestion(p,'pattern',2);assert.equal(q.mode,'repair');assert.equal(q.level,level);assert.equal(patternLevel(p),level);
  assert.equal(q.sequence.filter(x=>x===null).length,1);assert.equal(q.answer,q.unit[(q.blank+q.phase)%q.unit.length]);assert.equal(q.options.length,4);assert.equal(p.ceiling,13);
 }
});
test('Forgiving target catches nearby drops, not distant releases',()=>{
 const rect={left:100,right:160,top:40,bottom:100};assert.ok(nearPatternGap(80,60,rect));assert.ok(nearPatternGap(180,120,rect));assert.ok(!nearPatternGap(20,60,rect));
});
test('Repair server scoring is once-only, help persists, and wrong drops are recorded',()=>{
 const p=freshProfile('beginner');action(p,{kind:'start',game:'pattern',revision:p.revision});p.session.question=makeQuestion(p,'pattern',2);
 const q=p.session.question;assert.equal(publicState(p).session.question.answer,undefined);
 action(p,{kind:'hint',revision:p.revision});const input={kind:'answer',questionId:q.id,answer:q.answer,revision:p.revision};action(p,input);assert.equal(p.session.result.xp,4);assert.equal(p.history.at(-1).question.mode,'repair');assert.equal(p.history.at(-1).helped,true);assert.throws(()=>action(p,{...input,revision:p.revision}));
 action(p,{kind:'next',revision:p.revision});p.session.question=makeQuestion(p,'pattern',2);const bad=p.session.question;
 action(p,{kind:'answer',questionId:bad.id,answer:bad.options.find(x=>x!==bad.answer),revision:p.revision});assert.equal(p.history.at(-1).ok,false);
});
