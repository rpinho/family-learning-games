import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {mediaSettled} from '../public/word-break.mjs';
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
function harness({fallback=false}={}){
 class Audio extends EventTarget {
  paused=true; ended=false; currentTime=0; plays=0;
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  play(){this.plays++;this.paused=false;this.ended=false;return Promise.resolve();}
  finish(){this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
 }
 const audio=new Audio(),spoken=[];
 const synth={cancel(){for(const u of spoken)u.onend?.();},getVoices:()=>[],speak(u){spoken.push(u);}};
 const functions=['stopSpeech','say','sayHint','fallback'].map(name=>app.split('\n').find(line=>line.startsWith('function '+name+'('))).join('\n');
 const api=runInNewContext('let hintSpeech=null;'+functions+';({sayHint,say,stopSpeech})',{
  audio,clips:fallback?{}:{arrow:'arrow.wav',circle:'circle.wav'},muted:true,mediaSettled,
  window:{speechSynthesis:synth},speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}
 });
 return {...api,audio,spoken};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
test('rapid Show again taps play one complete hint; ending allows a fresh replay',async()=>{
 const h=harness();h.sayHint('arrow');for(let i=0;i<7;i++)h.sayHint('arrow');
 assert.equal(h.audio.plays,1);await flush();h.audio.finish();await flush();h.sayHint('arrow');
 assert.equal(h.audio.plays,2);await flush();h.audio.finish();
});
test('movement cancellation and a different instruction allow the hint to start again',async()=>{
 const h=harness();h.sayHint('arrow');await flush();h.stopSpeech();h.sayHint('arrow');assert.equal(h.audio.plays,2);
 await flush();h.sayHint('circle');assert.equal(h.audio.plays,3);await flush();h.audio.finish();await flush();
 h.sayHint('arrow');assert.equal(h.audio.plays,4);await flush();h.say('circle',true);assert.equal(h.audio.plays,5);await flush();h.audio.finish();
});
test('speech fallback also finishes uninterrupted and can be replayed after ending',async()=>{
 const h=harness({fallback:true});h.sayHint('arrow');h.sayHint('arrow');assert.equal(h.spoken.length,1);
 h.spoken[0].onend();await flush();h.sayHint('arrow');assert.equal(h.spoken.length,2);h.spoken[1].onend();
});
test('failed speech is retryable, with no queued repeats or stale completion clearing a newer hint',async()=>{
 const h=harness({fallback:true});h.sayHint('arrow');h.spoken[0].onerror({error:'failed'});await flush();
 h.sayHint('arrow');assert.equal(h.spoken.length,2);h.sayHint('circle');await flush();h.sayHint('circle');assert.equal(h.spoken.length,3);h.spoken[2].onend();
});
