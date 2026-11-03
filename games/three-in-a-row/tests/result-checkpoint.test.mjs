import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {settled} from '../dist/word-break.mjs';

const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
// Execute the actual send/checkpoint declarations, with controlled boundary adapters.
const flow=source.slice(source.indexOf('async function checkpoint('),source.indexOf('function choose('));
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function harness(t,{mode='play',done=0,feedback=()=>undefined,sound=true}={}){
 t.mock.timers.enable({apis:['setTimeout']});
 const calls=[],error={textContent:''};
 const context=vm.createContext({
  settled,setTimeout,Promise,sound,player:'admin',busy:false,breaking:false,wbLevel:null,
  DEFAULT_TRACK:{admin:'letters'},p:{revision:7,game:{phase:'you'}},
  $:()=>error,render(){},event:(...args)=>calls.push(['event',...args]),
  request:async(path,input)=>{calls.push(['request',path,input]);return {
   revision:8,learning:{done},game:{phase:'done',mode,winner:'X',message:'The paper robot made a row.'}
  };},
  youMark:()=> 'X',other:()=> 'O',ding:()=>calls.push(['ding']),
  speak:(...args)=>{calls.push(['speak',...args]);return sound?feedback():undefined;},
  fetchWordLevel:async()=>{calls.push(['level']);return 'letters';},
  stop:()=>calls.push(['stop']),wordBreak:async options=>calls.push(['break',options]),
  sync:async()=>{},announce(){},lastSpeech:''
 });
 vm.runInContext(flow,context);
 const tick=async ms=>{t.mock.timers.tick(ms);await flush();};
 return {context,calls,error,tick,send:()=>context.send({type:'move',cell:2}),
  transitions:()=>calls.filter(c=>['stop','break'].includes(c[0])).map(c=>c[0])};
}

test('long result feedback finishes before stop and wordBreak, without another visual pause',async t=>{
 let finish;const speech=new Promise(r=>finish=r);
 const h=harness(t,{feedback:()=>speech});const sent=h.send();await flush();
 await h.tick(2100);assert.deepEqual(h.transitions(),[]);
 assert.equal(h.context.busy,true);assert.equal(h.context.breaking,true);
 await h.tick(1900);assert.deepEqual(h.transitions(),[]);
 finish('ended');await sent;
 assert.deepEqual(h.transitions(),['stop','break']);
 assert.equal(h.calls.find(c=>c[0]==='break')[1].reason,'match-end');
 assert.equal(h.context.busy,false);assert.equal(h.context.breaking,false);
 assert.equal(h.error.textContent,'');
 assert.equal(h.calls.filter(c=>c[0]==='request').length,1,'no extra save/action');
 assert.equal(h.calls.find(c=>c[0]==='request')[2].revision,7);
});

for(const kind of ['short','muted','rejected']){
 test(`${kind} result feedback retains the minimum 2100ms pause`,async t=>{
  let finish;const speech=new Promise((resolve,reject)=>finish=kind==='rejected'?reject:resolve);
  const h=harness(t,{sound:kind!=='muted',feedback:()=>speech});
  const sent=h.send();await flush();await h.tick(100);
  if(kind!=='muted')finish(kind==='rejected'?Error('Synthetic audio failure'):'ended');
  await flush();await h.tick(1999);assert.deepEqual(h.transitions(),[]);
  await h.tick(1);await sent;assert.deepEqual(h.transitions(),['stop','break']);
  assert.equal(h.calls.find(c=>c[0]==='break')[1].effects(),kind!=='muted');
  assert.equal(h.calls.find(c=>c[0]==='speak').length,2,'result feedback stays nonessential');
 });
}

test('stalled result feedback progresses at the existing bounded timeout',async t=>{
 const h=harness(t,{feedback:()=>new Promise(()=>{})});const sent=h.send();await flush();
 await h.tick(6000-1);assert.deepEqual(h.transitions(),[]);
 await h.tick(1);await sent;assert.deepEqual(h.transitions(),['stop','break']);
});

test('practice checkpoints occur only after every third newly completed puzzle',async t=>{
 let finish;let speech;
 const h=harness(t,{mode:'practice',feedback:()=>speech});
 for(let done=1;done<=6;done++){
  h.context.p={revision:7,game:{phase:'you'}};
  h.context.request=async()=>({revision:8,learning:{done},game:{phase:'done',mode:'practice',winner:'X',message:'A paper robot row.'}});
  speech=new Promise(r=>finish=r);
  const before=h.transitions().length,sent=h.send();await flush();
  await h.tick(2100);assert.equal(h.transitions().length,before);
  finish('ended');await sent;
  assert.equal(h.transitions().length,before+(done%3===0?2:0));
  if(done%3===0)assert.equal(h.calls.findLast(c=>c[0]==='break')[1].reason,'practice-puzzles');
  // Re-sending while already done does not count the result or open another checkpoint.
  const repeats=h.transitions().length;await h.send();await h.tick(6000);
  assert.equal(h.transitions().length,repeats);
 }
});
