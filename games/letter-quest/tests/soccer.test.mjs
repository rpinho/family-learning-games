import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {soccerAction,soccerState,soccerQuestion,soccerVoiceLines} from '../public/soccer.mjs';
import {soccerView} from '../public/soccer-view.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
import {summarize} from '../diagnostic-report.mjs';
import {routeTab,navItems} from '../public/hub.mjs';
import {createSoccerAudio} from '../public/soccer-audio.mjs';
function shot(p,correct=true,hint=false){soccerAction(p,{kind:'ready'});const q=p.soccer.question;if(hint)soccerAction(p,{kind:'hint',questionId:q.id});return soccerAction(p,{kind:'answer',questionId:q.id,answer:correct?q.answer:q.options.find(a=>a!==q.answer),durationMs:5000});}
test('Soccer has exactly one outcome per kick and one completion reward, with persistent next shootouts',()=>{
 for(const id of ['explorer','beginner']){
  let p=freshProfile(id);const original=JSON.stringify({skills:p.skills,seq:p.seq,completed:p.completed});
  assert.equal(soccerState(p).level,id==='beginner'?1:2);assert.equal(p.soccer,undefined);
  soccerAction(p,{kind:'start'});assert.throws(()=>soccerAction(p,{kind:'start'}));
  for(let i=0;i<5;i++){
   soccerAction(p,{kind:'aim',aim:['left','center','right'][i%3]});const r=shot(p,i!==1,i===2);
   assert.equal(r.kind,i===2?'practice':i===1?'save':'goal');assert.equal(r.xp,i===1||i===2?0:10);
   assert.throws(()=>soccerAction(p,{kind:'answer',questionId:r.shot.question.id,answer:r.shot.question.answer}));
   assert.equal(p.soccer.shots.length,i+1);assert.equal(!!r.bonus,i===4);
   p=JSON.parse(JSON.stringify(p));soccerAction(p,{kind:'next'});
  }
  assert.equal(p.xp,40);assert.equal(p.gems,5);assert.equal(p.soccer.phase,'complete');assert.equal(p.soccer.stats.goals,3);assert.equal(p.soccer.stats.independent,3);
  assert.equal(p.soccer.history.length,1);assert.equal(p.soccer.history[0].shots.length,5);assert.throws(()=>soccerAction(p,{kind:'next'}));
  assert.equal(JSON.stringify({skills:p.skills,seq:p.seq,completed:p.completed}),original);
  soccerAction(p,{kind:'start'});assert.equal(p.soccer.number,2);assert.equal(p.soccer.shots.length,0);assert.equal(p.soccer.history.length,1);assert.equal(p.xp,40);
 }
});
test('Soccer hints persist, cannot score by themselves, and answer selection rejects invalid/stale input',()=>{
 let p=freshProfile('beginner');soccerAction(p,{kind:'start'});soccerAction(p,{kind:'ready'});const q=p.soccer.question;
 assert.equal(q.options.length,2);assert.throws(()=>soccerAction(p,{kind:'aim',aim:'right'}));assert.throws(()=>soccerAction(p,{kind:'ready'}));
 assert.throws(()=>soccerAction(p,{kind:'answer',questionId:'stale',answer:q.answer}));assert.throws(()=>soccerAction(p,{kind:'answer',questionId:q.id,answer:'nonsense'}));
 soccerAction(p,{kind:'hint',questionId:q.id});const revision=p.revision;soccerAction(p,{kind:'hint',questionId:q.id});assert.equal(p.revision,revision);assert.equal(p.xp,0);
 p=JSON.parse(JSON.stringify(p));assert.equal(p.soccer.helped,true);assert.deepEqual(p.soccer.question,q);
 const r=soccerAction(p,{kind:'answer',questionId:q.id,answer:q.answer,durationMs:100});assert.equal(r.helped,true);assert.equal(r.xp,0);assert.equal(p.soccer.shots.length,1);
});
test('Soccer adapts to independent success and missed shots without changing the current question',()=>{
 const p=freshProfile('beginner');soccerAction(p,{kind:'start',level:1});
 for(let i=0;i<3;i++){shot(p);soccerAction(p,{kind:'next'});}assert.equal(p.soccer.level,2);
 soccerAction(p,{kind:'ready'});assert.equal(p.soccer.question.options.length,4);const q=structuredClone(p.soccer.question);
 soccerAction(p,{kind:'answer',questionId:q.id,answer:q.options.find(a=>a!==q.answer),durationMs:1200});assert.equal(p.soccer.level,1);assert.deepEqual(p.soccer.question,q);
 soccerAction(p,{kind:'next'});soccerAction(p,{kind:'ready'});assert.equal(p.soccer.question.options.length,2);
});
test('Every soccer task has one correct option, narrated prompts, and safe mobile UI hooks',()=>{
 const lines=allVoiceLines();for(const line of soccerVoiceLines())assert.ok(lines.includes(line));
 for(const id of ['explorer','beginner'])for(let n=1;n<=20;n++)for(let level=1;level<=3;level++)for(let round=0;round<5;round++){
  const p=freshProfile(id);p.soccer={...soccerState(p),number:n,level,shots:Array(round).fill({}),phase:'question'};const q=soccerQuestion(p);
  assert.equal(q.options.filter(a=>a===q.answer).length,1);assert.equal(new Set(q.options).size,q.options.length);assert.ok(lines.includes(q.prompt),q.prompt);
 }
 const p=freshProfile();assert.equal(routeTab('#soccer'),'soccer');assert.match(navItems('soccer',p),/aria-label="Soccer"/);p.name='<script>x</script>';assert.doesNotMatch(soccerView(p),/<script>/);
 soccerAction(p,{kind:'start'});assert.match(soccerView(p),/Ready! Blow the whistle/);shot(p,false);assert.match(soccerView(p),/The answer was/);assert.match(soccerView(p),/0 goals and 1 goalkeeper saves/);
});
test('Soccer diagnostics distinguish goals, saves and help and exclude Admin by default',async()=>{
 const p=freshProfile('admin'),rows=[];soccerAction(p,{kind:'start'});
 for(let i=0;i<5;i++){const result=shot(p,i!==1,i===2);rows.push({type:'soccer_action',player:'admin',session:'soccer-test',result});soccerAction(p,{kind:'next'});}
 assert.deepEqual((await summarize(rows)).soccer,[]);
 assert.deepEqual((await summarize(rows,{player:'admin'})).soccer,[{player:'admin',shots:5,goals:3,saves:1,independent:3,assisted:1,hints:0,shootouts:1}]);
});
test('Local referee whistle uses two short quiet blasts and effects can be stopped',async()=>{
 const original=globalThis.AudioContext,oscillators=[],events=[];
 const parameter=()=>({setValueAtTime(){},linearRampToValueAtTime(){}});
 globalThis.AudioContext=class{currentTime=0;destination={};async resume(){}createGain(){return {gain:parameter(),connect(){},disconnect(){}};}createOscillator(){const o={frequency:parameter(),connect(){},disconnect(){},starts:[],stops:[],start(t){this.starts.push(t);},stop(t){this.stops.push(t);}};oscillators.push(o);return o;}};
 try{const sounds=createSoccerAudio((kind,detail)=>events.push({kind,...detail}));await sounds.play('whistle');assert.equal(oscillators.length,4);assert.deepEqual(oscillators.map(o=>o.starts[0]),[0,0,.24,.24]);sounds.stop();assert.ok(oscillators.every(o=>o.stops.length===2));assert.deepEqual(events,[{kind:'action',action:'soccer:whistle'}]);for(const kind of ['kick','goal','save'])await sounds.play(kind);assert.equal(events.length,4);}finally{if(original===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=original;}
});
