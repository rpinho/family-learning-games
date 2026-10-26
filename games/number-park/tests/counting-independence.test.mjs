import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,publicState,prepareProfile} from '../lib/math.mjs';

test('every third counting card offers six to ten targets without number cues',()=>{
 const p=freshProfile('admin'),sizes=new Set();
 for(let seed=0;seed<100;seed++)for(let round=0;round<6;round++){
  p.revision=seed;
  const q=makeQuestion(p,'count',round);
  assert.equal(q.countWithoutNumbers,round%3===2);
  if(q.countWithoutNumbers){
   assert.ok(q.count>=6&&q.count<=10);sizes.add(q.count);
   assert.equal(q.items.filter(item=>item.object===q.object).length,q.answer);
   assert.ok(q.options.includes(q.answer));
  }
 }
 assert.deepEqual([...sizes].sort((a,b)=>a-b),[6,7,8,9,10]);
});

function probe(){
 const p=freshProfile('admin');
 action(p,{kind:'start',game:'count',revision:p.revision},1000);
 p.session.round=2;p.session.question=makeQuestion(p,'count',2);
 return JSON.parse(JSON.stringify(p));
}

test('a saved count without cues resumes and records an unhelped answer',()=>{
 const p=probe(),before=structuredClone(p);
 prepareProfile(p);assert.deepEqual(p,before);
 assert.equal(publicState(p).session.question.countWithoutNumbers,true);
 assert.equal(publicState(p).session.question.answer,undefined);
 action(p,{kind:'answer',questionId:p.session.question.id,answer:p.session.question.answer,revision:p.revision},2000);
 assert.equal(p.session.independent,1);assert.equal(p.session.result.xp,10);
 assert.equal(p.history.at(-1).question.countWithoutNumbers,true);
 assert.equal(p.history.at(-1).helped,false);
});

test('Help persists on the same card and its answer earns supported credit',()=>{
 let p=probe();const id=p.session.question.id;
 action(p,{kind:'hint',revision:p.revision},1500);
 p=JSON.parse(JSON.stringify(p));prepareProfile(p);
 const view=publicState(p);assert.equal(view.session.question.id,id);
 assert.equal(view.session.helped,true);assert.equal(typeof view.session.question.answer,'number');
 action(p,{kind:'answer',questionId:id,answer:p.session.question.answer,revision:p.revision},2000);
 assert.equal(p.session.independent,0);assert.equal(p.session.result.xp,4);
 assert.equal(p.history.at(-1).helped,true);
});

test('an old counting card keeps its existing support after refresh',()=>{
 const p=probe();delete p.session.question.countWithoutNumbers;
 const before=structuredClone(p);prepareProfile(p);assert.deepEqual(p,before);
 assert.equal(publicState(p).session.question.countWithoutNumbers,undefined);
});
