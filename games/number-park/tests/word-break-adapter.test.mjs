import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
// Number Park's word-break speak() is say(): its task settles when the line is over (audio-finished contract).
const lib=name=>new URL('../lib/'+name,import.meta.url).href;
const code=ts.transpileModule(readFileSync(new URL('../lib/audio.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
 .replace("'./calm-audio.mjs'",`'${lib('calm-audio.mjs')}'`).replace("'./play-practice.mjs'",`'${lib('play-practice.mjs')}'`);
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
test('The word break receives say() itself, so replies wait for the question to finish',()=>{
 assert.ok(page.includes("speak:(line:string,manual:boolean)=>{if(manual||soundRef.current||!(WORD_BREAK_FEEDBACK as string[]).includes(line))return say(line,e=>event('voice',line,e));}"));
});
test('say() settles when the clip ends, is stopped on purpose, or cannot play',async()=>{
 const original={fetch:globalThis.fetch,Audio:globalThis.Audio};const clips=[];let mode='play';
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({clips:{'Find the letter B.':'/b','Yes!':'/y'}})});
  globalThis.Audio=class{constructor(url){this.url=url;clips.push(this);}pause(){this.paused=true;}play(){return mode==='block'?Promise.reject(Object.assign(Error('blocked'),{name:'NotAllowedError'})):Promise.resolve();}};
  const {say,stopVoice}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const wait=()=>new Promise(r=>setTimeout(r,5));
  let s='open';const q=say('Find the letter B.').then(()=>s='over');await wait();assert.equal(s,'open','still playing');
  clips.at(-1).onended();await q;assert.equal(s,'over');
  s='open';const r=say('Yes!').then(()=>s='over');await wait();stopVoice();await r;assert.equal(s,'over','stopped on purpose');
  mode='block';const reports=[];await say('Yes!',x=>reports.push(x));assert.ok(reports.some(x=>/blocked/.test(x)),'blocked settles at once');
 }finally{globalThis.fetch=original.fetch;globalThis.Audio=original.Audio;}
});
