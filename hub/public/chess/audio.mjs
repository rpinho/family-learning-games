// One audio element retains gesture permission across subsequent coach clips.
export function createCoachAudio({createAudio=()=>new Audio(),event=()=>{},talking=()=>{}}={}){
 const audio=createAudio();audio.preload='auto';
 let generation=0,active=false,unlocked=false;
 function stop(){
  generation++;active=false;
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
 function play(source){
  stop();const token=generation;active=true;let reported=false;
  const current=()=>token===generation;
  const fail=(error)=>{
   if(!current()||reported)return;
   reported=true;active=false;talking(false);
   event('chess_voice_unavailable',JSON.stringify({name:error?.name||'MediaError',message:error?.message||'Clip playback failed',code:audio.error?.code||0,source}));
  };
  audio.src=source;
  audio.onplaying=()=>{if(current()){unlocked=true;talking(true);event('chess_voice_play',source);}};
  audio.onended=()=>{if(current()){active=false;talking(false);event('chess_voice_end',source);}};
  audio.onerror=()=>fail(audio.error);
  try{Promise.resolve(audio.play()).catch(fail);}catch(error){fail(error);}
 }
 return {play,stop,unlock,isPlaying:()=>active&&!audio.paused};
}
