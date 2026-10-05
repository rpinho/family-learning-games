import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {massAngle, animalAngle, springStep, springSettled} from '../lib/balance-physics.mjs';
import {balancePrompt, balanceFeedback, balanceVoiceLines, balanceFinishVoiceLines, balanceObservationPrompt, ANIMAL_OBSERVE} from '../lib/balance.mjs';
import {kinderBalancePrompt, kinderBalanceFeedback, kinderBalanceVoiceLines, kinderCountLine} from '../lib/balance-kinder.mjs';
import {freshProfile, makeQuestion, action, publicState, prepareProfile} from '../lib/math.mjs';
import {weightPuzzle,weightAngle} from '../lib/balance-weights.mjs';
import {planSpeech} from '../lib/speech-rule.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision},10000);

test('real mass difference controls direction and equilibrium magnitude, including close animal pairs',()=>{
 for(const left of [.025,4,12,150,5000]){
  let prior=-Infinity;
  for(let right=0;right<=6000;right+=.5){
   const angle=animalAngle(left,right);
   assert.ok(Number.isFinite(angle)&&angle>=prior&&Math.abs(angle)<=12);
   assert.equal(Math.sign(angle),Math.sign(right-left));
   assert.equal(animalAngle(right,left),-angle||0);prior=angle;
  }
 }
 assert.ok(Math.abs(animalAngle(150,160))<Math.abs(animalAngle(150,190)));
 assert.equal(massAngle(15,15),0);
 for(const target of [12,50,200,441])assert.ok(weightAngle(target,target/4,Math.max(25,target))-weightAngle(target,0,Math.max(25,target))>1,'large number puzzles still move visibly after partial placements');
});
test('spring swings past equilibrium, damps and settles at 30/60/120 fps and survives interrupted motion',()=>{
 for(const fps of [30,60,120])for(const target of [-12,-2,0,2,12]){
  let state={angle:0,velocity:0},overshoot=false;
  for(let i=0;i<fps*4;i++){
   state=springStep(state,target,1/fps);
   if(target&&Math.sign(target)*(state.angle-target)>0)overshoot=true;
   assert.ok(Number.isFinite(state.angle)&&Math.abs(state.angle)<15);
  }
  assert.ok(springSettled(state,target));if(target)assert.ok(overshoot);
 }
 let state=springStep({angle:0,velocity:0},12,.15);
 const old=state.angle;state=springStep(state,-12,.001);
 assert.ok(Math.abs(state.angle-old)<.1,'adding a weight does not teleport the beam');
 state=springStep(state,-12,4);assert.ok(springSettled(state,-12));
 assert.ok(springSettled(springStep(state,12,60),12),'long hidden frame is stable');
});
test('every Balance spoken event is one complete inventory line, never number clips, even with effects off',()=>{
 const inventory=new Set([...balanceVoiceLines(),...kinderBalanceVoiceLines()]);
 const check=lines=>{
  assert.equal(lines.length,1);
  assert.ok(inventory.has(lines[0]),lines[0]);assert.ok(/[.!?]$/.test(lines[0]));
  assert.deepEqual(planSpeech(lines,{sound:false,firstTime:()=>false}).say,lines);
 };
 for(let level=1;level<=5;level++)for(let seed=1;seed<=300;seed++)for(let round=0;round<6;round++){
  const p=freshProfile('explorer');p.revision=seed;p.challengeManual={balance:{level,after:0}};
  const q=makeQuestion(p,'balance',round);
  check(balancePrompt(q));if(q.mode==='animals')check([balanceObservationPrompt(q)]);check(balanceFeedback(q,{ok:true,answer:q.answer,draft:q.weights?[]:undefined}));
 }
 // Include arithmetic boundaries, not only typical random samples.
 for(const r of [()=>0,()=>.999999])for(let level=1;level<=5;level++)for(const round of [1,2,4,5])check(balancePrompt({weights:weightPuzzle(level,round,r)}));
 for(let seed=0;seed<200;seed++)for(let round=0;round<6;round++){
  const p=freshProfile('beginner');p.revision=seed;const q=makeQuestion(p,'balance-k',round);
  check(kinderBalancePrompt(q));check([kinderBalanceFeedback(q,{answer:q.answer})]);
  if(q.mode==='animals'){assert.ok(kinderBalancePrompt(q)[0].toLowerCase().includes(q.left.name.toLowerCase()));assert.ok(kinderBalancePrompt(q)[0].toLowerCase().includes(q.right.name.toLowerCase()));}
 }
 for(let count=0;count<=10;count++)check([kinderCountLine(count)]);
 check([ANIMAL_OBSERVE]);for(const line of balanceFinishVoiceLines())check([line]);
 const kinder=readFileSync(new URL('../app/balance-kinder.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(kinder,/speak\(String\(/);
 const renderer=readFileSync(new URL('../scripts/render_balance_voice.py',import.meta.url),'utf8');
 assert.equal((renderer.match(/model\.create\(/g)||[]).length,1);
 assert.doesNotMatch(renderer,/split\(['"]\s/,'no sentence or number splitting');
 const file=process.env.BALANCE_VOICE_MANIFEST;
 if(file){
  const manifest=JSON.parse(readFileSync(file));assert.equal(manifest.balance.takesPerLine,1);
  for(const line of inventory){
   assert.equal(typeof manifest.clips[line],'string',line);
   assert.equal(manifest.clips[line],manifest.balance.clips[line]);
   assert.ok(existsSync(join(dirname(file),manifest.clips[line].split('/').at(-1))));
  }
 }
});
test('both boys can place, optionally guess and weigh before answering; reload preserves observations and progress',()=>{
 for(const id of ['beginner','explorer'])for(const guess of [null,0,1]){
  const p=freshProfile(id);p.xp=47;p.drawing=[[[1,1],[2,2]]];p.completed={place:2};
  act(p,{kind:'start',game:id==='beginner'?'balance-k':'balance'});const q=p.session.question;
  const experiment=e=>act(p,{kind:'balance-experiment',questionId:q.id,experiment:e});
  assert.throws(()=>experiment({slots:[0,0],guess,weighed:false}));
  assert.throws(()=>experiment({slots:[0,null],guess,weighed:true}));
  experiment({slots:[1,null],guess,weighed:false});
  assert.equal(publicState(p).session.question.left.kg,undefined);
  experiment({slots:[1,0],guess,weighed:false});
  experiment({slots:[1,0],guess,weighed:true});
  const restored=publicState(prepareProfile(structuredClone(p)));
  assert.deepEqual(restored.session.balanceExperiment,{slots:[1,0],guess,weighed:true});
  assert.equal(restored.session.question.left.kg,q.left.kg);
  assert.equal(restored.session.question.answer,undefined);
  assert.equal(p.xp,47);assert.equal(p.history.length,0);
  assert.throws(()=>experiment({slots:[0,1],guess,weighed:true}));
  act(p,{kind:'answer',questionId:q.id,answer:q.answer});assert.equal(p.xp,57);assert.equal(p.history.length,1);assert.deepEqual(p.history[0].experiment,{slots:[1,0],guess,weighed:true});
  assert.deepEqual(p.drawing,[[[1,1],[2,2]]]);assert.deepEqual(p.completed,{place:2});
  act(p,{kind:'next'});assert.equal(p.session.balanceExperiment,undefined);
 }
});
