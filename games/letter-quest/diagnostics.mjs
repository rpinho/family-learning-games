import {mkdir,appendFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {BUILD} from './public/version.mjs';

export function createDiagnostics(data){
 const directory=path.join(data,'logs'),run=randomUUID();
 let queue=Promise.resolve(),failure=null,writes=0,day='',part=0,size=0;
 async function record(type,fields={}){
  const entry={...fields,type,at:new Date().toISOString(),schema:1,build:BUILD,run};
  const line=JSON.stringify(entry)+'\n';
  const work=queue.then(async()=>{
   await mkdir(directory,{recursive:true,mode:0o700});
   const today=entry.at.slice(0,10);
   if(day!==today){day=today;part=0;size=0;}
   let file;
   for(;;){
    file=path.join(directory,`${day}-${String(part).padStart(3,'0')}.jsonl`);
    try{size=(await stat(file)).size;}catch(e){if(e.code!=='ENOENT')throw e;size=0;}
    if(size+Buffer.byteLength(line)<=20*1024*1024)break;
    part++;
   }
   await appendFile(file,line,{mode:0o600});writes++;failure=null;
   return true;
  }).catch(e=>{failure=e.code||'WRITE_FAILED';console.error('Diagnostics write failed:',failure);return false;});
  queue=work;return work;
 }
 return {record,status:()=>({ok:failure===null,error:failure,writes}),flush:()=>queue};
}

const EVENTS=new Set(['session_start','challenge_shown','action','trace_start','trace_blocked','trace_stroke','trace_cancel','trace_reset','attempt_submit','feedback','api_error','runtime_error','resource_error','voice_error','voice_play','voice_skip','visibility','connection','heartbeat','logging_gap']);
for(const event of ['guided_trace_start','guided_trace_progress','guided_trace_pause','word_break'])EVENTS.add(event);
const STRINGS=new Set(['eventId','session','player','build','kind','challengeId','task','char','action','reason','pointerType','message','stack','source','voice','clip','address','visibility','platform','agent','requestId','answer']);
const NUMBERS=new Set(['clientTime','elapsedMs','durationMs','level','width','height','dpr','touchPoints','strokeCount','points','status','line','column','dropped','pending','code']);
const BOOLEANS=new Set(['demo','busy','feedback','drawing','helped','showModel','ok','online','retry']);
for(const field of ['completed','cursor','misses'])NUMBERS.add(field);
for(const field of ['guided','done'])BOOLEANS.add(field);
function text(value,max=300){return String(value).replace(/https?:\/\/[^\s)]+/g,url=>url.split(/[?#]/)[0]).replace(/[\u0000-\u001f]/g,' ').slice(0,max);}
export const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(value)?value:undefined;
export function cleanEvent(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!EVENTS.has(input.kind)||!identifier(input.eventId)||!identifier(input.session)||!['explorer','beginner','demo','admin'].includes(input.player))throw Error('Invalid diagnostic event');
 if(JSON.stringify(input).length>24000)throw Error('Diagnostic event too large');
 const out={};
 for(const [key,value] of Object.entries(input)){
  if(STRINGS.has(key)&&typeof value==='string')out[key]=text(value,key==='stack'?1800:key==='message'?500:300);
  else if(NUMBERS.has(key)&&Number.isFinite(value))out[key]=value;
  else if(BOOLEANS.has(key)&&typeof value==='boolean')out[key]=value;
  else if(key==='stroke'&&Array.isArray(value)&&value.length<=702&&value.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=-10&&n<=110)))out.stroke=value;
 }
 return out;
}
