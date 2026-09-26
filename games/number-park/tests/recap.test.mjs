import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,action} from '../lib/math.mjs';
import {roundRecap,recapVoiceLines,feedLine} from '../lib/recap.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
test('a finished round carries a short recap whose every line has a voice clip',()=>{
 const lines=new Set(recapVoiceLines());
 for(const id of ['beginner','explorer']){
  const p=freshProfile(id);act(p,{kind:'start',game:id==='beginner'?'count':'multiply'});
  for(let round=0;round<6;round++){const q=p.session.question;act(p,{kind:'answer',questionId:q.id,answer:round===2?(q.answer+1)%(q.max+1):q.answer});act(p,{kind:'next'});}
  const r=p.session.recap;assert.ok(p.session.finished);assert.ok(r.lines.length>=1&&r.lines.length<=2);
  for(const line of r.lines){assert.ok(lines.has(line),line);assert.ok(line.split(' ').length<=6,'recap lines stay short: '+line);}
  if(id==='beginner'){assert.deepEqual(r.lines,['You counted 5 groups.',feedLine(5)]);assert.equal(r.treats,5);}
  else{assert.deepEqual(r.lines,['You solved 5 times-table facts.','All on your own!']);assert.equal(r.treats,0);}
 }
});
test('block-building rounds name the zeros; wrong answers never take treats away',()=>{
 const build=target=>({ok:true,question:{placeMode:'build',target}});
 const r=roundRecap({game:'place',advanced:true,correct:6,independent:4,player:'explorer',entries:[build([3,0,7]),build([0,4,0]),build([0,4,7]),build([1,2,3]),build([2,2,2]),build([0,9,9])]});
 assert.deepEqual(r.lines,['You built 6 numbers.','Two had zeros.']);
 assert.deepEqual(roundRecap({game:'mix',advanced:false,correct:0,independent:0,player:'beginner'}).lines,['You finished a whole round.']);
 assert.deepEqual(roundRecap({game:'cookies',advanced:true,correct:6,independent:3,player:'explorer'}).lines,['You solved 6 cookie puzzles.','You did 3 on your own.']);
});
