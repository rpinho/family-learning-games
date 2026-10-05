import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,prepareProfile} from '../lib/math.mjs';
test('counting is harder: 6–13 targets, mixed-object rounds and close answer choices',()=>{
 const p=freshProfile('admin'),modes=new Set(),totals=new Set();
 for(let i=0;i<500;i++){
  p.revision=i;const q=makeQuestion(p,'count',i);modes.add(q.mode);totals.add(q.count);
  assert.ok(q.count>=6&&q.count<=13);assert.ok(q.items.length<=13);assert.equal(q.items.filter(v=>v.object===q.object).length,q.answer);
  assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));assert.ok(q.options.every(n=>n>=0&&n<=13&&Math.abs(n-q.answer)<=3));
  if(q.mode==='only'){assert.ok(q.items.some(v=>v.object!==q.object));assert.equal(q.prompt,'Count only the '+q.noun+'.');}else assert.ok(q.items.every(v=>v.object===q.object));
 }
 assert.equal(modes.size,3);for(let n=6;n<=13;n++)assert.ok(totals.has(n));
});
test('six correct harder counting rounds retain auto-next scoring and reward behavior',()=>{
 const p=freshProfile('beginner'),act=input=>action(p,{...input,revision:p.revision});act({kind:'start',game:'count'});
 for(let i=0;i<6;i++){const q=p.session.question;act({kind:'answer',answer:q.items.filter(x=>x.object===q.object).length,questionId:q.id});act({kind:'next',auto:true});}
 assert.equal(p.xp,60);assert.equal(p.lessons,1);assert.equal(p.ceiling,13);assert.equal(p.session.finished,true);
});

test('only the counting track occasionally extends to 14–16, with close valid choices',()=>{
 const p=freshProfile('beginner'),counts=new Set();let stretched=0;
 for(let i=0;i<3000;i++){
  p.revision=i;const q=makeQuestion(p,'count',i%6);
  assert.ok(q.count>=6&&q.count<=16);assert.ok(q.items.length<=16);
  assert.equal(q.items.filter(x=>x.object===q.object).length,q.answer);
  assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));
  assert.ok(q.options.every(n=>n>=0&&n<=q.max&&Math.abs(n-q.answer)<=3));
  if(q.count>13){stretched++;counts.add(q.count);assert.equal(q.max,16);assert.notEqual(q.mode,'only');}
  else assert.equal(q.max,13);
 }
 assert.ok(stretched/3000>.30&&stretched/3000<.37,'about one in three, got '+stretched);
 assert.deepEqual([...counts].sort(),[14,15,16]);assert.equal(p.ceiling,13);
});
test('counting extension never alters other tracks or an existing saved question',()=>{
 const p=freshProfile('beginner');
 for(let i=0;i<300;i++)for(const game of ['mix','line','missing','addobjects','subtract','pattern']){
  p.revision=i;const q=makeQuestion(p,game,i%6);
  if(game!=='pattern'){assert.ok(q.max<=13);assert.ok(q.total<=13);assert.ok(q.options.every(n=>n<=13));}
 }
 const original=structuredClone(p);makeQuestion(p,'count',0);assert.deepEqual(p,original);
 const old=freshProfile('beginner');old.session={game:'count',question:makeQuestion(freshProfile('admin'),'count',0),result:null,finished:false};
 const before=structuredClone(old);prepareProfile(old);assert.deepEqual(old,before,'refresh preserves an existing small counting question');
});
test('each extended count can be accepted, scored, persisted and resumed without raising the profile ceiling',()=>{
 for(const count of [14,15,16]){
  const p=freshProfile('beginner');let q;
  for(let i=0;i<1000;i++){p.revision=i;q=makeQuestion(p,'count');if(q.count===count)break;}
  assert.equal(q.count,count);p.session={game:'count',round:0,question:q,started:1000,correct:0,independent:0};
  action(p,{kind:'answer',questionId:q.id,answer:count,revision:p.revision},2000);
  const saved=JSON.parse(JSON.stringify(p));assert.equal(saved.history.at(-1).answer,count);
  assert.equal(saved.session.result.answer,count);assert.equal(saved.xp,10);assert.equal(saved.ceiling,13);
  action(saved,{kind:'next',revision:saved.revision},3000);assert.equal(saved.session.round,1);
 }
});
