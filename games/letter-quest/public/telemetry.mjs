import {BUILD} from './version.mjs';
const KEY='letter-quest-diagnostic-outbox-v1',MAX=200,MAX_BYTES=900000;
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
// Best-effort bounded outbox. Never delay scoring or recursively log its own failures.
export function createTelemetry(context,env=globalThis){
 let queue=[],sending=false,dropped=0,storageOK=true;
 const session=uid();
 try{const saved=JSON.parse(env.localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))queue=saved.filter(e=>e&&typeof e.eventId==='string').slice(-MAX);}catch{storageOK=false;}
 function persist(){try{env.localStorage.setItem(KEY,JSON.stringify(queue));storageOK=true;}catch{storageOK=false;}}
 function record(kind,detail={}){
  try{
   queue.push({...context(),...detail,kind,eventId:uid(),session,build:BUILD,clientTime:Date.now()});
   while(queue.length>MAX||JSON.stringify(queue).length>MAX_BYTES){queue.shift();dropped++;}
   persist();
  }catch{/* Diagnostics must never freeze a lesson. */}
 }
 async function flush(){
  if(sending||!queue.length)return;
  sending=true;
  try{
   if(dropped){const count=dropped;dropped=0;record('logging_gap',{dropped:count,reason:'bounded_offline_queue'});}
   const batch=[];let bytes=0;
   for(const event of queue){const n=JSON.stringify(event).length;if(batch.length&&(bytes+n>50000||batch.length>=25))break;batch.push(event);bytes+=n;}
   const res=await env.fetch('/api/diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true,signal:env.AbortSignal?.timeout?.(10000)});
   if(res.ok){const sent=new Set(batch.map(e=>e.eventId));queue=queue.filter(e=>!sent.has(e.eventId));persist();}
  }catch{/* Retain pending events and retry after connectivity returns. */}finally{sending=false;}
 }
 const interval=env.setInterval(()=>void flush(),4000);
 env.addEventListener?.('online',()=>{record('connection',{online:true});void flush();});
 env.addEventListener?.('offline',()=>record('connection',{online:false}));
 env.addEventListener?.('pagehide',()=>void flush());
 env.document?.addEventListener('visibilitychange',()=>{record('visibility',{visibility:env.document.visibilityState});void flush();});
 env.addEventListener?.('error',e=>{
  if(e.message)record('runtime_error',{message:e.message,stack:e.error?.stack||'',source:e.filename||'',line:e.lineno,column:e.colno});
  else record('resource_error',{source:e.target?.src||e.target?.href||'',reason:'load_failed'});
 },true);
 env.addEventListener?.('unhandledrejection',e=>record('runtime_error',{message:String(e.reason?.message||e.reason),stack:e.reason?.stack||''}));
 return {session,record,flush,status:()=>({pending:queue.length,dropped,storageOK}),stop:()=>env.clearInterval(interval)};
}
