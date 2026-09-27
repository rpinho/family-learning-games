// The Book in the hub: serves each child's chapter for today (and a read-only preview for grown-ups),
// keeps his progress and what he has collected in the book (letter keys, words he read), serves the
// picture library and narration, and takes the grown-ups' one-line "Today..." notes (the next chapter's plot).
// Chapters and narration are generated nightly (../book/generate.mjs) into bookDir and only read here.
// Progress and notes are the hub's own saves: data/book-progress/<player>.json, data/book-notes.json.
import {readFile,writeFile,rename,mkdir,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const publicArt=join(dirname(fileURLToPath(import.meta.url)),'public','book-art');
const ART_TYPES={webp:'image/webp',png:'image/png',svg:'image/svg+xml',jpg:'image/jpeg'};
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
export const localDate=(ms=Date.now(),timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const DATE=/^\d{4}-\d{2}-\d{2}$/;
// Only chapters in the picture-book format are served (an older chapter is treated as missing).
export const CHAPTER_SCHEMA='family-book-chapter-2';
export const AUTO_OPENS=3;
// Real-world hunts (find things that start with a sound, find a letter or word written at home): up to this many a day.
export const HUNTS_PER_DAY=3; // a book never keeps a child out of his games: it stops opening itself after 3 unfinished opens
const readJSON=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return fallback;throw e;}};
async function writeJSON(file,value){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file);}
export function cleanNote(text){return String(text||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);}
// Which child a note is about: the one whose first name it mentions, otherwise both.
export function noteTarget(text,players){const hits=players.filter(p=>p.name&&new RegExp(`\\b${p.name.replace(/[^\p{L}]/gu,'')}\\b`,'iu').test(text));return hits.length===1?hits[0].id:null;}
export function progressView(day){return {opens:day?.opens||0,page:day?.page||0,finished:!!day?.finished,results:day?.results||[]};}
export function shouldOpen(chapter,day){return !!chapter&&!day?.finished&&(day?.opens||0)<AUTO_OPENS;}
export function bookService({data,bookDir,players,config,log=()=>{},timeZone,now=()=>Date.now()}){
 const kids=config.players.filter(p=>p.id!=='admin');
 const progressDir=join(data,'book-progress'),notesFile=join(data,'book-notes.json');
 let queue=Promise.resolve();
 const serial=fn=>(queue=queue.catch(()=>{}).then(fn));
 const today=()=>localDate(now(),timeZone);
 async function chapter(player,date){if(!DATE.test(date))return null;const c=await readJSON(join(bookDir,player,date+'.json'),null);return c&&c.player===player&&c.schema===CHAPTER_SCHEMA&&Array.isArray(c.pages)?c:null;}
 async function progress(player){return readJSON(join(progressDir,player+'.json'),{days:{}});}
 async function notes(){const n=await readJSON(notesFile,{notes:[]});return Array.isArray(n.notes)?n.notes:[];}
 async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Object.assign(Error('Too much data.'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
 // What he keeps from the book: letter keys (A-Z) and words he read himself (magic words).
 function collect(p,earned){if(!earned||typeof earned!=='object')return;const c=p.collection??={keys:[],words:[]};
  const k=String(earned.key||'');if(/^[A-Z]$/.test(k)&&!c.keys.includes(k))c.keys.push(k);
  const w=String(earned.word||'').toLowerCase();if(/^[a-z]{1,12}$/.test(w)&&!c.words.includes(w))c.words=[...c.words,w].slice(-300);}
 const collectionOf=p=>({keys:p.collection?.keys||[],words:p.collection?.words||[],...(p.collection?.hunts?.length?{hunts:p.collection.hunts}:{})});
 // Grown-ups' preview: the newest chapter up to tomorrow (or a given date), read-only.
 async function latest(player,date){if(date)return DATE.test(date)?{date,chapter:await chapter(player,date)}:{date,chapter:null};
  const limit=localDate(now()+864e5,timeZone);let files=[];try{files=(await readdir(join(bookDir,player))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<=limit).sort();}catch{}
  for(const f of files.reverse()){const c=await chapter(player,f.slice(0,10));if(c)return {date:f.slice(0,10),chapter:c};}return {date:today(),chapter:null};}
 async function update(player,input){
  return serial(async()=>{
   const p=await progress(player),date=today();
   if(input.date!==date)throw Object.assign(Error('That chapter is not today’s.'),{status:409});
   const day=p.days[date]??={opens:0,page:0,finished:false,results:[],startedAt:new Date(now()).toISOString()};
   const page=Math.max(0,Math.min(60,Number(input.page)||0));
   if(input.type==='open')day.opens++;
   else if(input.type==='page')day.page=Math.max(day.page,page);
   else if(input.type==='result'){const r=input.result||{};collect(p,r.earned);day.results=[...day.results.filter(x=>x.page!==page),{page,kind:String(r.kind||'').slice(0,20),misses:Math.max(0,Math.min(99,Number(r.misses)||0)),ms:Math.max(0,Math.min(36e5,Number(r.ms)||0)),hints:Math.max(0,Math.min(9,Number(r.hints)||0))}].slice(-20);}
   else if(input.type==='finish'){day.finished=true;day.finishedAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else if(input.type==='hunt'){
    // A hunt away from the screen: started (counts toward today's limit) and found (with how many, if a grown-up said).
    const id=String(input.id||'').slice(0,24),hs=day.hunts??=[];let h=hs.find(x=>x.id===id&&!x.foundAt);
    if(input.stage==='start'){if(!h){if(hs.length>=HUNTS_PER_DAY)throw Object.assign(Error('That is enough hunting for today.'),{status:429});hs.push(h={id,startedAt:new Date(now()).toISOString()});}}
    // Only a grown-up-confirmed count of at least one completes a hunt (zero: keep looking, it stays open).
    else if(input.stage==='found'&&h&&input.confirmed===true&&Number(input.found)>=1){h.foundAt=new Date(now()).toISOString();h.found=Math.max(0,Math.min(20,Number(input.found)||0));h.ms=Date.parse(h.foundAt)-Date.parse(h.startedAt);
     const c=p.collection??={keys:[],words:[]};c.hunts=[...new Set([...(c.hunts||[]),id])].slice(-100);}
   }
   else if(input.type==='leave'){day.leftAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else throw Object.assign(Error('Unsupported action.'),{status:400});
   const keep=Object.keys(p.days).sort().slice(-30);p.days=Object.fromEntries(keep.map(k=>[k,p.days[k]]));
   await mkdir(progressDir,{recursive:true,mode:0o700});await writeJSON(join(progressDir,player+'.json'),p);
   await log({type:'book',player,action:input.type,date,page,finished:day.finished,...(input.type==='hunt'?{hunt:String(input.id||'').slice(0,24),stage:input.stage,found:Number(input.found)||0}:{})});
   return progressView(day);
  });
 }
 return {
  async handle(req,res,u){
   if(u.pathname==='/api/book'){
    const player=u.searchParams.get('player');
    if(!kids.some(k=>k.id===player)){if(player==='admin'||players.includes(player))return send(res,200,{date:today(),chapter:null,progress:progressView(null),open:false});return send(res,400,{error:'Choose a player.'});}
    if(req.method==='GET'){const date=today(),ch=await chapter(player,date),p=await progress(player),day=p.days[date];return send(res,200,{date,chapter:ch,progress:progressView(day),collection:collectionOf(p),open:shouldOpen(ch,day)});}
    if(req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
     try{return send(res,200,{progress:await update(player,await body(req))});}catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save.'});}}
    return send(res,405,{error:'Unsupported action.'});
   }
   // Today's next hunt for a child (from the household's private hunts.json), and how many are left today.
   if(u.pathname==='/api/book/hunt'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const cfg=(await readJSON(join(bookDir,'hunts.json'),{players:{}})).players?.[player];if(!cfg?.hunts?.length)return send(res,200,{available:false});
    const date=today(),p=await progress(player),day=p.days[date]||{},started=(day.hunts||[]).length,done=new Set(p.collection?.hunts||[]);
    const open=(day.hunts||[]).find(h=>!h.foundAt),hunt=cfg.hunts.find(h=>h.id===open?.id)||cfg.hunts.find(h=>!done.has(h.id))||cfg.hunts[started%cfg.hunts.length];
    return send(res,200,{available:true,date,left:Math.max(0,HUNTS_PER_DAY-started)+(open?1:0),hunt,friend:cfg.friend||null,label:cfg.label||'Hunt',tomorrow:cfg.tomorrow||null,cheer:cfg.cheer||null});
   }
   if(u.pathname==='/api/book/preview'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const {date,chapter:ch}=await latest(player,u.searchParams.get('date'));const p=await progress(player);
    return send(res,200,{date,chapter:ch,progress:progressView(null),collection:collectionOf(p),open:!!ch,preview:true});
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
   const clip=u.pathname.match(/^\/book-voice\/([a-f0-9]{16}\.wav)$/);
   if(clip&&req.method==='GET'){try{const bytes=await readFile(join(bookDir,'voice',clip[1]));res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':bytes.length,'Cache-Control':'max-age=31536000, immutable'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Use device narration.'});else throw e;}return;}
   // Pictures: the household's own library (private, next to the chapters), else the generic one.
   const pic=u.pathname.match(/^\/book-art\/((?:bg|actors|props)\/[a-z0-9-]{1,60}\.(webp|png|svg|jpg))$/);
   if(pic&&req.method==='GET'){for(const dir of [join(bookDir,'art','lib'),publicArt]){try{const bytes=await readFile(join(dir,pic[1]));res.writeHead(200,{'Content-Type':ART_TYPES[pic[2]],'Content-Length':bytes.length,'Cache-Control':'max-age=300'});res.end(bytes);return;}catch(e){if(e.code!=='ENOENT')throw e;}}
    send(res,404,{error:'No picture.'});return;}
   return false;
  },
  today,chapter,progress,notes
 };
}
