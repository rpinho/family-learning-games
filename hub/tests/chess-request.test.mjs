import test from 'node:test';
import assert from 'node:assert/strict';
import {requestChess} from '../public/chess/request.mjs';
const summary=()=>({revision:10,current:'lesson',settings:{band:'steps'},session:{id:'finished-session',lesson:'steps-take-1',phase:'summary'},completed:{'steps-take-1':{best:5}}});
const input=()=>({type:'start',lesson:'steps-take-2',revision:9,requestId:'same-request-id'});
const conflict=()=>Object.assign(Error('Newer progress'),{status:409});
test('Confirmed stale lesson start refreshes revision once and opens next lesson with the same request ID',async()=>{
 const before=summary(),latest=summary(),body=input(),calls=[];latest.settings.sound=true;
 const result=await requestChess('/api/chess',body,before,{request:async(url,options)=>{
  calls.push(options);if(calls.length===1)throw conflict();if(!options.method)return {profile:latest};return {profile:{...latest,session:{phase:'intro',lesson:body.lesson}}};
 }});
 assert.equal(result.profile.session.lesson,'steps-take-2');assert.equal(calls.length,3);
 assert.equal(JSON.parse(calls[2].body).revision,10);assert.equal(JSON.parse(calls[2].body).requestId,body.requestId);
 assert.deepEqual(before.completed,latest.completed);
});
test('A stale move, changed course, fresh unfinished lesson, or different summary never gets replayed',async()=>{
 for(const variant of ['move','band','active','summary','locked','game']){
  const before=summary(),latest=summary(),body=input();let posts=0;
  if(variant==='move')body.type='move';if(variant==='band')latest.settings.band='foundations';
  if(variant==='active')latest.session.phase='puzzle';if(variant==='summary')latest.session.id='another-session';
  if(variant==='locked')body.lesson='steps-mate-3';if(variant==='game')latest.current='game';
  await assert.rejects(requestChess('/api/chess',body,before,{request:async(url,o)=>{if(o.method){posts++;throw conflict();}return {profile:latest};}}),e=>e.latestProfile===latest);
  assert.equal(posts,1,variant);
 }
});
test('Network/server failure and failed refresh retain original pending action; no blind retries',async()=>{
 for(const status of [undefined,503,409]){
  let calls=0;const error=Object.assign(Error('offline'),{status});
  await assert.rejects(requestChess('/api/chess',input(),summary(),{request:async()=>{calls++;throw error;}}),e=>e===error&&!e.latestProfile);
  assert.equal(calls,status===409?2:1);
 }
});
test('Second revision race stops after one retry and reads latest progress; leaving prevents rebase',async()=>{
 let posts=0,reads=0;const latest=summary();
 await assert.rejects(requestChess('/api/chess',input(),summary(),{request:async(url,o)=>{if(o.method){posts++;throw conflict();}reads++;return {profile:latest};}}),e=>e.latestProfile===latest);
 assert.equal(posts,2);assert.equal(reads,2);
 let active=true,calls=0;
 await assert.rejects(requestChess('/api/chess',input(),summary(),{active:()=>active,request:async(url,o)=>{calls++;if(o.method)throw conflict();active=false;return {profile:latest};}}));
 assert.equal(calls,2);
});
