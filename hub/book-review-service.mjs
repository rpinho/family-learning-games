// Adult review UI + bounded same-origin controls. The adult question is a child gate, not authentication.
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {bookPaths,localDate,addDays} from '../book/paths.mjs';
import {slot,readJSON,requestChanges,reviewEvent} from '../book/review.mjs';
import {pathOptions} from './public/book-adventure.mjs';
import {notify} from '../book/notify.mjs';
import {publishOne} from '../book/publish.mjs';
import {parentChallenge,parentAnswerMatches} from './public/menu-options.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const send=(res,status,j)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(j));};
export function reviewPractises(ch){
 if(!ch)return [];
 const out=[];for(const f of ch.meta?.learnerFocus||[]){const [kind,value]=f.item.split(':');
  const text=kind==='letter'?`Letter ${value.toUpperCase()} and its sound`:kind==='vowel'?`Short ${value.toUpperCase()} words`:kind==='table'?`Multiplication by ${value}`:kind==='word'?`Reading “${value}”`:null;if(text)out.push(text);}
 for(const p of ch.pages||[]){const b=p.beat;if(!b)continue;const text={'teach-letter':`Letter ${b.letter} and its sound`,'kick-letter':`Recognising ${b.letter}`,'count':`Counting to ${b.answer||10}`,'order':'Putting numbers in order','signs':'Reading short words','spell':'Reading a sentence','fork':'Making a choice','no':'Checking a claim','captures':'Chess captures',puzzle:ch.level==='early'?'Careful observation':/chess/.test(ch.meta?.scenario||'')?'Chess captures and piece values':'Mental maths'}[b.kind];if(text)out.push(text);}
 return [...new Set(out)].slice(0,8);
}
export function bookReviewService({bookDir,config,timeZone,env=process.env,now=()=>Date.now(),redo=null,sendNotice=notify}){
 const kids=config.players.filter(p=>p.id!=='admin'),sessions=new Map(),challenges=new Map(),jobs=new Map(),paths={...bookPaths(env),book:bookDir,voice:join(bookDir,'voice')};
 const reviewDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=tomorrow()&&date<=addDays(tomorrow(),6);
 const tomorrow=()=>addDays(localDate(now(),timeZone),1);
 const authorized=req=>{const token=(req.headers.cookie||'').match(/(?:^|;\s*)book_review=([\w-]+)/)?.[1];return (sessions.get(token)||0)>now();};
 const cleanup=()=>{for(const m of [sessions,challenges])for(const [k,v] of m)if((v.expires||v)<now())m.delete(k);};
 const worker=redo||((player,date)=>new Promise((resolve,reject)=>{
  const cmd=join(here,'..','scripts','bin','book-worker'),child=spawn(cmd,['--review','--force','--date',date,'--player',player],{env:{...env,FAMILY_BOOK:bookDir},cwd:here,stdio:['ignore','pipe','pipe']});let tail='';
  child.stdout.on('data',b=>tail=(tail+b).slice(-1500));child.stderr.on('data',b=>tail=(tail+b).slice(-1500));const timer=setTimeout(()=>child.kill('SIGTERM'),2700e3);
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Draft regeneration failed. The previous draft is kept.'));});
 }));
 async function view(date){const drafts=[];for(const k of kids){const base=slot(bookDir,k.id,date,true),ch=await readJSON(base+'.json')||await readJSON(base+'.receipt.json'),notes=await readJSON(base+'.review.json');
  drafts.push({player:k.id,name:k.name,title:ch?.title||'',summary:ch?.meta?.summary||ch?.summary||'',practises:reviewPractises(ch),episode:ch?.episode?{goal:ch.episode.goal,rooms:ch.episode.rooms.map(r=>r.name),checks:ch.episode.checks}:null,adventure:ch?.meta?.graph?{kit:ch.meta.kit,paths:pathOptions(ch).map(p=>({...p,pages:p.pages.map(i=>({number:i+1,node:ch.pages[i].node,place:ch.pages[i].place,kind:ch.pages[i].beat?.kind||'story'}))}))}:null,state:ch?.meta?.review?.state||'missing',revision:ch?.meta?.review?.revision||null,notes:notes?.notes||[],job:jobs.get(k.id+date)||null});}
  return {date,drafts};}
 async function handle(req,res,u){cleanup();
  const pages={'/book-review':['book-review.html','text/html'],'/book-review.mjs':['book-review.mjs','text/javascript'],'/book-review.css':['book-review.css','text/css']};
  if(pages[u.pathname]){if(req.method!=='GET')return send(res,405,{error:'Read only.'});const [file,type]=pages[u.pathname],bytes=await readFile(join(here,'public',file));res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(bytes);return;}
  if(!u.pathname.startsWith('/api/book/review'))return false;
  if(u.pathname==='/api/book/review/gate'&&req.method==='GET'){if(authorized(req))return send(res,200,{unlocked:true});if(challenges.size>100)return send(res,429,{error:'Try again shortly.'});const id=randomUUID(),gate=parentChallenge();challenges.set(id,{gate,expires:now()+300e3});return send(res,200,{id,question:gate.question,code:gate.code});}
  if(req.method==='GET'){if(!authorized(req))return send(res,403,{error:'Open the grown-ups gate.'});const date=u.searchParams.get('date')||tomorrow();if(!reviewDate(date))return send(res,400,{error:'Choose a draft in the next week.'});return send(res,200,await view(date));}
  if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});let raw='';for await(const part of req){raw+=part;if(raw.length>8192)return send(res,413,{error:'Too much data.'});}let b;try{b=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
  if(u.pathname==='/api/book/review/gate'){const c=challenges.get(b.id);challenges.delete(b.id);if(!c||!parentAnswerMatches(c.gate,b.answer))return send(res,403,{error:'Read the instruction and try again.'});const token=randomUUID();sessions.set(token,now()+12*36e5);res.setHeader('Set-Cookie',`book_review=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${u.protocol==='https:'||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);return send(res,200,{unlocked:true});}
  if(!authorized(req))return send(res,403,{error:'Open the grown-ups gate.'});
  if(!kids.some(k=>k.id===b.player)||!reviewDate(b.date)||!b.revision)return send(res,400,{error:'Choose a current review draft.'});
  try{
   if(b.action==='approve')await publishOne(b.player,{paths,date:b.date,approve:true,revision:b.revision});
   else if(b.action==='changes')await requestChanges({book:bookDir,...b,by:'grown-up'});
   else if(b.action==='redo'){
    const base=slot(bookDir,b.player,b.date,true),ch=await readJSON(base+'.json');if(!ch||ch.meta?.review?.revision!==b.revision||['approved','auto'].includes(ch.meta?.review?.state))throw Object.assign(Error('Reload the current unpublished draft.'),{status:409});
    const key=b.player+b.date;if(jobs.get(key)?.state==='running')throw Object.assign(Error('Already regenerating.'),{status:409});
    if(b.note?.trim())await requestChanges({book:bookDir,...b,by:'grown-up'});
    jobs.set(key,{state:'running'});void worker(b.player,b.date).then(async()=>{jobs.set(key,{state:'ready'});await reviewEvent(bookDir,{action:'redo-ready',player:b.player,date:b.date});
     if(env.FAMILY_CHANNEL==='live'){try{const chapters=[];for(const kid of kids){const f=slot(bookDir,kid.id,b.date,true),c=await readJSON(f+'.json')||await readJSON(f+'.receipt.json');if(c)chapters.push(c);}await sendNotice({paths,date:b.date,kind:'draft',chapters,env});}catch{jobs.set(key,{state:'ready',noticeError:'Your new draft is ready. The email could not be sent; review it here.'});}}
    },async()=>{jobs.set(key,{state:'failed',error:'Could not regenerate. Your previous draft is kept.'});await reviewEvent(bookDir,{action:'redo-failed',player:b.player,date:b.date});}).catch(()=>{const job=jobs.get(key);jobs.set(key,job?.state==='ready'?{...job,noticeError:'Your new draft is ready; check it here.'}:{state:'failed',error:'Could not regenerate. Your previous draft is kept.'});});
   }else return send(res,400,{error:'Unknown action.'});
   return send(res,200,await view(b.date));
  }catch(e){return send(res,e.status||400,{error:e.message});}
 }
 return {handle,authorized,view};
}
