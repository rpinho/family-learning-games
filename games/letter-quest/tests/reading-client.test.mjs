import test from 'node:test';
import assert from 'node:assert/strict';
import {exclusiveReadingAction} from '../public/reading-client.mjs';
test('Rapid taps while ink is saving submit exactly one answer at the updated revision',async()=>{
 let release,revision=10,busy=false;const submits=[];
 const ink=new Promise(resolve=>release=()=>{revision++;resolve();});
 const run=exclusiveReadingAction(async()=>{await ink;submits.push(revision);},value=>busy=value);
 const first=run();assert.equal(busy,true);await run();await run();assert.deepEqual(submits,[]);
 release();await first;assert.deepEqual(submits,[11]);assert.equal(busy,false);
 await run();assert.deepEqual(submits,[11,11]);
});
test('Failed reading actions release the lock for a deliberate retry',async()=>{
 let calls=0,busy=false;const run=exclusiveReadingAction(async()=>{if(!calls++)throw Error('offline');},v=>busy=v);
 await assert.rejects(run(),/offline/);assert.equal(busy,false);await run();assert.equal(calls,2);
});
