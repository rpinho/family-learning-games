import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('optional water starts only on request; canceled speech cannot unduck a newer line',async()=>{
 const button=new EventTarget();button.setAttribute=()=>{};let enabled=false,started=0,ducks=0,destroyed=false;const handlers={};
 const sandbox={URL,document:{getElementById:()=>button},window:{addEventListener:(e,f)=>handlers[e]=f},calmSound:()=>({setEnabled:v=>enabled=v,start:()=>started++,duck:()=>{ducks++;let done=false;return()=>{if(!done)ducks--;done=true;};},destroy:()=>destroyed=true})};
 let src=await readFile(new URL('../public/calm-atmosphere.mjs',import.meta.url),'utf8');src=src.replace(/^import .*?;\n/,'').replace('import.meta.url',JSON.stringify('http://example.test/calm-atmosphere.mjs'));vm.runInNewContext(src,sandbox);
 assert.equal(started,0);assert.equal(enabled,false);button.dispatchEvent(new Event('click'));assert.equal(started,1);assert.equal(enabled,true);
 const a=new EventTarget(),b=new EventTarget();sandbox.calmBed.watchSpeech(a);sandbox.calmBed.watchSpeech(b);a.dispatchEvent(new Event('start'));b.dispatchEvent(new Event('start'));assert.equal(ducks,1);a.dispatchEvent(new Event('end'));assert.equal(ducks,1);b.dispatchEvent(new Event('end'));assert.equal(ducks,0);
 const media=new EventTarget();sandbox.calmBed.watch(media);sandbox.calmBed.watch(media);media.dispatchEvent(new Event('playing'));assert.equal(ducks,1);media.dispatchEvent(new Event('pause'));assert.equal(ducks,0);
 button.dispatchEvent(new Event('click'));assert.equal(enabled,false);handlers.pagehide();assert.equal(destroyed,true);assert.equal(sandbox.calmBed,undefined);
});
