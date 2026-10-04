// One audio element retains gesture permission across subsequent coach clips.
export function createCoachAudio({createAudio=()=>new Audio(),event=()=>{},talking=()=>{},fetchAudio=(source,options)=>fetch(source,options),urls=URL}={}){
 const audio=createAudio();audio.preload='auto';
 let generation=0,active=false,unlocked=false,startTimer=null;
 // finished(): settles when the current clip is over (ended, stopped/replaced, failed or skipped) - the word-break
 // audio-finished contract.
 let settle=null,finished=Promise.resolve('ended');
 const over=state=>{const s=settle;settle=null;s?.(state);};
 const cached=new Map(),warming=new Map(),controllers=new Set();let disposed=false;
 async function warm(sources){
  const pending=[...new Set(sources)].filter(source=>source&&!cached.has(source)&&!warming.has(source));
  let next=0;
  await Promise.all([0,1].map(async()=>{
   while(!disposed&&next<pending.length){
    const source=pending[next++],controller=new AbortController();controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),8000);
    const task=(async()=>{
     try{const response=await fetchAudio(source,{signal:controller.signal,cache:'force-cache'});
      if(!response.ok)return;
      const blob=await response.blob();
      if(!disposed)cached.set(source,urls.createObjectURL(blob));
     }catch{}finally{clearTimeout(timer);controllers.delete(controller);warming.delete(source);}
    })();
    warming.set(source,task);await task;
   }
  }));
 }
 function stop(){
  clearTimeout(startTimer);startTimer=null;
  generation++;active=false;over('stopped');
  audio.onplaying=audio.onended=audio.onerror=null;
  audio.pause();talking(false);
 }
 function unlock(){
  if(unlocked||active)return;
  // A short silent WAV played directly in the user's gesture, never device speech.
  audio.src='data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACAAA==';
  const token=++generation;
  try{Promise.resolve(audio.play()).then(()=>{
   unlocked=true;if(token===generation)audio.pause();
  },()=>{});}catch{}
 }
 function play(source,{maxStartDelayMs=0}={}){
  stop();const token=generation;active=true;let reported=false;
  finished=new Promise(r=>settle=r);
  const current=()=>token===generation;
  const fail=(error)=>{
   if(!current()||reported)return;
   clearTimeout(startTimer);startTimer=null;
   reported=true;active=false;talking(false);over('failed');
   event('chess_voice_unavailable',JSON.stringify({name:error?.name||'MediaError',message:error?.message||'Clip playback failed',code:audio.error?.code||0,source}));
  };
  audio.src=cached.get(source)||source;
  audio.onplaying=()=>{if(current()){clearTimeout(startTimer);startTimer=null;unlocked=true;talking(true);event('chess_voice_play',source);}};
  audio.onended=()=>{if(current()){clearTimeout(startTimer);startTimer=null;active=false;talking(false);event('chess_voice_end',source);over('ended');}};
  audio.onerror=()=>fail(audio.error);
  if(maxStartDelayMs>0)startTimer=setTimeout(()=>{if(current()){stop();event('chess_voice_skip','reaction missed its moment');}},maxStartDelayMs);
  try{Promise.resolve(audio.play()).catch(fail);}catch(error){fail(error);}
 }
 function dispose(){disposed=true;stop();for(const controller of controllers)controller.abort();for(const blob of cached.values())urls.revokeObjectURL(blob);cached.clear();}
 return {play,stop,unlock,warm,dispose,isPlaying:()=>active&&!audio.paused,finished:()=>finished};
}
