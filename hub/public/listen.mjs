// Push-to-talk for the book. Tap -> the microphone opens (the browser's permission prompt appears on this very
// first tap, because getUserMedia is called inside the tap) -> he speaks -> it stops by itself after a child-length
// quiet (~0.9 s) -> the sound goes to this machine's own recogniser as 16 kHz PCM, in memory only -> match or not.
// Nothing is recorded or kept: the samples live in this function and in one request, then they are gone.
export const SILENCE_MS=900,MAX_MS=5500,NO_SPEECH_MS=5000,PREROLL_MS=300,RATE=16000;
let state={blocked:false,why:''};
export const micState=()=>({...state});
export function micSupported(){return !!(globalThis.isSecureContext&&navigator.mediaDevices?.getUserMedia&&(globalThis.AudioContext||globalThis.webkitAudioContext));}
// Is it already known to be blocked? (Never asks; asking happens only on a tap.)
export async function checkMic(){
 if(!micSupported()){state={blocked:true,why:globalThis.isSecureContext?'unsupported':'insecure'};return state;}
 try{const p=await navigator.permissions?.query({name:'microphone'});if(p?.state==='denied')state={blocked:true,why:'denied'};else if(state.why==='denied')state={blocked:false,why:''};
  p&&(p.onchange=()=>{state=p.state==='denied'?{blocked:true,why:'denied'}:{blocked:false,why:''};});}catch{}
 return state;
}
function downsample(chunks,from){
 const n=chunks.reduce((s,c)=>s+c.length,0),all=new Float32Array(n);let o=0;for(const c of chunks){all.set(c,o);o+=c.length;}
 const ratio=from/RATE,len=Math.floor(n/ratio),out=new Int16Array(len);
 for(let i=0;i<len;i++){const a=Math.floor(i*ratio),b=Math.min(n,Math.floor((i+1)*ratio));let s=0;for(let j=a;j<b;j++)s+=all[j];const v=s/Math.max(1,b-a);out[i]=Math.max(-32768,Math.min(32767,Math.round(v*32767)));}
 all.fill(0);return out;
}
// MUST be called synchronously from a tap handler. Resolves {pcm:Int16Array|null, speech:boolean} or rejects with
// an error whose name is NotAllowedError (blocked), NotFoundError (no microphone) or another media error.
export function listenOnce({onLevel=()=>{},onStart=()=>{}}={}){
 if(!micSupported())return Promise.reject(Object.assign(Error('no microphone here'),{name:'NotSupportedError'}));
 const media=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 const AC=globalThis.AudioContext||globalThis.webkitAudioContext,ctx=new AC();void ctx.resume?.();
 return media.then(stream=>new Promise(resolve=>{
  state={blocked:false,why:''};onStart();
  const src=ctx.createMediaStreamSource(stream),node=ctx.createScriptProcessor(2048,1,1),sink=ctx.createGain();sink.gain.value=0;
  const rate=ctx.sampleRate,chunks=[],pre=[];let floor=0.004,heard=false,quietFor=0,elapsed=0,finished=false;
  const finish=()=>{if(finished)return;finished=true;try{node.disconnect();src.disconnect();}catch{}stream.getTracks().forEach(t=>t.stop());void ctx.close?.();
   const pcm=heard?downsample(chunks,rate):null;chunks.length=0;pre.length=0;resolve({pcm,speech:heard});};
  node.onaudioprocess=e=>{const x=e.inputBuffer.getChannelData(0),ms=x.length/rate*1000;elapsed+=ms;
   let s=0;for(let i=0;i<x.length;i++)s+=x[i]*x[i];const rms=Math.sqrt(s/x.length);onLevel(Math.min(1,rms*12));
   if(!heard){floor=elapsed<250?Math.max(floor,rms):floor*0.98+rms*0.02;}
   const loud=rms>Math.max(0.012,floor*2.8);
   const copy=new Float32Array(x);
   if(!heard){pre.push(copy);while(pre.length*ms>PREROLL_MS)pre.shift();if(loud){heard=true;chunks.push(...pre);pre.length=0;}else if(elapsed>NO_SPEECH_MS)return finish();return;}
   chunks.push(copy);quietFor=loud?0:quietFor+ms;
   if(quietFor>=SILENCE_MS||elapsed>MAX_MS)finish();};
  src.connect(node);node.connect(sink);sink.connect(ctx.destination);
  setTimeout(finish,MAX_MS+NO_SPEECH_MS);
 }),e=>{void ctx.close?.();if(e?.name==='NotAllowedError'||e?.name==='SecurityError')state={blocked:true,why:'denied'};else if(e?.name==='NotFoundError')state={blocked:true,why:'no-mic'};throw e;});
}
// Ask this machine's recogniser whether he said what the page expects. Returns {match, how, heard?}.
export async function recognise({player,target,kind,attempt,preview,pcm}){
 const q=new URLSearchParams({player,target:JSON.stringify(target),kind,attempt:String(attempt)});if(preview)q.set('preview','1');
 const r=await fetch('/api/listen?'+q,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength)});
 pcm.fill(0);
 if(!r.ok)throw Object.assign(Error('recogniser unavailable'),{status:r.status});
 return r.json();
}
export async function listenAvailable(){try{const r=await fetch('/api/listen/status');const j=await r.json();if(j.available&&!j.running)void fetch('/api/listen/warm',{method:'POST'}).catch(()=>{});return !!j.available;}catch{return false;}}
