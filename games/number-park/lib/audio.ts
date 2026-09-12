import {takeAwayPrompt} from './play-practice.mjs';
let manifest:Promise<{clips:Record<string,string>}>|undefined;
let playing:HTMLAudioElement|undefined,epoch=0,context:AudioContext|undefined;
export function stopVoice(){epoch++;playing?.pause();playing=undefined;globalThis.speechSynthesis?.cancel();}
export async function say(text:string,report:(s:string)=>void=()=>{}){
 stopVoice();const token=epoch;
 try{manifest??=fetch('/voice/manifest.json').then(r=>{if(!r.ok)throw Error('Voice not ready');return r.json()});const m=await manifest;if(token!==epoch)return;if(!m.clips[text])throw Error('Missing voice: '+text);playing=new Audio(m.clips[text]);playing.onended=()=>report('ended');await playing.play();report('play_started');}
 catch(e){manifest=undefined;if(token!==epoch)return;if(!globalThis.speechSynthesis){report('Speech unavailable');return;}const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.9;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang==='en-US')||null;u.onend=()=>report('ended');u.onerror=()=>report('Speech unavailable');speechSynthesis.speak(u);report('play_started');}
}
export function chime(){try{context??=new AudioContext();void context.resume();[523.25,659.25,783.99].forEach((f,i)=>{const osc=context!.createOscillator(),gain=context!.createGain(),at=context!.currentTime+i*.09;osc.frequency.value=f;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.09,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.22);osc.connect(gain).connect(context!.destination);osc.start(at);osc.stop(at+.24);});}catch{}}
export function instruction(q:any){return q.prompt|| (q.kind==='addobjects'?'Put the groups together. How many?':q.kind==='count'?'Tap and count.':q.kind==='pattern'?'What comes next?':q.kind==='subtract'?takeAwayPrompt(q.remove):q.kind==='line'?'Slide to the missing number.':'Find the missing number.');}
