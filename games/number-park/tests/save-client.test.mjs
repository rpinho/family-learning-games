import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../lib/save-client.mjs';
const reply=(data,status=200)=>({ok:status<400,status,json:async()=>structuredClone(data)});
const state=(revision=0,id='beginner')=>({id,revision,xp:revision*10,session:{question:{id:'q'+revision}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(fetch,options={}){
 const applied=[],statuses=[],events=[];
 const client=createSaveClient({fetch,apply:p=>applied.push(p),status:s=>statuses.push(s),report:(...e)=>events.push(e),...options});
 return {client,applied,statuses,events};
}
test('conflict automatically reconciles; never replays answer or sends it into another question',async()=>{
 const calls=[];const {client,applied,events,statuses}=fixture(async(path,o)=>{calls.push({path,...o});return calls.length===1?reply(state()):calls.length===2?reply({error:'stale'},409):reply(state(2));});
 await client.select('beginner');assert.equal(await client.action({kind:'answer',answer:3,questionId:'q0'}),null);
 assert.equal(applied.at(-1).revision,2);assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.ok(events.some(x=>x[0]==='recovered'));assert.equal(statuses.at(-1).busy,false);
 assert.equal(new Set(calls.map(x=>x.headers['X-Game-Client'])).size,1);assert.equal(new Set(calls.map(x=>x.headers['X-Game-Request'])).size,3);
});
test('lost response after saved answer recovers scored result once',async()=>{
 let calls=0;const saved={...state(1),session:{question:{id:'q0'},result:{ok:true,xp:10}}};
 const {client,applied}=fixture(async()=>{if(++calls===1)return reply(state());if(calls===2)throw Error('lost response');return reply(saved);});
 await client.select('beginner');await client.action({kind:'answer'});assert.equal(calls,3);assert.deepEqual(applied.at(-1),saved);
});
test('refresh during a pending save waits; double taps do not queue more actions',async()=>{
 const gate=deferred();let count=0;const {client,applied}=fixture(async()=>{count++;if(count===1)return reply(state());if(count===2)return gate.promise;return reply(state(1));});
 await client.select('beginner');const action=client.action({kind:'answer'});await client.refresh('resume');await client.refresh('manual');await client.action({kind:'answer'});assert.equal(count,2);
 gate.resolve(reply(state(1)));await action;await new Promise(r=>setTimeout(r,0));assert.equal(count,3);assert.equal(applied.length,2);assert.equal(client.busy,false);
});
test('old profile response never replaces newly selected player or unlocks their pending request',async()=>{
 const old=deferred(),fresh=deferred();let count=0;const {client,applied}=fixture(async()=>++count===1?old.promise:fresh.promise);
 const first=client.select('beginner'),second=client.select('explorer');old.resolve(reply(state(99)));await first;assert.equal(client.busy,true);assert.equal(applied.length,0);
 fresh.resolve(reply(state(3,'explorer')));await second;assert.equal(applied.at(-1).id,'explorer');assert.equal(client.busy,false);
});
test('unavailable server releases controls and allows manual recovery; no endless retries',async()=>{
 let offline=false,calls=0;const {client,statuses}=fixture(async()=>{calls++;if(offline)throw Error('offline');return reply(state());});
 await client.select('beginner');offline=true;await client.action({kind:'answer'});assert.equal(calls,3);assert.equal(client.busy,false);assert.ok(statuses.some(s=>s.error?.includes('server')));
 offline=false;await client.refresh();assert.equal(calls,4);assert.ok(statuses.some(s=>s.notice==='Game is up to date.'));
});
test('hung requests time out, release busy state and do not loop',async()=>{
 let calls=0;const {client,statuses}=fixture(async(_p,o)=>{calls++;return new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted'))));},{timeoutMs:10});
 await client.select('beginner');assert.equal(calls,1);assert.equal(client.busy,false);assert.ok(statuses.some(s=>s.error?.includes('server')));
});
test('refresh preserves unchanged state identity and ignores older snapshots',async()=>{
 const replies=[state(4),state(4),state(3)];const {client,applied}=fixture(async()=>reply(replies.shift()));await client.select('beginner');await client.refresh();await client.refresh();assert.equal(applied.length,1);assert.equal(applied[0].revision,4);
});
test('validation errors are not retried or disguised as success',async()=>{
 let count=0;const {client,statuses}=fixture(async()=>++count===1?reply(state()):reply({error:'Invalid answer.'},400));await client.select('beginner');assert.equal(await client.action({kind:'answer'}),null);assert.equal(count,2);assert.ok(statuses.some(s=>s.error==='Invalid answer.'));
});
