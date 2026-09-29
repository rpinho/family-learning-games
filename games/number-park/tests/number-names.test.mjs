import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,prepareProfile,publicState,random} from '../lib/math.mjs';
import {EXPLORER_TRACK,challengeLevel} from '../lib/explorer.mjs';
import {NUMBER_NAME_PAIRS,numberNameReview,numberNameVoiceLines} from '../lib/number-names.mjs';
import {buildFeedback,placeVoiceLines} from '../lib/place-build.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
test('listening practice covers every teen/ty pair and fades after two clean checks per target',()=>{
 const p=freshProfile('explorer'),seen=new Set();
 for(let i=0;i<16;i++){
  p.revision=i;const q=makeQuestion(p,'place',2);seen.add(q.total);
  assert.equal(q.skill,'number-name');assert.equal(q.show,'heard');
  assert.deepEqual(q.target,[0,Math.floor(q.total/10),q.total%10]);
  assert.ok(NUMBER_NAME_PAIRS.some(pair=>pair.includes(q.total)&&pair.includes(q.contrast)&&q.total!==q.contrast));
  p.history.push({question:q,ok:true,helped:false});
 }
 assert.deepEqual([...seen].sort((a,b)=>a-b),NUMBER_NAME_PAIRS.flat().sort((a,b)=>a-b));
 assert.equal(numberNameReview(p.history,random(4)).mastered,true);
 for(const completed of [1,2,4,5]){p.completed.place=completed;assert.notEqual(makeQuestion(p,'place',2).skill,'number-name');}
 p.completed.place=3;assert.equal(makeQuestion(p,'place',2).skill,'number-name');
 // A corrected review reopens practice, without changing either other ladder.
 const q=makeQuestion(p,'place',2);p.history.push({question:q,ok:true,helped:true});p.completed.place=4;
 assert.equal(makeQuestion(p,'place',2).skill,'number-name');
 assert.equal(challengeLevel(p,'place'),2);assert.equal(challengeLevel(p,'worth'),2);
});
test('a contrast error teaches the two block quantities and survives refresh as assisted work',()=>{
 for(const total of NUMBER_NAME_PAIRS.flat()){
  const p=freshProfile('explorer');act(p,{kind:'start',game:'place'});
  let q;
  for(let seed=0;seed<100&&!q;seed++){const next=numberNameReview([],random(seed*999)).question;if(next.total===total)q=next;}
  assert.ok(q);q={...q,id:'listening',track:EXPLORER_TRACK,fingerprint:'listening:'+total};p.session.question=q;
  act(p,{kind:'place-check',questionId:q.id,counts:[0,q.contrast/10,q.contrast%10].map(Math.floor)});
  // Teen counterparts need one ten, not a fractional number of tens.
  assert.equal(p.session.placeChecks,1);assert.equal(p.session.result,null);
  assert.equal(p.session.placeLines.length,2);
  for(const line of p.session.placeLines)assert.ok(placeVoiceLines().includes(line));
  const restored=JSON.parse(JSON.stringify(p));prepareProfile(restored);
  assert.deepEqual(restored.session,p.session);assert.equal(publicState(restored).session.question.answer,undefined);
  act(restored,{kind:'place-check',questionId:q.id,counts:q.target});
  assert.equal(restored.session.result.xp,4);assert.equal(restored.history.at(-1).helped,true);
  assert.equal(restored.session.independent,0);assert.equal(restored.history.at(-1).question.skill,'number-name');
  assert.throws(()=>act(restored,{kind:'place-check',questionId:q.id,counts:q.target}));
 }
 assert.equal(numberNameVoiceLines().length,8);
});
test('ordinary wrong builds keep column guidance; older saves and early-number games stay intact',()=>{
 const q=numberNameReview([],()=>0).question;
 assert.deepEqual(buildFeedback(q.target,[0,2,2],0,q).lines,['Too many tens.','Too few ones.']);
 for(const player of ['beginner','admin'])for(let round=0;round<6;round++){
  const p=freshProfile(player);const next=makeQuestion(p,'count',round);
  assert.notEqual(next.skill,'number-name');assert.equal(next.max,13);
 }
 const p=freshProfile('explorer');act(p,{kind:'start',game:'place'});
 const prior=JSON.stringify(p);prepareProfile(p);assert.equal(JSON.stringify(p),prior);
 for(let round=0;round<6;round++)if(round!==2)assert.notEqual(makeQuestion(p,'place',round).skill,'number-name');
});
