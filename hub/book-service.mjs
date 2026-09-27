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
export const AUTO_OPENS=3; // a book never keeps a child out of his games: it stops opening itself after 3 unfinished opens
const readJSON=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return fallback;throw e;}};
async function writeJSON(file,value){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file);}
export function cleanNote(text){return String(text||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);}
// Which child a note is about: the one whose first name it mentions, otherwise both.
export function noteTarget(text,players){const hits=players.filter(p=>p.name&&new RegExp(`\\b${p.name.replace(/[^\p{L}]/gu,'')}\\b`,'iu').test(text));return hits.length===1?hits[0].id:null;}
export function progressView(day){return {opens:day?.opens||0,page:day?.page||0,finished:!!day?.finished,results:day?.results||[]};}
export function shouldOpen(chapter,day){return !!chapter&&!day?.finished&&(day?.opens||0)<AUTO_OPENS;}
export function bookService({data,bookDir,players,config,log=()=>{},timeZone,now=()=>Date.now(),assets3d=null}){
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
 const collectionOf=p=>({keys:p.collection?.keys||[],words:p.collection?.words||[]});
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
   else if(input.type==='result'){const r=input.result||{};collect(p,r.earned);day.results=[...day.results.filter(x=>x.page!==page),{page,kind:String(r.kind||'').slice(0,20),misses:Math.max(0,Math.min(99,Number(r.misses)||0)),ms:Math.max(0,Math.min(36e5,Number(r.ms)||0)),hints:Math.max(0,Math.min(9,Number(r.hints)||0)),...(['voice','echo','tap'].includes(r.via)?{via:r.via}:{})}].slice(-20);}
   else if(input.type==='finish'){day.finished=true;day.finishedAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else if(input.type==='leave'){day.leftAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else throw Object.assign(Error('Unsupported action.'),{status:400});
   const keep=Object.keys(p.days).sort().slice(-30);p.days=Object.fromEntries(keep.map(k=>[k,p.days[k]]));
   await mkdir(progressDir,{recursive:true,mode:0o700});await writeJSON(join(progressDir,player+'.json'),p);
   await log({type:'book',player,action:input.type,date,page,finished:day.finished});
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
   if(u.pathname==='/api/book/preview'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const {date,chapter:ch}=await latest(player,u.searchParams.get('date'));const p=await progress(player);
    return send(res,200,{date,chapter:ch,progress:progressView(null),collection:collectionOf(p),open:!!ch,preview:true});
   }
   // The living book: the whole picture library (with URLs) and its narration clips (private manifest).
   if(u.pathname==='/api/book/library'&&req.method==='GET'){
    const lib=await readJSON(join(bookDir,'art','lib','library.json'),null)||await readJSON(join(publicArt,'library.json'),{backgrounds:{},actors:{},props:{}});
    const url=f=>'/book-art/'+f;const out={backgrounds:{},actors:{},props:{}};
    for(const [k,b] of Object.entries(lib.backgrounds||{}))out.backgrounds[k]={url:url(b.file),...(b.goal?{goal:b.goal}:{})};
    for(const [k,a] of Object.entries(lib.actors||{}))out.actors[k]={name:a.name||k,h:a.h||.4,poses:Object.fromEntries(Object.entries(a.poses||{}).map(([n,P])=>[n,{url:url(P.file),ar:P.ar||.6,...(P.fly?{fly:true}:{})}]))};
    for(const [k,P] of Object.entries(lib.props||{}))out.props[k]={url:url(P.file),h:P.h||.12,ar:P.ar||1};
    return send(res,200,out);
   }
   // One story from the household's private story file (words, voices, cast roles) with its narration clips.
   if(u.pathname==='/api/book/living'&&req.method==='GET'){const f=await readJSON(join(bookDir,'living','stories.json'),{stories:{},clips:{}});const id=String(u.searchParams.get('story')||'');
    const story=Object.hasOwn(f.stories||{},id)?f.stories[id]:null;if(!story)return send(res,404,{error:'No such story.'});
    const clips=Object.fromEntries(Object.values(story.lines||{}).map(([who,text])=>{const v=story.voices?.[who]||story.voices?.narrator||{};const k=`${v.voice}|${v.speed}|${text}`;return [k,f.clips?.[k]];}).filter(([,c])=>c));
    return send(res,200,{story,clips});}
   // The household's 3D toys (GLB models made privately in Blender) and the list of which exist.
   if(u.pathname.startsWith('/book-3d/')&&req.method==='GET'){
    if(!assets3d)return send(res,404,{error:'No 3D toys here.'});
    if(u.pathname==='/book-3d/index.json'){let files=[];try{files=(await readdir(assets3d)).filter(f=>/^[a-z0-9-]{1,40}\.glb$/.test(f)).map(f=>f.slice(0,-4));}catch{}return send(res,200,{toys:files});}
    const m=u.pathname.match(/^\/book-3d\/([a-z0-9-]{1,40}\.glb)$/);if(!m)return send(res,404,{error:'Not found.'});
    try{const bytes=await readFile(join(assets3d,m[1]));res.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':bytes.length,'Cache-Control':'max-age=300'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Not found.'});else throw e;}
    return;
   }
   // Word cards for Dad to print and hide (one page, big letters) when today's quest needs words on paper.
   if(u.pathname==='/api/book/cards'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const {chapter:ch}=await latest(player,u.searchParams.get('date'));const cards=(ch?.quest?.cards||[]).filter(w=>/^[a-z' -]{1,20}$/i.test(w)).slice(0,6);
    const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Word cards</title><style>@page{size:letter;margin:.4in}body{font-family:"Nunito","Trebuchet MS",system-ui,sans-serif;margin:0;color:#2b2118}.tip{font-size:14px;margin:0 0 .2in}.cards{display:grid;grid-template-columns:1fr;gap:.25in}.card{border:3px dashed #b99a6a;border-radius:18px;height:2.9in;display:grid;place-items:center;font-weight:900;font-size:1.6in;letter-spacing:.04em}@media print{.tip button{display:none}}</style></head><body><p class="tip">${cards.length?`${e(ch.name)}'s quest: cut out ${cards.length===1?'this card':'these cards'} and hide ${cards.length===1?'it':'them'} around the house. <button onclick="print()">Print</button>`:'Today\'s chapter needs no word cards.'}</p><div class="cards">${cards.map(w=>`<div class="card">${e(w)}</div>`).join('')}</div></body></html>`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
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
