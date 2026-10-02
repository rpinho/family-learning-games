import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,gamesFor,makeQuestion,action,publicState,random,prepareProfile} from '../lib/math.mjs';
import {ANIMALS,animalPairs,balanceQuestion,evaluate,sideAnswer,balanceTilt,balancePrompt,balanceFeedback,balanceVoiceLines,balanceExplanation} from '../lib/balance.mjs';
import {challengeLevel,EXPLORER_TRACK} from '../lib/explorer.mjs';
import {planSpeech} from '../lib/speech-rule.mjs';
const act=(p,input,now=Date.now())=>action(p,{...input,revision:p.revision},now);
test('balance belongs only to the advanced menu and never the mixed mission',()=>{
 assert.ok(gamesFor(freshProfile('explorer')).some(g=>g.id==='balance'));
 for(const id of ['beginner','admin'])assert.throws(()=>act(freshProfile(id),{kind:'start',game:'balance'}));
 const p=freshProfile('explorer');for(let i=0;i<600;i++){p.revision=i;assert.notEqual(makeQuestion(p,'mix',i%6).kind,'balance');}
});
test('twenty positive, unique adult estimates with familiar anchor weights and progressively closer pairs',()=>{
 assert.equal(ANIMALS.length,20);assert.equal(new Set(ANIMALS.map(a=>a.name)).size,20);
 assert.ok(ANIMALS.every(a=>Number.isFinite(a.kg)&&a.kg>0&&a.emoji));
 for(const [name,kg] of [['fox',6],['cat',4],['African elephant',5000],['mouse',.025]])assert.equal(ANIMALS.find(a=>a.name===name).kg,kg);
 const mean=level=>animalPairs(level).reduce((n,[a,b])=>n+Math.max(a.kg,b.kg)/Math.min(a.kg,b.kg),0)/animalPairs(level).length;
 for(let l=1;l<=5;l++){assert.ok(animalPairs(l).length>0);if(l>1)assert.ok(mean(l)<mean(l-1));}
});
test('six questions: two per mode, one lighter and one heavier, unique valid options at every tier',()=>{
 for(let level=1;level<=5;level++)for(let seed=0;seed<300;seed++){
  const qs=Array.from({length:6},(_,round)=>balanceQuestion(level,round,random(seed*83+round*7+1)));
  for(const mode of ['animals','compare','complete'])assert.equal(qs.filter(q=>q.mode===mode).length,2);
  assert.deepEqual(qs.filter(q=>q.mode==='animals').map(q=>q.direction),['lighter','heavier']);
  for(const q of qs){
   assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.options.includes(q.answer));
   if(q.mode==='animals'){assert.notEqual(q.left.name,q.right.name);assert.equal(q.answer,q.direction==='lighter'?Number(q.right.kg<q.left.kg):Number(q.right.kg>q.left.kg));continue;}
   assert.equal(evaluate(q.left),q.left.value);assert.equal(evaluate(q.right),q.right.value);
   if(q.mode==='compare')assert.equal(q.answer,sideAnswer(q.left.value,q.right.value));
   else{assert.equal(q.options.length,4);assert.equal(q.right.a+q.answer,q.left.value);assert.ok(q.options.every(n=>Number.isInteger(n)&&n>=0&&n<=q.max));}
   const cap=[0,50,100,100,500,1000][level];assert.ok(q.left.value<=cap);
   if(q.left.op==='×'&&level>=4)assert.ok(q.left.a>=11&&q.left.a<=49);
  }
 }
});
test('arithmetic includes balanced, left-heavy and right-heavy questions in roughly equal proportions',()=>{
 const counts=[0,0,0];for(let i=0;i<3000;i++)counts[balanceQuestion(3,1,random(i+100)).answer]++;
 assert.ok(counts.every(n=>n>850&&n<1150),String(counts));
});
test('beam is level and weights/solutions hidden before answer, even with Help; saved answers reveal a correct physical tip',()=>{
 for(let round=0;round<6;round++){
  const p=freshProfile('explorer');act(p,{kind:'start',game:'balance'});p.session.round=round;p.session.question=makeQuestion(p,'balance',round);
  const q=p.session.question;
  for(const help of [false,true]){
   if(help)act(p,{kind:'hint'});
   const s=publicState(p).session;assert.equal(balanceTilt(s.question,s.result),0);
   assert.equal(s.question.answer,undefined);assert.equal(s.question.fingerprint,undefined);
   for(const side of ['left','right']){assert.equal(s.question[side].kg,undefined);assert.equal(s.question[side].value,undefined);}
   if(q.mode==='complete')assert.equal(s.question.right.b,undefined);
  }
  act(p,{kind:'answer',questionId:q.id,answer:q.answer});
  const s=publicState(p).session;assert.equal(balanceTilt(s.question,s.result),q.mode==='complete'?0:q.mode==='animals'?(q.left.kg>q.right.kg?-10:10):q.left.value===q.right.value?0:q.left.value>q.right.value?-10:10);
  assert.ok(balanceExplanation(s.question,s.result).length>10);assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:q.answer}));
 }
 const p=freshProfile('explorer');act(p,{kind:'start',game:'balance'});p.session.question=makeQuestion(p,'balance',2);
 const q=p.session.question,wrong=q.options.find(n=>n!==q.answer);act(p,{kind:'answer',questionId:q.id,answer:wrong});
 assert.notEqual(balanceTilt(q,p.session.result),0,'wrong missing number does not appear balanced');assert.equal(p.session.result.picked,wrong);
});
test('balance uses independent adaptation, manual levels, rushed-tap protection and preserves existing saves',()=>{
 const p=freshProfile('explorer');p.xp=97;p.drawing=[[[1,1],[2,2]]];p.completed={multiply:7};const prior=structuredClone(p);
 act(p,{kind:'start',game:'balance'},10000);assert.equal(p.session.question.level,2);
 act(p,{kind:'challenge-level',delta:1},10001);assert.equal(p.session.question.level,3);
 act(p,{kind:'challenge-level',delta:1},10002);assert.equal(p.session.question.level,4);act(p,{kind:'challenge-level',delta:1},10003);assert.equal(p.session.question.level,5);
 for(let i=0;i<2;i++){const q=p.session.question;assert.throws(()=>act(p,{kind:'answer',questionId:q.id,answer:3},10003));act(p,{kind:'answer',questionId:q.id,answer:q.options.find(n=>n!==q.answer)},10004);act(p,{kind:'next'},10005);}
 assert.equal(challengeLevel(p,'balance'),5);assert.equal(challengeLevel(p,'multiply'),2);
 assert.equal(p.xp,prior.xp);assert.deepEqual(p.drawing,prior.drawing);assert.deepEqual(p.completed,prior.completed);
 assert.deepEqual(prepareProfile(structuredClone(p)),p);
 const a=freshProfile('explorer');for(let i=0;i<6;i++)a.history.push({ok:true,helped:false,question:{track:EXPLORER_TRACK,skill:'balance'}});assert.equal(challengeLevel(a,'balance'),3);
 for(let i=0;i<2;i++)a.history.push({ok:false,helped:false,durationMs:7000,question:{track:EXPLORER_TRACK,skill:'balance'}});assert.equal(challengeLevel(a,'balance'),2);
});
test('all prompts and feedback use the finite voice inventory and content remains voiced with effects off',()=>{
 const clips=new Set([...balanceVoiceLines(),...Array.from({length:1001},(_,i)=>String(i))]);
 for(let i=0;i<200;i++)for(let round=0;round<6;round++){
  const q=balanceQuestion(1+i%5,round,random(i*19+round+3)),result={ok:false,answer:q.answer};
  const prompt=balancePrompt(q);for(const line of [...prompt,...balanceFeedback(q,result)])assert.ok(clips.has(line),line);
  assert.deepEqual(planSpeech(prompt,{sound:false,firstTime:()=>false}).say,prompt);
 }
});
test('a complete six-question round earns only existing XP and keeps all prior progress',()=>{
 const p=freshProfile('explorer');p.xp=47;p.lessons=2;p.completed={multiply:3};p.guided={'2':4};p.drawing=[[[1,1],[2,2]]];
 const now=Date.parse('2026-10-02T00:00:00Z');act(p,{kind:'start',game:'balance'},now);
 for(let round=0;round<6;round++){
  const q=p.session.question;assert.equal(p.session.round,round);
  act(p,{kind:'answer',questionId:q.id,answer:q.answer},now+(round+1)*10000);
  act(p,{kind:'next'},now+(round+1)*10000+1000);
 }
 assert.equal(p.session.finished,true);assert.equal(p.session.correct,6);assert.equal(p.session.independent,6);
 assert.equal(p.xp,107);assert.equal(p.lessons,3);assert.deepEqual(p.completed,{multiply:3,balance:1});
 assert.deepEqual(p.guided,{'2':4});assert.deepEqual(p.drawing,[[[1,1],[2,2]]]);assert.equal(challengeLevel(p,'balance'),3);
 assert.equal(p.session.recap.lines[0],'You solved 6 balance puzzles.');
});

test('animal feedback names the requested comparison and teaches its own pan direction after either answer',()=>{
 for(const swapped of [false,true])for(const direction of ['lighter','heavier']){
  const cat=ANIMALS.find(a=>a.name==='cat'),fox=ANIMALS.find(a=>a.name==='fox');
  const q={mode:'animals',left:swapped?fox:cat,right:swapped?cat:fox,direction,answer:direction==='lighter'?Number(swapped):Number(!swapped)};
  for(const ok of [false,true]){
   assert.deepEqual(balanceFeedback(q,{ok,answer:q.answer}),[direction==='lighter'?'A cat is lighter.':'A fox is heavier.',direction==='lighter'?'The lighter side goes up.':'The heavier side goes down.']);
   assert.match(balanceExplanation(q,{ok}),direction==='lighter'?/cat is lighter/:/fox is heavier/);
  }
  assert.equal(balanceTilt(q,null),0,'the question still conceals the tilt before saving an answer');
 }
});
