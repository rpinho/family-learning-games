// The Book in the hub: serves each child's chapter for today, keeps his reading progress, takes the
// grown-ups' one-line "Today..." notes (the next chapter's plot) and feeds the bedtime page.
// Chapters and narration are generated nightly (../book/generate.mjs) into bookDir and only read here.
// Progress and notes are the hub's own saves: data/book-progress/<player>.json, data/book-notes.json.
import {readFile,writeFile,rename,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
export const localDate=(ms=Date.now(),timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export const AUTO_OPENS=3; // a book never keeps a child out of his games: it stops opening itself after 3 unfinished opens
const readJSON=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return fallback;throw e;}};
async function writeJSON(file,value){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file);}
export function cleanNote(text){return String(text||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);}
// Which child a note is about: the one whose first name it mentions, otherwise both.
export function noteTarget(text,players){const hits=players.filter(p=>p.name&&new RegExp(`\\b${p.name.replace(/[^\p{L}]/gu,'')}\\b`,'iu').test(text));return hits.length===1?hits[0].id:null;}
export function progressView(day){return {opens:day?.opens||0,page:day?.page||0,finished:!!day?.finished,results:day?.results||[]};}
export function shouldOpen(chapter,day){return !!chapter&&!day?.finished&&(day?.opens||0)<AUTO_OPENS;}
export function bookService({data,bookDir,players,config,log=()=>{},timeZone,now=()=>Date.now(),summaries=null}){
 const kids=config.players.filter(p=>p.id!=='admin');
 const progressDir=join(data,'book-progress'),notesFile=join(data,'book-notes.json');
 let queue=Promise.resolve();
 const serial=fn=>(queue=queue.catch(()=>{}).then(fn));
 const today=()=>localDate(now(),timeZone);
 async function chapter(player,date){if(!DATE.test(date))return null;const c=await readJSON(join(bookDir,player,date+'.json'),null);return c&&c.player===player&&Array.isArray(c.pages)?c:null;}
 async function progress(player){return readJSON(join(progressDir,player+'.json'),{days:{}});}
 async function notes(){const n=await readJSON(notesFile,{notes:[]});return Array.isArray(n.notes)?n.notes:[];}
 async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Object.assign(Error('Too much data.'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
 async function update(player,input){
  return serial(async()=>{
   const p=await progress(player),date=today();
   if(input.date!==date)throw Object.assign(Error('That chapter is not today’s.'),{status:409});
   const day=p.days[date]??={opens:0,page:0,finished:false,results:[],startedAt:new Date(now()).toISOString()};
   const page=Math.max(0,Math.min(60,Number(input.page)||0));
   if(input.type==='open')day.opens++;
   else if(input.type==='page')day.page=Math.max(day.page,page);
   else if(input.type==='result'){const r=input.result||{};day.results=[...day.results.filter(x=>x.page!==page),{page,kind:String(r.kind||'').slice(0,20),misses:Math.max(0,Math.min(99,Number(r.misses)||0)),ms:Math.max(0,Math.min(36e5,Number(r.ms)||0)),hints:Math.max(0,Math.min(9,Number(r.hints)||0))}].slice(-20);}
   else if(input.type==='finish'){day.finished=true;day.finishedAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else if(input.type==='leave'){day.leftAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else throw Object.assign(Error('Unsupported action.'),{status:400});
   const keep=Object.keys(p.days).sort().slice(-30);p.days=Object.fromEntries(keep.map(k=>[k,p.days[k]]));
   await mkdir(progressDir,{recursive:true,mode:0o700});await writeJSON(join(progressDir,player+'.json'),p);
   await log({type:'book',player,action:input.type,date,page,finished:day.finished});
   return progressView(day);
  });
 }
 async function bedtime(date){
  const n=(await notes()).filter(x=>x.date===date);
  const out=[];
  for(const k of kids){
   const ch=await chapter(k.id,date),p=await progress(k.id);
   let did=[];try{did=summaries?await summaries(k.id,date):[];}catch{}
   out.push({player:k.id,name:k.name,chapter:ch,progress:progressView(p.days[date]),did,notes:n.filter(x=>!x.player||x.player===k.id).map(x=>x.text)});
  }
  return {date,kids:out};
 }
 return {
  async handle(req,res,u){
   if(u.pathname==='/api/book'){
    const player=u.searchParams.get('player');
    if(!kids.some(k=>k.id===player)){if(player==='admin'||players.includes(player))return send(res,200,{date:today(),chapter:null,progress:progressView(null),open:false});return send(res,400,{error:'Choose a player.'});}
    if(req.method==='GET'){const date=today(),ch=await chapter(player,date),p=await progress(player),day=p.days[date];return send(res,200,{date,chapter:ch,progress:progressView(day),open:shouldOpen(ch,day)});}
    if(req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
     try{return send(res,200,{progress:await update(player,await body(req))});}catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save.'});}}
    return send(res,405,{error:'Unsupported action.'});
   }
   if(u.pathname==='/api/book/notes'){
    if(req.method==='GET'){const since=localDate(now()-6*864e5,timeZone);return send(res,200,{today:today(),notes:(await notes()).filter(n=>n.date>=since)});}
    if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
    try{const input=await body(req);
     const result=await serial(async()=>{const all=await notes();
      if(input.remove){const next=all.filter(n=>n.id!==String(input.remove));await writeJSON(notesFile,{notes:next});return next;}
      const text=cleanNote(input.text);if(!text)throw Object.assign(Error('Write a short line.'),{status:400});
      const at=new Date(now()).toISOString(),note={id:at.replace(/\D/g,'').slice(0,17)+Math.random().toString(36).slice(2,6),date:today(),at,text,player:noteTarget(text,kids)};
      const next=[...all,note].slice(-200);await mkdir(data,{recursive:true});await writeJSON(notesFile,{notes:next});await log({type:'book_note',player:note.player||'both',length:text.length});return next;});
     const since=localDate(now()-6*864e5,timeZone);return send(res,200,{today:today(),notes:result.filter(n=>n.date>=since)});}
    catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save.'});}
   }
   if(u.pathname==='/api/book/bedtime'&&req.method==='GET'){const d=u.searchParams.get('date');return send(res,200,await bedtime(DATE.test(d||'')?d:today()));}
   const clip=u.pathname.match(/^\/book-voice\/([a-f0-9]{16}\.wav)$/);
   if(clip&&req.method==='GET'){try{const bytes=await readFile(join(bookDir,'voice',clip[1]));res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':bytes.length,'Cache-Control':'max-age=31536000, immutable'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Use device narration.'});else throw e;}return;}
   const face=u.pathname.match(/^\/book-cast\/([a-z0-9-]{1,40}\.jpg)$/);
   if(face&&req.method==='GET'){try{const bytes=await readFile(join(bookDir,'cast',face[1]));res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'max-age=86400'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'No picture.'});else throw e;}return;}
   return false;
  },
  today,chapter,progress,notes
 };
}
// What a child did today, from the games' own read-only daily summaries (Number Park and Letter Quest)
// and the games he opened from the hub today.
export function gameSummaries({ports,hubLogs,timeZone,fetchImpl=fetch}){
 return async(player,date)=>{
  const lines=[];
  const get=async(port,path)=>{try{const r=await fetchImpl(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(3000)});return r.ok?await r.json():null;}catch{return null;}};
  const np=ports['number-park']&&await get(ports['number-park'],`/api/${player}/summary?date=${date}`);
  if(np?.played){const g=(np.games||[]).map(g=>`${g.title} ${g.correct}/${g.questions}`).join(', ');lines.push(`Number Park, about ${np.minutes} min${g?`: ${g}`:''}`);}
  const lq=ports['letter-quest']&&await get(ports['letter-quest'],`/api/${player}/summary?date=${date}`);
  if(lq?.played){const m=lq.labyrinth||{},l=lq.lessons||{};lines.push(`Letter Quest, about ${lq.minutes} min${m.gatesAnswered?`: labyrinth ${m.gatesCorrect}/${m.gatesAnswered}`:''}${l.attempts?`, lessons ${l.correct}/${l.attempts}`:''}`);}
  if(hubLogs){const opened={};
   const [y,m,dd]=date.split('-').map(Number),next=new Date(Date.UTC(y,m-1,dd+1)).toISOString().slice(0,10);
   for(const d of [date,next]){let text='';try{text=await readFile(join(hubLogs,d+'.jsonl'),'utf8');}catch{}
    for(const line of text.split('\n')){if(!line.includes('"open_game"'))continue;let r;try{r=JSON.parse(line);}catch{continue;}if(r.player===player&&r.kind==='open_game'&&localDate(Date.parse(r.at),timeZone)===date){const k=String(r.detail||'').split('/')[0];opened[k]=(opened[k]||0)+1;}}}
   const names={'maze-garden':'Maze Garden','number-park':'Number Park','letter-quest':'Letter Quest','word-arcade':'Word Arcade','target-trail':'Target Trail','sling':'Sling Shot','three-in-a-row':'Three in a Row','chess':'Chess','soccer':'Soccer','drawing-studio':'Drawing studio'};
   const list=Object.entries(opened).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${names[k]||k}${n>1?` ×${n}`:''}`);
   if(list.length)lines.push('Opened: '+list.join(', '));}
  return lines;
 };
}
