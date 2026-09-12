import test from 'node:test';
import assert from 'node:assert/strict';
import {GAMES,freshProfile,makeQuestion,action,publicState} from '../lib/math.mjs';
import {GuidedTrace,railPoints} from '../lib/guided-trace.mjs';
import {readFile} from 'node:fs/promises';
const act=(p,input)=>action(p,{...input,revision:p.revision});
test('every game has valid varied questions, always within the fixed ceiling',()=>{
 for(const g of GAMES){const p=freshProfile('beginner'),unique=new Set();
  for(let i=0;i<200;i++){p.revision=i;const q=makeQuestion(p,g.id,i);unique.add(q.fingerprint);assert.equal(q.options.length,['pattern','count','addobjects'].includes(q.kind)?4:3);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options.includes(q.answer));if(q.kind!=='pattern'){assert.ok(q.answer>=0&&q.answer<=13);assert.ok(q.options.every(n=>n>=0&&n<=13));if(q.kind==='subtract')assert.equal(q.total-q.remove,q.answer);else if(q.kind!=='count')assert.equal(q.operator==='−'?q.a-q.b:q.a+q.b,q.total);}p.recent=[...p.recent,q.fingerprint].slice(-12);}
  assert.ok(unique.size>10,g.id);
 }
});
test('hundreds of perfect answers and replay never make the numbers bigger',()=>{
 const p=freshProfile('beginner');
 for(let lesson=0;lesson<40;lesson++){act(p,{kind:'start',game:'mix'});for(let i=0;i<6;i++){const q=p.session.question;assert.ok(q.total<=13);act(p,{kind:'answer',questionId:q.id,answer:q.answer});act(p,{kind:'next'});}assert.equal(p.ceiling,13);assert.ok(p.session.finished);}
 assert.equal(p.lessons,40);assert.equal(p.completed.mix,40);assert.equal(p.xp,2400);
});
test('hints persist, earn less, and do not count as independent; errors show the answer',()=>{
 const p=freshProfile('beginner');act(p,{kind:'start',game:'mix'});const q=p.session.question;
 assert.equal(publicState(p).session.question.answer,undefined);act(p,{kind:'hint'});assert.equal(publicState(p).session.question.answer,q.answer);
 act(p,{kind:'answer',questionId:q.id,answer:q.answer});assert.equal(p.xp,4);assert.equal(p.session.independent,0);assert.equal(p.history.at(-1).helped,true);
 assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:q.answer}));act(p,{kind:'next'});assert.equal(p.session.helped,false);
 const next=p.session.question;act(p,{kind:'answer',questionId:next.id,answer:(next.answer+1)%14});assert.equal(p.xp,4);assert.equal(p.session.result.answer,next.answer);
});
test('stale actions, malformed drawings and invalid modes fail before mutation',()=>{
 const p=freshProfile('admin'),before=structuredClone(p);assert.throws(()=>action(p,{kind:'start',game:'mix',revision:8}));assert.throws(()=>act(p,{kind:'start',game:'advanced'}));assert.throws(()=>act(p,{kind:'drawing',strokes:[[[Infinity,0]]]}));assert.deepEqual(p,before);
});
test('guided digits can all be completed with exact rail ink',async()=>{
 const digits=JSON.parse(await readFile(new URL('../lib/digits.json',import.meta.url)));
 for(const paths of Object.values(digits)){const rail=new GuidedTrace(paths);for(const path of paths){rail.begin(path[0]);for(const point of railPoints(path))rail.move(point);rail.release();}assert.equal(rail.done,true);assert.deepEqual(rail.completed,paths);}
});
