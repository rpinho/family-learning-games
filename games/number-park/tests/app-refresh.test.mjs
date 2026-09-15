import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAppRefresh,refreshURL} from '../lib/app-refresh.mjs';
const initial={href:'http://mini:4321/?player=admin&custom=keep#park',player:'beginner',tab:'reading',open:false,sound:false,draft:false,saving:false};
function setup(overrides={}){
 const state={...initial},statuses=[],urls=[],calls=[];
 const deps={read:()=>state,fetch:async(...args)=>{calls.push(args);return {ok:true,json:async()=>({ok:true})};},confirm:()=>true,navigate:url=>urls.push(url),status:s=>statuses.push(s),...overrides};
 return {state,statuses,urls,calls,client:createAppRefresh(deps)};
}
test('refresh navigates to fresh app with selected player/tab/sound and never writes progress',async()=>{
 const f=setup();assert.equal(await f.client.refresh(),true);const u=new URL(f.urls[0]);assert.equal(u.searchParams.get('player'),'beginner');assert.equal(u.searchParams.get('tab'),'reading');assert.equal(u.searchParams.get('quiet'),'1');assert.equal(u.searchParams.get('custom'),'keep');assert.ok(u.searchParams.has('_refresh'));assert.equal(f.calls[0][0],'/health');assert.equal(f.calls[0][1].cache,'no-store');assert.equal(f.calls[0][1].method,undefined);assert.equal(f.client.busy,true);
 await f.client.refresh();assert.equal(f.urls.length,1);
});
test('preserves active math round, draw and planning locations',()=>{
 for(const tab of ['play','draw','planning']){const u=new URL(refreshURL(initial.href,{...initial,tab,open:true,sound:true},123));assert.equal(u.searchParams.get('tab'),tab);assert.equal(u.searchParams.get('resume'),'1');assert.equal(u.searchParams.get('quiet'),'0');assert.equal(u.searchParams.get('_refresh'),'123');}
});
test('pending save blocks refresh before any network or confirmation',async()=>{
 const f=setup();f.state.saving=true;assert.equal(await f.client.refresh(),false);assert.equal(f.calls.length,0);assert.equal(f.urls.length,0);
});
test('cancel protects unfinished work and releases controls',async()=>{
 let confirms=0;const f=setup({confirm:()=>{confirms++;return false;}});f.state.draft=true;assert.equal(await f.client.refresh(),false);assert.equal(confirms,1);assert.equal(f.urls.length,0);assert.equal(f.client.busy,false);assert.equal(f.statuses.at(-1).busy,false);
});
test('offline, failed health or invalid health keep current screen and release controls',async()=>{
 for(const fetch of [async()=>{throw Error('offline')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({ok:false})})]){const f=setup({fetch});assert.equal(await f.client.refresh(),false);assert.equal(f.urls.length,0);assert.equal(f.client.busy,false);assert.ok(f.statuses.some(s=>s.error?.includes('screen is still here')));}
});
test('timeout and double tap do not strand controls or navigate',async()=>{
 let count=0;const f=setup({timeoutMs:10,fetch:(_url,o)=>{count++;return new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('timeout'))));}});const pending=f.client.refresh();assert.equal(await f.client.refresh(),false);assert.equal(await pending,false);assert.equal(count,1);assert.equal(f.client.busy,false);assert.equal(f.urls.length,0);
});
test('page wires real app refresh separately from automatic progress recovery',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.match(source,/aria-label="Refresh app and load updates"/);assert.match(source,/onClick=\{reconnect\}>Reconnect saved progress/);assert.match(source,/client.current.refresh\('resume'\)/);assert.match(source,/appRefresh.current.busy\?Promise.resolve\(null\)/);
});
