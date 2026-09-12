import test from 'node:test';import assert from 'node:assert/strict';
import {createSaveQueue,fetchJSON} from '../public/save-request.mjs';
test('A rejected save clears busy and does not poison the next save',async()=>{
 const queue=createSaveQueue();const failed=queue.run(async()=>{throw Error('Stale client');});assert(queue.busy());await assert.rejects(failed,/Stale client/);assert.equal(queue.busy(),false);assert.equal(await queue.run(async()=>42),42);assert.equal(queue.busy(),false);
});
test('Queued settings wait for state recovery after a failure',async()=>{
 const queue=createSaveQueue(),order=[];let release;const wait=new Promise(r=>release=r);
 const failed=queue.run(async()=>{order.push('save');await wait;order.push('recovered');throw Error('rejected');});
 const next=queue.run(async()=>{order.push('settings');return 2;});release();await assert.rejects(failed);assert.equal(await next,2);assert.deepEqual(order,['save','recovered','settings']);assert.equal(queue.busy(),false);
});
test('Hung requests, HTTP failures and malformed bodies all settle and release saving',async()=>{
 const original=globalThis.fetch,queue=createSaveQueue();
 try{
  globalThis.fetch=async()=>new Promise(()=>{});await assert.rejects(queue.run(()=>fetchJSON('/test',{},15)),/timed out/);assert.equal(queue.busy(),false);
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Update needed',code:'CLIENT_UPDATE'})});await assert.rejects(queue.run(()=>fetchJSON('/test')),e=>e.status===409&&e.code==='CLIENT_UPDATE');assert.equal(queue.busy(),false);
  globalThis.fetch=async()=>({ok:true,json:async()=>{throw SyntaxError('bad json');}});await assert.rejects(queue.run(()=>fetchJSON('/test')),/bad json/);assert.equal(queue.busy(),false);
 }finally{globalThis.fetch=original;}
});
