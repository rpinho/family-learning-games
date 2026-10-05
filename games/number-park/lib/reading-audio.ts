// A short cancelable sequence; never queue narration behind fast play.
export async function readingAudio(keys:string[],signal:AbortSignal,onClip:(i:number)=>void,report:(name:string,detail:string)=>void){
 try{
  const r=await fetch('/voice/manifest.json',{signal,cache:'no-cache'});if(!r.ok)throw Error('Voice unavailable');const m=await r.json() as {clips?:Record<string,string>};
  for(let i=0;i<keys.length;i++){
   if(signal.aborted)return false;const key=keys[i],url=m.clips?.[key];if(!url)throw Error('Missing voice: '+key);
   onClip(i);
   await new Promise<void>((resolve,reject)=>{
    const audio=new Audio(url);let settled=false;let timer:ReturnType<typeof setTimeout>;
    const done=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);audio.pause();audio.onended=null;audio.onerror=null;error?reject(error):resolve();};
    const abort=()=>done(new Error('Cancelled'));
    timer=setTimeout(()=>done(new Error('Voice timed out')),12000);signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
    audio.onended=()=>{report(key,'ended');done();};audio.onerror=()=>done(new Error('Could not play '+key));
    void audio.play().then(()=>report(key,'play_started')).catch(e=>done(e));
   });
  }
  return true;
 }catch(e){if(!signal.aborted)report('audio_error',String(e));return false;}
}
