import test from 'node:test';import assert from 'node:assert/strict';
import {slingItem,scoreStone,flightPath,slingLines,spellingStep,MAX_PULL,STONES,slingFeel} from '../sling.mjs';
import {action,freshProfile} from '../engine.mjs';
function aimFor(round,index,want){for(let dx=-150;dx<=0;dx+=3)for(let dy=0;dy<=150;dy+=3){const s=scoreStone(round,index,dx,dy);if(s.outcome===want)return {dx,dy};}return null;}
test('Every item is reachable, deterministic and voiced',()=>{
 const lines=new Set(slingLines());
 for(const [mode,track] of [['letters','letters'],['numbers','letters'],['pattern','letters'],['math','words'],['spelling','words']])for(let stage=1;stage<=3;stage++)for(let seed=1;seed<=6;seed++){
  const round={seed:seed*7919,mode,stage,track,letters:[...'FRANCISOETL']};
  for(let i=0;i<STONES;i++){const a=slingItem(round,i),b=slingItem(round,i);assert.deepEqual(a,b);assert.equal(a.labels[a.answerIndex],a.answer);assert.equal(new Set(a.labels).size,a.labels.length,JSON.stringify(a.labels));
   assert.equal(a.labels.length,track==='letters'?3:4);assert.ok(lines.has(a.spoken),a.spoken);assert.ok(lines.has(a.name),a.name);
   if(seed<=2)assert.ok(aimFor(round,i,'correct'),`${mode} ${stage} ${seed} ${i} reachable`);}
 }
});
test('Physics is forgiving and bounded',()=>{
 assert.deepEqual(flightPath(-9999,9999),flightPath(-MAX_PULL/Math.SQRT2,MAX_PULL/Math.SQRT2));
 assert.ok(slingFeel('letters').margin>slingFeel('words').margin);assert.equal(slingFeel('letters').preview,1);
 const round={seed:5,mode:'letters',stage:1,track:'letters',letters:['L']};assert.equal(scoreStone(round,0,0,0).outcome,'miss');
});
test('Spelling carries a word across stones',()=>{
 const r={stage:2,words:['ship','fish'],wordOffset:0};assert.deepEqual([0,1,2,3,4].map(i=>spellingStep(r,i)),[{word:'ship',position:0},{word:'ship',position:1},{word:'ship',position:2},{word:'ship',position:3},{word:'fish',position:0}]);
 assert.equal(slingItem({...r,seed:3,mode:'spelling',track:'words'},2).prompt,'s h _ _');
});
test('Sling rounds save separately from arrows and pick content by child',()=>{
 const d=freshProfile('beginner');action(d,{type:'sling-start',revision:0,literacy:{letters:['F','R','L']}});assert.equal(d.sling.round.mode,'letters');assert.deepEqual(d.sling.round.letters,['F','R','L']);assert.equal(d.round,null);
 assert.throws(()=>action(d,{type:'sling-shot',roundId:'nope',shot:0,dx:-50,dy:50,revision:d.revision}),/round changed/);
 for(let i=0;i<STONES;i++){const aim=aimFor(d.sling.round,i,'correct');action(d,{type:'sling-shot',roundId:d.sling.round.id,shot:i,...aim,revision:d.revision});}
 assert.equal(d.sling.round.done,true);assert.equal(d.sling.round.correct,5);assert.equal(d.sling.stars,3);assert.equal(d.shots,0);
 assert.throws(()=>action(d,{type:'sling-shot',roundId:d.sling.round.id,shot:5,dx:-50,dy:50,revision:d.revision}),/already/);
 action(d,{type:'sling-start',revision:d.revision});assert.equal(d.sling.round.mode,'numbers');
 const f=freshProfile('explorer');action(f,{type:'sling-start',revision:0,literacy:{wordLevel:2}});assert.equal(f.sling.round.mode,'math');
 for(let i=0;i<STONES;i++){const aim=aimFor(f.sling.round,i,'correct');action(f,{type:'sling-shot',roundId:f.sling.round.id,shot:i,...aim,revision:f.revision});}
 assert.equal(f.sling.stages.math,2);action(f,{type:'sling-start',revision:f.revision,literacy:{wordLevel:2}});assert.equal(f.sling.round.mode,'spelling');assert.equal(f.sling.round.stage,2);
 assert.throws(()=>action(f,{type:'sling-shot',roundId:f.sling.round.id,shot:0,dx:NaN,dy:1,revision:f.revision}),/Invalid pull/);
});
