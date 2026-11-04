import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPageTarget,waitForChrome} from '../scripts/chrome-target.mjs';
test('Chrome readiness waits past browser-only targets for its first debuggable page',async()=>{
 const page={type:'page',webSocketDebuggerUrl:'ws://synthetic/page'};let reads=0,waits=0;
 const target=await waitForPageTarget(async()=>++reads===3?[page]:[{type:'browser'},{type:'page'}],{wait:async ms=>{assert.equal(ms,100);waits++;}});
 assert.equal(target,page);assert.equal(reads,3);assert.equal(waits,2);
});
test('missing page has a bounded failure and read errors remain visible',async()=>{
 let reads=0;await assert.rejects(waitForPageTarget(async()=>{reads++;return [];},{attempts:3,wait:async()=>{}}),/did not open a debuggable page/);assert.equal(reads,3);
 await assert.rejects(waitForPageTarget(async()=>{throw Error('Bad debugger response');}),/Bad debugger response/);
});

const page={type:'page',webSocketDebuggerUrl:'ws://127.0.0.1/synthetic'};
function startup(overrides={}){
 let time=0,waits=0;
 return {options:{timeoutMs:30000,now:()=>time,wait:async ms=>{time+=ms;waits++;},readPort:async()=> '43210\n/browser/synthetic',readTargets:async()=>[page],...overrides},time:()=>time,waits:()=>waits};
}
test('startup tolerates slow port creation, partial writes, connection races and browser-only targets',async()=>{
 let ports=0,targets=0;
 const f=startup({readPort:async()=>{ports++;if(ports<=70)throw Object.assign(Error('not created'),{code:'ENOENT'});return ports===71?'':'43210\n/browser/synthetic';},readTargets:async(port,remaining)=>{
  assert.equal(port,43210);assert.ok(remaining>0&&remaining<=30000);targets++;
  if(targets<=2)throw Object.assign(new TypeError('fetch failed'),{cause:{code:targets===1?'ECONNREFUSED':'ECONNRESET'}});
  return targets===3?[{type:'browser'},{type:'page'}]:[page];
 }});
 assert.equal(await waitForChrome(f.options),page);assert.ok(f.time()>5000);assert.equal(targets,4);
});
test('startup rejects invalid ports and real IO, HTTP, JSON and target errors immediately',async()=>{
 for(const raw of ['0','65536','123oops','-1']){
  const f=startup({readPort:async()=>raw});await assert.rejects(waitForChrome(f.options),/Invalid Chrome debugger port/);assert.equal(f.waits(),0);
 }
 for(const error of [Object.assign(Error('permission denied'),{code:'EACCES'}),Error('Chrome debugger HTTP 403'),new SyntaxError('bad JSON')]){
  const f=startup({readTargets:async()=>{throw error;}});await assert.rejects(waitForChrome(f.options),e=>e===error);assert.equal(f.waits(),0);
 }
 await assert.rejects(waitForChrome(startup({readTargets:async()=>({})}).options),/Invalid Chrome debugger target list/);
});
test('startup never ready has one bounded deadline for both phases',async()=>{
 for(const portMissing of [true,false]){
  const f=startup({timeoutMs:250,readPort:async()=>portMissing?'':'43210',readTargets:async()=>[{type:'page',webSocketDebuggerUrl:'http://invalid'}]});
  await assert.rejects(waitForChrome(f.options),portMissing?/DevToolsActivePort after 250ms/:/initial debuggable page after 250ms/);
  assert.equal(f.time(),250);assert.equal(f.waits(),3);
 }
});
test('an expired debugger request cannot return late readiness',async()=>{
 const f=startup({timeoutMs:200});f.options.readTargets=async()=>{await f.options.wait(200);return [page];};
 await assert.rejects(waitForChrome(f.options),/startup timed out/);assert.equal(f.time(),200);
});
