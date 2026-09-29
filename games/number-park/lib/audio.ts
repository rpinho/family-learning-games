import {calmAudio} from './calm-audio.mjs';
import {takeAwayPrompt} from './play-practice.mjs';
let manifest:Promise<{clips:Record<string,string>}>|undefined;
let playing:HTMLAudioElement|undefined,cancelWait:(()=>void)|undefined,epoch=0,context:AudioContext|undefined;
export function stopVoice(){epoch++;playing?.pause();cancelWait?.();cancelWait=undefined;playing=undefined;}
let current:Promise<void>=Promise.resolve();
// Resolves when the line playing now has finished (or after max ms), so a word break never cuts off praise.
export function voiceSettled(max=6000){return Promise.race([current,new Promise<void>(r=>setTimeout(r,max))]);}
export function say(text:string|string[],report:(s:string)=>void=()=>{}){const task=speakLines(text,report);current=task;return task;}
async function speakLines(text:string|string[],report:(s:string)=>void){
 const unduck=calmAudio().duck();
 const token=++epoch;playing?.pause();cancelWait?.();cancelWait=undefined;
 try{
  manifest??=fetch('/voice/manifest.json').then(r=>{if(!r.ok)throw Error('Voice not ready');return r.json()});const m=await manifest;if(token!==epoch)return;
  const lines=Array.isArray(text)?text:[text];
  for(const line of lines){
   if(token!==epoch)return;if(!m.clips[line])throw Error('Missing voice: '+line);
   const audio=new Audio(m.clips[line]);playing=audio;
   await new Promise<void>((resolve,reject)=>{let settled=false;const done=()=>{if(settled)return;settled=true;if(cancelWait===done)cancelWait=undefined;resolve();};const failed=(e:unknown)=>{if(settled)return;settled=true;if(cancelWait===done)cancelWait=undefined;reject(e);};cancelWait=done;audio.onended=done;audio.onerror=()=>failed(Error('Voice playback failed'));void audio.play().then(()=>report('play_started'),failed);});
  }
  if(token===epoch)report('ended');
 }
 catch(e){manifest=undefined;report(String(e));}
 finally{unduck();}
}
export function chime(){try{context??=new AudioContext();void context.resume();const at=context.currentTime;for(const [f,v] of [[329.63,.045],[659.26,.012],[988.89,.004]]){const osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=f;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(v,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.7);osc.connect(gain).connect(context.destination);osc.start(at);osc.stop(at+.72);}}catch{}}
export function instruction(q:any){return q.prompt|| (q.kind==='addobjects'?'Put the groups together. How many?':q.kind==='count'?'Tap and count.':q.kind==='pattern'?'What comes next?':q.kind==='subtract'?takeAwayPrompt(q.remove):q.kind==='line'?'Slide to the missing number.':'Find the missing number.');}
