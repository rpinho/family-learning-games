import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/reading-audio.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readingAudio}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('reading voice runs one clip at a time, finishes, cancels cleanly, and reports failures',async()=>{
 const originalFetch=globalThis.fetch,originalAudio=globalThis.Audio;let played=[],mode='normal',controller=new AbortController();
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({clips:{m:'/m',a:'/a',t:'/t'}})});
  globalThis.Audio=class{constructor(url){this.url=url;}pause(){}play(){played.push(this.url);if(mode==='reject')return Promise.reject(Error('Blocked'));queueMicrotask(()=>{if(mode==='abort')controller.abort();else this.onended?.();});return Promise.resolve();}};
  const events=[];assert.equal(await readingAudio(['m','a','t'],controller.signal,()=>{},(...e)=>events.push(e)),true);assert.deepEqual(played,['/m','/a','/t']);assert.equal(events.filter(e=>e[1]==='ended').length,3);
  mode='abort';played=[];controller=new AbortController();assert.equal(await readingAudio(['m','a'],controller.signal,()=>{},()=>{}),false);assert.deepEqual(played,['/m']);
  mode='reject';controller=new AbortController();assert.equal(await readingAudio(['m'],controller.signal,()=>{},(...e)=>events.push(e)),false);assert.ok(events.some(e=>e[0]==='audio_error'));
  mode='normal';assert.equal(await readingAudio(['missing'],controller.signal,()=>{},()=>{}),false);
 }finally{globalThis.fetch=originalFetch;globalThis.Audio=originalAudio;}
});
