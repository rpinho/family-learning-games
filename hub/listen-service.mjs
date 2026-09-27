// Listening in the hub: a child's short utterance (a word he reads, a letter sound, a friend's name) is recognised
// ON THIS MACHINE by a local model and matched, child-tolerantly, against what the page expects.
// Privacy: the audio arrives in memory, goes to the recogniser process over a pipe, and is dropped after the
// answer. Nothing is written to disk; the log keeps only the match result (kind, matched, how, time), never audio
// and never the transcript. Only the grown-ups' preview gets the transcript back, to try it out.
// Settings: FAMILY_LISTEN_PYTHON (a Python with faster-whisper) and FAMILY_LISTEN_MODEL (default "small"), or a
// private listen.json next to the deployment ({python, model, threads}). Without them, listening is off and the
// book keeps its tap-only play.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide,promptFor,rankFor} from './listen/match.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export const MAX_SECONDS=6,MAX_BYTES=16000*2*MAX_SECONDS,IDLE_EXIT_MS=15*60000,DECODE_TIMEOUT_MS=10000;
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
export function listenSettings({env=process.env,deployDir=null}={}){
 let file={};if(deployDir){try{file=JSON.parse(readFileSync(join(deployDir,'..','listen.json'),'utf8'));}catch{}}
 const python=env.FAMILY_LISTEN_PYTHON||file.python||'';
 return python?{python:python.replace(/^~(?=\/)/,env.HOME||''),model:env.FAMILY_LISTEN_MODEL||file.model||'small',threads:Number(env.FAMILY_LISTEN_THREADS||file.threads||4)}:null;
}
// What the page may ask for: a word or short phrase, or a letter (with friends' names that start with it).
export function cleanTarget(raw){
 let t;try{t=typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}
 if(!t||typeof t!=='object')return null;const word=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z' -]{0,23}$/.test(s.trim());
 if(t.kind==='word'&&word(t.word))return {kind:'word',word:t.word.trim(),also:(Array.isArray(t.also)?t.also:[]).filter(word).slice(0,4)};
 if(t.kind==='letter'&&/^[A-Za-z]$/.test(t.letter||''))return {kind:'letter',letter:t.letter.toUpperCase(),names:(Array.isArray(t.names)?t.names:[]).filter(word).slice(0,4)};
 return null;
}
// One recogniser process, started on first use (or a warm-up call when the book opens) and stopped when idle.
export function recogniser(settings,{spawnFn=spawn,log=()=>{}}={}){
 let proc=null,ready=null,buf='',pending=new Map(),seq=0,idle=null;
 function stop(){if(proc){try{proc.kill();}catch{}}proc=null;ready=null;for(const [,p] of pending)p.reject(Error('recogniser stopped'));pending.clear();}
 function start(){
  if(ready)return ready;
  proc=spawnFn(settings.python,[join(here,'listen','worker.py'),'--model',settings.model,'--threads',String(settings.threads)],{stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',PYTHONUNBUFFERED:'1'}});
  const me=proc;let err='';
  ready=new Promise((ok,no)=>{
   me.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);let m;try{m=JSON.parse(line);}catch{continue;}
    if(m.ready){ok(m);continue;}const p=pending.get(m.id);if(p){pending.delete(m.id);p.resolve(m);}}});
   me.stderr.on('data',d=>{err=(err+d).slice(-2000);});
   me.on('exit',code=>{if(proc===me){proc=null;ready=null;}no(Error('recogniser exited '+code+': '+err.slice(-300)));for(const [,p] of pending)p.reject(Error('recogniser exited'));pending.clear();});
   me.on('error',e=>no(e));
  });
  ready.catch(e=>{log({type:'listen_error',detail:String(e.message).slice(0,300)});});
  return ready;
 }
 function keepAlive(){clearTimeout(idle);idle=setTimeout(stop,IDLE_EXIT_MS);idle.unref?.();}
 async function transcribe(pcm,prompt,rank){
  keepAlive();await start();const id=++seq;
  return await new Promise((resolve,reject)=>{const t=setTimeout(()=>{pending.delete(id);reject(Error('recogniser timed out'));},DECODE_TIMEOUT_MS);
   pending.set(id,{resolve:v=>{clearTimeout(t);resolve(v);},reject:e=>{clearTimeout(t);reject(e);}});
   proc.stdin.write(JSON.stringify({id,pcm:pcm.toString('base64'),prompt,...(rank?{rank}:{})})+'\n');});
 }
 return {warm:()=>{keepAlive();return start().then(()=>true,()=>false);},transcribe,stop,get running(){return !!proc;}};
}
export function listenService({settings,players,log=()=>{},recog=settings?recogniser(settings,{log}):null}){
 let queue=Promise.resolve();
 async function body(req){const parts=[];let n=0;for await(const c of req){n+=c.length;if(n>MAX_BYTES)throw Object.assign(Error('Too long.'),{status:413});parts.push(c);}return Buffer.concat(parts);}
 async function handle(req,res,u){
  if(u.pathname==='/api/listen/status'&&req.method==='GET')return send(res,200,{available:!!recog,running:!!recog?.running});
  if(u.pathname==='/api/listen/warm'&&req.method==='POST'){if(!recog)return send(res,200,{available:false});void recog.warm();return send(res,200,{available:true});}
  if(u.pathname!=='/api/listen'||req.method!=='POST')return false;
  const player=u.searchParams.get('player')||'';if(!players.includes(player))return send(res,404,{error:'Unknown player.'});
  if(!recog)return send(res,503,{error:'Listening is off on this machine.',available:false});
  const target=cleanTarget(u.searchParams.get('target'));if(!target)return send(res,400,{error:'Unknown target.'});
  const preview=u.searchParams.get('preview')==='1',attempt=Math.min(9,Number(u.searchParams.get('attempt'))||1),kind=String(u.searchParams.get('kind')||'').slice(0,24);
  let pcm=await body(req);if(pcm.length<3200||pcm.length%2)return send(res,400,{error:'Too short.'});
  const t0=Date.now();
  // One utterance at a time; each waits for the one before (children take turns anyway).
  const run=queue.catch(()=>{}).then(()=>recog.transcribe(pcm,promptFor(target),rankFor(target)));queue=run;
  let r;try{r=await run;}catch(e){pcm=null;log({type:'listen',player,kind,target:target.kind,error:String(e.message).slice(0,120)});return send(res,503,{error:'Could not listen right now.'});}
  pcm=null;
  const m=decide(r,target);
  const ms=Date.now()-t0;
  // The log keeps the result only: never the audio, never what he said.
  if(!preview)log({type:'listen',player,kind,target:target.kind,match:m.match,how:m.how,attempt,ms,decodeMs:r.ms});
  return send(res,200,{match:m.match,how:m.how,ms,decodeMs:r.ms,...(preview?{heard:m.heard}:{})});
 }
 return {handle,available:!!recog};
}
