import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action} from '../lib/math.mjs';
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
