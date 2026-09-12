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
 }catch(e){
  if(signal.aborted)return false;
  if(!globalThis.speechSynthesis){report('audio_error',String(e));return false;}
  // Browser voices pronounce words and letter NAMES, not reliable isolated phonemes.
  // A grown-up should model the sound; do not substitute guessed synthetic phonemes.
  const examples:Record<string,string>={m:'map',a:'apple',s:'sun',t:'top',p:'pig',i:'in',n:'net',c:'cat',o:'on',d:'dog',g:'go',h:'hat',e:'egg',r:'red'};
  for(let i=0;i<keys.length;i++){
   if(signal.aborted)return false;
   const match=keys[i].match(/^Reading sound (\w)\.$/);
   const text=match?`${match[1].toUpperCase()}, as in ${examples[match[1]]||match[1]}.`:keys[i].replace(/^Reading word /,'');
   onClip(i);
   const ok=await new Promise<boolean>(resolve=>{
    const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.8;
    const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang==='en-US')||null;
    let done=false;const finish=(ok:boolean)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(ok);};
    const abort=()=>{speechSynthesis.cancel();finish(false);};const timer=setTimeout(abort,12000);
    signal.addEventListener('abort',abort,{once:true});u.onend=()=>finish(true);u.onerror=()=>finish(false);
    speechSynthesis.cancel();speechSynthesis.speak(u);
   });
   if(!ok)return false;report(keys[i],'ended');
  }
  return true;
 }
}
