import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('a fresh install speaks every math goal without a recorded cache, waits for completion and settles when stopped',async()=>{
 const source=readFileSync(new URL('../lib/audio.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm," ")+"\n";
 const js=ts.transpileModule("const takeAwayPrompt=()=>'',calmAudio=()=>({duck:()=>()=>{}});\n"+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const old={fetch:globalThis.fetch,speechSynthesis:globalThis.speechSynthesis,SpeechSynthesisUtterance:globalThis.SpeechSynthesisUtterance};
 let cancelled=0;const spoken=[];
 try{
  globalThis.fetch=async()=>({ok:false});
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  globalThis.speechSynthesis={speak:u=>spoken.push(u),cancel:()=>cancelled++};
  const audio=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  let ended=false;const first=audio.say(['Which is lighter?','A cat is lighter.']).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(spoken[0].text,'Which is lighter?');assert.equal(ended,false);
  spoken[0].onend();await new Promise(r=>setImmediate(r));assert.equal(spoken[1].text,'A cat is lighter.');assert.equal(ended,false);
  spoken[1].onend();await first;assert.equal(ended,true);
  const next=audio.say('The lighter side goes up.');await new Promise(r=>setImmediate(r));audio.stopVoice();await next;assert.equal(cancelled,1);
 }finally{Object.assign(globalThis,old);}
});
