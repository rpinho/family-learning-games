import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {elapsedMs} from '../public/timing.mjs';

const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
function handler(name,next){return source.slice(source.indexOf(`async function ${name}(`),source.indexOf(next,source.indexOf(`async function ${name}(`)));}
test('A wall-clock correction cannot reject a maze answer or change its measured duration',async()=>{
 for(const wall of [9000,999999999]){
  let payload;
  const context=vm.createContext({
   elapsedMs,performance:{now:()=>12500},Date:{now:()=>wall},
   mazeStarted:10000,busy:false,mazeClient:null,mazeMessage:'',tab:'maze',mute:true,demo:false,
   profile:{revision:7,settings:{sound:false}},mazeQuestion:()=>({id:'synthetic-gate',type:'find'}),mazeTapLine:()=>'',
   telemetry:{record(){}},coachVoice:{},request:async(route,input)=>{payload=input;return {result:{kind:'correct'}};},
   accept(){},chime(){},render(){},notice(message){throw Error(message);},praise(){},speak(){}
  });
  // elapsedMs must use the same clock as the browser context.
  context.elapsedMs=start=>elapsedMs(start,context.performance.now());
  vm.runInContext(handler('mazeAct','let rescueClient='),context);
  await vm.runInContext("mazeAct({kind:'answer',answer:'A'})",context);
  assert.equal(payload.durationMs,2500);assert.equal(payload.revision,7);assert.equal(payload.questionId,'synthetic-gate');
 }
});
test('Lesson submission also keeps elapsed time when wall time moves backward',async()=>{
 let payload;
 const context=vm.createContext({
  elapsedMs:start=>elapsedMs(start,12500),performance:{now:()=>12500},Date:{now:()=>9000},
  challenge:{id:'synthetic-lesson'},started:10000,busy:false,feedback:null,saveError:'',strokes:[],helped:false,
  telemetry:{record(){}},render(){},request:async(route,input)=>{payload=input;return {profile:{},result:{ok:true},challenge:{}};},
  pickDialogue:()=>'',feedbackCategory:()=>'',chime(){},coachVoice:{mode:'letter'},praise(){}
 });
 vm.runInContext(handler('submit','function celebrate('),context);
 await vm.runInContext("submit('A')",context);
 assert.equal(payload.durationMs,2500);assert.equal(context.saveError,'');
});
test('Elapsed durations retain ordinary timing and the server bounds',()=>{
 assert.equal(elapsedMs(1000,4500),3500);
 assert.equal(elapsedMs(1000,1000),0);
 assert.equal(elapsedMs(1000,900),0);
 assert.equal(elapsedMs(0,172800000),86400000);
});
