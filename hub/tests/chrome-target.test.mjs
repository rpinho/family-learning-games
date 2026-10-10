import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPageTarget} from '../scripts/chrome-target.mjs';
test('Chrome readiness waits past browser-only targets for its first debuggable page',async()=>{
 const page={type:'page',webSocketDebuggerUrl:'ws://synthetic/page'};let reads=0,waits=0;
 const target=await waitForPageTarget(async()=>++reads===3?[page]:[{type:'browser'},{type:'page'}],{wait:async ms=>{assert.equal(ms,100);waits++;}});
 assert.equal(target,page);assert.equal(reads,3);assert.equal(waits,2);
});
test('missing page has a bounded failure and read errors remain visible',async()=>{
 let reads=0;await assert.rejects(waitForPageTarget(async()=>{reads++;return [];},{attempts:3,wait:async()=>{}}),/did not open a debuggable page/);assert.equal(reads,3);
 await assert.rejects(waitForPageTarget(async()=>{throw Error('Bad debugger response');}),/Bad debugger response/);
});
