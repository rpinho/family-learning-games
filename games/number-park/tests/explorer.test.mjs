import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,gamesFor,makeQuestion,action,prepareProfile,publicState} from '../lib/math.mjs';
import {EXPLORER_TRACK,challengeLevel} from '../lib/explorer.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
test('Explorer has a separate menu and varied mathematically valid grade-2 challenge questions',()=>{
 const p=freshProfile('explorer');
 assert.deepEqual(gamesFor(p).map(g=>g.id),['mix','multiply','factor','sums','skip','place','cookies']);
 for(const game of gamesFor(p).filter(g=>g.id!=='cookies')){
  const unique=new Set();
  for(let i=0;i<400;i++){
   p.revision=i;const q=makeQuestion(p,game.id,i%6);unique.add(q.fingerprint);
   assert.equal(q.track,EXPLORER_TRACK);assert.equal(q.level,2);
   if(q.placeMode==='build'){assert.equal(q.target[0]*100+q.target[1]*10+q.target[2],q.total);assert.equal(q.answer,q.total);assert.ok(q.target[1]>=1&&q.total<=99);p.recent=[...p.recent,q.fingerprint].slice(-12);unique.add(q.fingerprint);continue;}
   assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));
   assert.ok(q.options.every(n=>Number.isInteger(n)&&n>=0&&n<=q.max));assert.ok(q.max<=200);
   if(['multiply','factor'].includes(q.kind)){assert.equal(q.a*q.b,q.total);assert.equal([q.a,q.b,q.total][q.blank],q.answer);assert.ok(q.a>=2&&q.a<=10&&q.b>=2&&q.b<=10);}
   if(q.kind==='sums'){assert.equal(q.operator==='+'?q.a+q.b:q.a-q.b,q.total);assert.equal([q.a,q.b,q.total][q.blank],q.answer);assert.ok(Math.max(q.a,q.total)>=20);}
   if(q.kind==='skip'){assert.equal(q.answer,q.sequence.at(-1)+q.step);assert.ok(q.sequence.slice(1).every((n,j)=>n-q.sequence[j]===q.step));}
   if(q.kind==='place'){assert.equal(q.tens*10+q.ones,q.total);assert.equal(q.answer,q.total);}
   p.recent=[...p.recent,q.fingerprint].slice(-12);
  }
  assert.ok(unique.size>20,game.id);
 }
});
test('skill adaptation needs unaided evidence, ignores old preschool attempts and does not transfer skills',()=>{
 const p=freshProfile('explorer');p.history=Array.from({length:30},()=>({ok:true,helped:false,question:{kind:'count'}}));
 assert.equal(challengeLevel(p,'multiply'),2);
 const record=(ok,helped=false)=>p.history.push({ok,helped,question:{track:EXPLORER_TRACK,skill:'multiply'}});
 for(let i=0;i<5;i++)record(true);assert.equal(challengeLevel(p,'multiply'),2);
 record(true);assert.equal(challengeLevel(p,'multiply'),3);assert.equal(challengeLevel(p,'sums'),2);
 record(true,true);record(true,true);assert.equal(challengeLevel(p,'multiply'),2);
 record(false);record(false);assert.equal(challengeLevel(p,'multiply'),1);
 for(let i=0;i<6;i++)record(true);assert.equal(challengeLevel(p,'multiply'),2);
});
test('all challenge tiers have bounded options, valid arithmetic and a hidden-factor/place-value stretch',()=>{
 for(const level of [1,3])for(const game of ['multiply','factor','sums','skip','place']){
  const p=freshProfile('explorer');p.history=Array.from({length:level===1?2:6},()=>({ok:level===3,helped:false,question:{track:EXPLORER_TRACK,skill:game}}));
  for(let i=0;i<150;i++){
   p.revision=i;const q=makeQuestion(p,game,i%6);assert.equal(q.level,level);
   if(q.placeMode==='build'){assert.equal(q.answer,q.total);assert.ok(q.total<=q.max);if(level===3)assert.ok(q.total>=100);continue;}
   assert.ok(q.answer>=0&&q.answer<=q.max);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));assert.ok(q.options.every(n=>n>=0&&n<=q.max));
   if(q.operator)assert.equal(q.operator==='×'?q.a*q.b:q.operator==='+'?q.a+q.b:q.a-q.b,q.total);
   if(game==='place'&&level===3){assert.ok(['tens','ones'].includes(q.placeMode));assert.equal(q.answer,q[q.placeMode]);}
  }
 }
});
test('Explorer scores and resumes without resetting old saves; Beginner and family Admin stay small',()=>{
 const p=freshProfile('explorer');p.xp=47;p.lessons=2;p.drawing=[[[1,1],[2,2]]];p.guided={'2':3};
 p.session={game:'addobjects',round:1,finished:false,result:{ok:true},question:{id:'legacy',kind:'addobjects'}};
 const before=structuredClone(p);prepareProfile(p);assert.deepEqual(p,before);
 act(p,{kind:'next'});assert.equal(p.session.question.track,EXPLORER_TRACK);assert.equal(p.xp,47);assert.deepEqual(p.drawing,before.drawing);
 act(p,{kind:'start',game:'multiply'});assert.equal(publicState(p).session.question.answer,undefined);
 const q=p.session.question;act(p,{kind:'answer',questionId:q.id,answer:q.answer});assert.equal(p.xp,57);assert.equal(p.session.independent,1);
 assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:q.answer}));
 for(const id of ['beginner','admin']){
  const child=freshProfile(id);assert.equal(child.ceiling,13);assert.throws(()=>act(child,{kind:'start',game:'multiply'}));
  act(child,{kind:'start',game:'addobjects'});assert.ok(child.session.question.total<=13);assert.equal(child.session.question.track,undefined);
 }
});
