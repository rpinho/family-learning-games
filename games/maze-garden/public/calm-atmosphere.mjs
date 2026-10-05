import {calmSound} from './calm-sound.mjs';
const bed=calmSound(new URL('./calm-water.m4a',import.meta.url).href);
let on=false; const watched=new WeakSet();let releaseSpeech=null;
const button=document.getElementById('ambience');
function paint(){button.textContent=on?'♫ Water on':'♫ Water';button.setAttribute('aria-pressed',String(on));}
button.addEventListener('click',()=>{on=!on;bed.setEnabled(on);if(on)bed.start();paint();});
paint();bed.setEnabled(false);
globalThis.calmBed={
 stopSpeech(){releaseSpeech?.();releaseSpeech=null;},
 watchSpeech(u){let mine=null;u.addEventListener("start",()=>{releaseSpeech?.();mine=bed.duck();releaseSpeech=mine;});for(const e of ["end","error"])u.addEventListener(e,()=>{mine?.();if(releaseSpeech===mine)releaseSpeech=null;mine=null;});},
 watch(audio){if(!audio||watched.has(audio))return;watched.add(audio);let release=null;
 audio.addEventListener('playing',()=>{release??=bed.duck();});
 for(const event of ['pause','ended','error','emptied'])audio.addEventListener(event,()=>{release?.();release=null;});}
};
window.addEventListener('pagehide',()=>{bed.destroy();delete globalThis.calmBed;},{once:true});
