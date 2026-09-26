import test from 'node:test';import assert from 'node:assert/strict';
import {slingItem,scoreStone,slingShot,slingLines,spellingStep,MAX_PULL,STONES,slingFeel,aimPoint,ANCHOR,SLING_VERSION,seeded} from '../sling.mjs';
import {scoreStone as legacyScore} from '../sling-legacy.mjs';
import {action,freshProfile} from '../engine.mjs';
function aimFor(round,index,want){for(let a=-60;a<=60;a+=1){const dx=-100*Math.cos(a*Math.PI/180),dy=100*Math.sin(a*Math.PI/180),s=scoreStone(round,index,dx,dy);if(s.outcome===want)return {dx,dy,v:SLING_VERSION};}return null;}
// A child's pull straight away from a target, with a wobbly angle and any length.
const pullAway=(t,deg,len)=>{const a=Math.atan2(t.y-ANCHOR.y,t.x-ANCHOR.x)+deg*Math.PI/180;return {dx:-Math.cos(a)*len,dy:-Math.sin(a)*len};};
test('Every item is reachable, deterministic and voiced',()=>{
 const lines=new Set(slingLines());
 for(const [mode,track] of [['letters','letters'],['numbers','letters'],['pattern','letters'],['math','words'],['spelling','words']])for(let stage=1;stage<=3;stage++)for(let seed=1;seed<=6;seed++){
  const round={seed:seed*7919,mode,stage,track,letters:[...'FRANCISOETL']};
  for(let i=0;i<STONES;i++){const a=slingItem(round,i),b=slingItem(round,i);assert.deepEqual(a,b);assert.equal(a.labels[a.answerIndex],a.answer);assert.equal(new Set(a.labels).size,a.labels.length,JSON.stringify(a.labels));
   assert.equal(a.labels.length,track==='letters'?3:4);assert.ok(aimFor(round,i,'wrong-target'));assert.ok(lines.has(a.spoken),a.spoken);assert.ok(lines.has(a.name),a.name);
   if(seed<=2)assert.ok(aimFor(round,i,'correct'),`${mode} ${stage} ${seed} ${i} reachable`);}
 }
});
test('Aiming is one direction, forgiving and bounded',()=>{
 const round={seed:5,mode:'letters',stage:1,track:'letters',letters:['L','F','R']};
 assert.equal(scoreStone(round,0,0,0).outcome,'no-pull');assert.equal(scoreStone(round,0,60,-10).outcome,'no-pull','pulling toward the targets does not shoot');
 assert.deepEqual(aimPoint(-9999,9999),aimPoint(-MAX_PULL/Math.SQRT2,MAX_PULL/Math.SQRT2));
 assert.deepEqual(aimPoint(-40,20),aimPoint(-140,70),'power is fixed: only the direction matters');
 const it=slingItem(round,0);assert.equal(new Set(it.targets.map(t=>t.x)).size,1,'one column');
 for(const t of it.targets){const shot=slingShot(it.targets,slingFeel('letters'),...Object.values(pullAway(t,0,90)));assert.equal(shot.target.id,t.id);const end=shot.path.at(-1);assert.deepEqual([end.x,end.y],[t.x,t.y],'the preview ends on the target it will hit');}
 assert.ok(slingFeel('letters').radius>slingFeel('words').radius&&slingFeel('letters').magnet&&!slingFeel('words').magnet);
});
test('A reasonable pull toward the right target hits at least 90% of the time',()=>{
 // Angle wobble up to +-12 degrees (Beginner) / +-6 (Explorer) and pulls from 25 to 150 px, as a child's finger would.
 for(const [track,mode,wobble] of [['letters','letters',12],['letters','numbers',12],['words','spelling',6],['words','math',6]]){
  let hits=0,n=0;const r=seeded(42);
  for(let seed=1;seed<=40;seed++){const round={seed:seed*131,mode,stage:1,track,letters:[...'FRANCISOETL']};
   for(let i=0;i<STONES;i++){const it=slingItem(round,i),t=it.targets[it.answerIndex];for(let k=0;k<10;k++){const {dx,dy}=pullAway(t,(r()*2-1)*wobble,25+r()*125);n++;if(scoreStone(round,i,dx,dy).outcome==='correct')hits++;}}}
  assert.ok(hits/n>=.9,`${track} ${mode}: ${(100*hits/n).toFixed(1)}%`);console.log(`  ${track}/${mode}: ${(100*hits/n).toFixed(1)}% of ${n} wobbly pulls hit`);
 }
});
test('Pages still running the old sling are scored with the old physics',()=>{
 const round={seed:5,mode:'letters',stage:1,track:'letters',letters:['L','F','R']};
 assert.notEqual(legacyScore(round,0,-80,60).outcome,undefined);
 const d=freshProfile('beginner');action(d,{type:'sling-start',revision:0,literacy:{letters:['F','R','L']}});
 action(d,{type:'sling-shot',roundId:d.sling.round.id,shot:0,dx:-80,dy:60,revision:d.revision});assert.equal(d.sling.round.shots[0].physics,'sling-2026-09-26-1');
 assert.throws(()=>action(d,{type:'sling-shot',v:SLING_VERSION,roundId:d.sling.round.id,shot:1,dx:50,dy:0,revision:d.revision}),/Pull back/);assert.equal(d.sling.round.shots.length,1,'a forward pull costs no stone');
 action(d,{type:'sling-shot',v:SLING_VERSION,roundId:d.sling.round.id,shot:1,...aimFor(d.sling.round,1,'correct'),revision:d.revision});assert.equal(d.sling.round.shots[1].physics,SLING_VERSION);assert.equal(d.sling.round.shots[1].outcome,'correct');
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
