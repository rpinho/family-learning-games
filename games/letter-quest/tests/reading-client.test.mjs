import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {exclusiveReadingAction} from '../public/reading-client.mjs';
test('Rapid taps while ink is saving submit exactly one answer at the updated revision',async()=>{
 let release,revision=10,busy=false;const submits=[];
 const ink=new Promise(resolve=>release=()=>{revision++;resolve();});
 const run=exclusiveReadingAction(async()=>{await ink;submits.push(revision);},value=>busy=value);
 const first=run();assert.equal(busy,true);await run();await run();assert.deepEqual(submits,[]);
 release();await first;assert.deepEqual(submits,[11]);assert.equal(busy,false);
 await run();assert.deepEqual(submits,[11,11]);
});

const appSource=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
// Execute the shipped dispatch and sound gate, without booting the browser app.
const readingActSource=appSource.slice(appSource.indexOf('async function readingAct('),appSource.indexOf('async function soccerAct('));
const praiseSource=appSource.slice(appSource.indexOf('function praise('),appSource.indexOf('function readingPrompt('));
for(const resultKind of ['incorrect','correct'])for(const sound of [true,false]){
 test(`Reading ${resultKind} response selects its feedback voice with sound ${sound?'on':'off'}`,async()=>{
  const calls=[],requests=[],accepted=[];
  const saved={id:'admin',revision:8,settings:{sound},reading:{phase:resultKind==='correct'?'feedback':'question',question:{id:'synthetic-reading',type:'decode'},results:[{ok:resultKind==='correct'}]}};
  const response={profile:saved,result:{kind:resultKind,line:resultKind==='correct'?'Synthetic success.':'Synthetic retry.'}};
  let chimes=0;
  const context=vm.createContext({
   profile:{id:'admin',revision:7,settings:{sound},reading:{question:{id:'synthetic-reading',type:'decode'}}},
   readingInkQueue:Promise.resolve(),readingInkError:'',readingStarted:1000,readingMessage:'',busy:true,demo:false,mute:false,
   readingState:p=>p.reading,elapsedMs:()=>2500,
   coachVoice:{stop(){},feedback:(ok,line)=>calls.push({ok,line})},pickDialogue:category=>`Synthetic ${category}.`,
   readingRequest:async payload=>{requests.push(payload);return response;},
   accept:data=>{accepted.push(data);context.profile=data.profile;},
   render(){},chime(){chimes++;},notice:message=>assert.fail(message)
  });
  vm.runInContext(praiseSource+readingActSource,context);
  await vm.runInContext("readingAct('answer','invented answer')",context);
  assert.deepEqual(calls,sound?[{ok:resultKind==='correct',line:`Synthetic ${resultKind==='correct'?'success':'retry'}.`}]:[]);
  assert.equal(chimes,resultKind==='correct'?1:0);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)),[{kind:'answer',answer:'invented answer',durationMs:2500,questionId:'synthetic-reading',revision:7}]);
  assert.deepEqual(accepted,[response]);assert.equal(context.profile,saved);
  assert.equal(context.readingMessage,response.result.line);assert.equal(context.busy,false);
 });
}
test('Failed reading actions release the lock for a deliberate retry',async()=>{
 let calls=0,busy=false;const run=exclusiveReadingAction(async()=>{if(!calls++)throw Error('offline');},v=>busy=v);
 await assert.rejects(run(),/offline/);assert.equal(busy,false);await run();assert.equal(calls,2);
});
