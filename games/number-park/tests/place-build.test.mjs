import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,publicState} from '../lib/math.mjs';
import {EXPLORER_TRACK,challengeLevel} from '../lib/explorer.mjs';
import {buildQuestion,buildFeedback,validBuild,placeVoiceLines,buildValue,placeWords} from '../lib/place-build.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision});
const seq=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
test('block-builder questions stay in range per level and zero digits appear only at level 3',()=>{
 for(const level of [1,2,3]){const r=seq(level*99);let zeros=0;
  for(let i=0;i<400;i++){const q=buildQuestion(level,r);
   assert.equal(buildValue(q.target),q.total);assert.ok(q.target.every(n=>n>=0&&n<=9));
   if(level===1){assert.equal(q.show,'words');assert.equal(q.target[0],0);assert.ok(q.target[1]>=2&&q.target[2]>=1);}
   if(level===2){assert.equal(q.show,'number');assert.ok(q.total>=10&&q.total<=99);}
   if(level===3){assert.ok(q.total>=100&&q.total<=999);zeros+=Number(q.target.includes(0));}
  }
  if(level===3)assert.ok(zeros>40,'level 3 includes zero digits');
 }
 assert.equal(placeWords([0,4,1]),'4 tens 1 one');
});
test('itemised feedback: direction first, then exact amounts; spoken lines all have clips',()=>{
 const first=buildFeedback([3,0,7],[3,1,4],0);
 assert.equal(first.ok,false);assert.deepEqual(first.lines,['Hundreds are right.','Too many tens.','Too few ones.']);
 const second=buildFeedback([3,0,7],[3,1,4],1);
 assert.deepEqual(second.lines,['Hundreds are right.','The number needs 0 tens.','The number needs 7 ones.']);
 assert.equal(buildFeedback([0,4,7],[0,4,7]).ok,true);
 const voice=new Set(placeVoiceLines());
 for(const t of [[0,4,7],[3,0,7],[9,9,9]])for(const c of [[0,0,0],[1,2,3],[12,12,12],[0,4,7]])for(const k of [0,1,2])for(const line of buildFeedback(t,c,k).lines)assert.ok(voice.has(line),line);
 assert.ok(validBuild([0,1,2]));assert.ok(!validBuild([0,1]));assert.ok(!validBuild([0,13,1]));assert.ok(!validBuild([0,-1,1]));assert.ok(!validBuild([0,1.5,1]));
});
test('Explorer builds a number: a wrong check is itemised and credited as helped; unhelped build earns full stars',()=>{
 const p=freshProfile('explorer');act(p,{kind:'start',game:'place'});
 let s=p.session;assert.equal(s.question.placeMode,'build');assert.equal(s.question.track,EXPLORER_TRACK);
 assert.throws(()=>act(p,{kind:'answer',questionId:s.question.id,answer:s.question.total}),/blocks/);
 assert.throws(()=>act(p,{kind:'place-check',questionId:s.question.id,counts:[0,99,0]}),/blocks/);
 const t=s.question.target,wrong=[t[0],t[1]+1,t[2]];
 act(p,{kind:'place-check',questionId:s.question.id,counts:wrong});
 assert.equal(p.session.result,null);assert.match(p.session.placeMessage,/Too many tens\./);assert.equal(p.session.placeChecks,1);
 assert.ok(!('answer' in publicState(p).session.question));
 act(p,{kind:'place-check',questionId:s.question.id,counts:[...t]});
 assert.equal(p.session.result.ok,true);assert.equal(p.session.result.xp,4);assert.equal(p.history.at(-1).placeChecks,1);assert.equal(p.history.at(-1).helped,true);
 assert.throws(()=>act(p,{kind:'place-check',questionId:s.question.id,counts:[...t]}));
 act(p,{kind:'next'});assert.ok(!('placeMessage' in p.session));assert.ok(!('placeChecks' in p.session));
 const q=p.session.question;
 if(q.placeMode==='build'){act(p,{kind:'place-check',questionId:q.id,counts:[...q.target]});assert.equal(p.session.result.xp,10);assert.equal(p.session.independent,1);}
});
test('level 3 mixes three-digit builds with the old tens/ones decoding; history drives the ladder',()=>{
 const p=freshProfile('explorer');
 for(let i=0;i<6;i++)p.history.push({ok:true,helped:false,question:{track:EXPLORER_TRACK,skill:'place'}});
 assert.equal(challengeLevel(p,'place'),3);
 let builds=0,decodes=0;
 for(let i=0;i<300;i++){p.revision=i;const q=makeQuestion(p,'place',i%6);if(q.placeMode==='build'){builds++;assert.ok(q.total>=100);}else{decodes++;assert.ok(['tens','ones'].includes(q.placeMode));}}
 assert.ok(builds>150&&decodes>50,`${builds}/${decodes}`);
});
