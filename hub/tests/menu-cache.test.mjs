import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {cachedMenuOrderService} from '../menu-cache.mjs';import {createMenuCache} from '../public/menu-cache.mjs';import {CATALOG} from '../public/catalog.mjs';
const ids=CATALOG.map(x=>x.id),reverse=[...ids].reverse();
class FakeWorker extends EventEmitter{postMessage(){this.jobs=(this.jobs||0)+1;}terminate(){this.stopped=true;}unref(){}}
test('Stalled/crashed scan serves fallback or prior per-player snapshot immediately; one worker and bounded retry',async()=>{
 let now=0;const workers=[],errors=[];const service=cachedMenuOrderService({sources:{},players:['a','b'],clock:()=>now,timeoutMs:20,onError:e=>errors.push(e),makeWorker:()=>{const w=new FakeWorker();workers.push(w);return w;}});
 try{
  for(let i=0;i<100;i++)assert.deepEqual(service.ranking('a').order,ids);
  assert.equal(workers.length,1);assert.equal(workers[0].jobs,1);
  workers[0].emit('message',{rankings:{a:{order:reverse},b:{order:ids}}});
  assert.deepEqual(service.ranking('a').order,reverse);assert.deepEqual(service.ranking('b').order,ids);
  now=60001;service.ranking('a');await new Promise(r=>setTimeout(r,35));assert.equal(workers[0].stopped,true);assert.equal(errors.length,1);
  for(let i=0;i<100;i++)assert.deepEqual(service.ranking('a').order,reverse);assert.equal(workers.length,1);
  now+=60001;service.ranking('a');assert.equal(workers.length,2);workers[1].emit('error',Error('unreadable log'));assert.deepEqual(service.ranking('a').order,reverse);
  assert.throws(()=>service.ranking('unknown'));
 }finally{service.close();}
});
test('Menu paints cached/default cards while a request hangs; late results affect only next snapshot and correct player',async()=>{
 const disk=new Map([['family-games-menu-order:a',JSON.stringify(reverse)]]);let release,calls=0;
 const c=createMenuCache({storage:{getItem:k=>disk.get(k),setItem:(k,v)=>disk.set(k,v)},request:()=>{calls++;return new Promise(r=>release=r);}});
 const shown=c.current('a');assert.deepEqual(shown,reverse);assert.deepEqual(c.current('b'),ids);
 const first=c.refresh('a');assert.equal(c.refresh('a'),first);await Promise.resolve();assert.equal(calls,1);assert.deepEqual(c.current('a'),reverse);
 release({order:ids});await first;assert.deepEqual(shown,reverse);assert.deepEqual(c.current('a'),ids);assert.deepEqual(c.current('b'),ids);
});
test('Unavailable storage, malformed rankings and failed requests never hide games or overwrite good order',async()=>{
 const storage={getItem(){throw Error('storage disabled');},setItem(){throw Error('full');}};
 for(const response of [{order:['bad']},{order:[ids[0],ids[0]]},null]){const c=createMenuCache({storage,request:async()=>response});await c.refresh('a');assert.deepEqual(c.current('a'),ids);}
 const c=createMenuCache({storage,request:async()=>{throw Error('offline');}});await c.refresh('a');assert.deepEqual(c.current('a'),ids);
});

test('An unwarmed server does not replace favorites already saved on the device',async()=>{
 const c=createMenuCache({storage:{getItem:()=>JSON.stringify(reverse)},request:async()=>({order:ids,ready:false})});
 assert.deepEqual(c.current('a'),reverse);await c.refresh('a');assert.deepEqual(c.current('a'),reverse);
});
