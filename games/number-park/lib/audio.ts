import {takeAwayPrompt} from './play-practice.mjs';
let manifest:Promise<{clips:Record<string,string>}>|undefined;
let playing:HTMLAudioElement|undefined,cancelWait:(()=>void)|undefined,epoch=0,context:AudioContext|undefined;
export function stopVoice(){epoch++;playing?.pause();cancelWait?.();cancelWait=undefined;playing=undefined;}
let current:Promise<void>=Promise.resolve();
// Resolves when the line playing now has finished (or after max ms), so a word break never cuts off praise.
export function voiceSettled(max=6000){return Promise.race([current,new Promise<void>(r=>setTimeout(r,max))]);}
export function say(text:string|string[],report:(s:string)=>void=()=>{}){const task=speakLines(text,report);current=task;return task;}
async function speakLines(text:string|string[],report:(s:string)=>void){
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
}
export function chime(){try{context??=new AudioContext();void context.resume();[523.25,659.25,783.99].forEach((f,i)=>{const osc=context!.createOscillator(),gain=context!.createGain(),at=context!.currentTime+i*.09;osc.frequency.value=f;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.09,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.22);osc.connect(gain).connect(context!.destination);osc.start(at);osc.stop(at+.24);});}catch{}}
export function instruction(q:any){return q.prompt|| (q.kind==='addobjects'?'Put the groups together. How many?':q.kind==='count'?'Tap and count.':q.kind==='pattern'?'What comes next?':q.kind==='subtract'?takeAwayPrompt(q.remove):q.kind==='line'?'Slide to the missing number.':'Find the missing number.');}
