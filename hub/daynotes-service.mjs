// Day notes in the hub: the grown-ups' page (/daynotes, phone-friendly, reached from Grown-ups) and its API.
// A grown-up tells the Book about a child's day; that night's chapter weaves it in (book/daynotes.mjs).
// Store: the household's private book directory (never a release, never a repository). The live and staging
// sites both write the household's one store (a note is about the real day, whichever address the phone used);
// a preview or an unmanaged install keeps its own, next to its book.
//   GET  /api/daynotes                      {today, children, notes (the last few days), expireDays}
//   POST /api/daynotes {child,text,from,memory}   add      POST /api/daynotes {remove:id}   delete
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {addNote,removeNote,listNotes,EXPIRE_DAYS,FROM} from '../book/daynotes.mjs';
import {localDate,addDays} from '../book/paths.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function dayNotesStore({env=process.env,deployDir=null,channel='',bookDir}){
 if(env.FAMILY_DAYNOTES)return env.FAMILY_DAYNOTES;
 if(deployDir&&['live','staging'].includes(channel))return join(deployDir,'..','book','daynotes');
 return join(bookDir,'daynotes');}
const PAGE={'/daynotes':['daynotes.html','text/html; charset=utf-8'],'/daynotes.mjs':['daynotes.mjs','text/javascript'],'/daynotes.css':['daynotes.css','text/css']};
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
export function dayNotesService({dir,config,timeZone,log=()=>{},now=()=>Date.now()}){
 const kids=config.players.filter(p=>p.id!=='admin'),children=kids.map(p=>p.id);
 async function view(){const today=localDate(now(),timeZone);
  const notes=(await listNotes(dir,{from:addDays(today,-EXPIRE_DAYS),to:today})).map(n=>({id:n.id,date:n.date,at:n.at,child:n.child,text:n.text,from:n.from,memory:!!n.memory,used:Object.fromEntries(Object.entries(n.used||{}).map(([p,u])=>[p,String(u.chapter||'').split('/')[1]||''])),...(n.soft?Object.values(n.soft).some(x=>x?.seed)?{gentle:true}:{left:true}:{})})).reverse();
  return {today,children:kids.map(p=>({id:p.id,name:p.name})),notes,expireDays:EXPIRE_DAYS};}
 async function handle(req,res,u){
  if(PAGE[u.pathname]){if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only.'});
   const [file,type]=PAGE[u.pathname],bytes=await readFile(join(here,'public',file));
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(req.method==='HEAD'?undefined:bytes);return;}
  if(u.pathname!=='/api/daynotes')return false;
  if(req.method==='GET')return send(res,200,await view());
  if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>8192)return send(res,413,{error:'Too much data.'});}
  let input;try{input=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
  if(input?.remove){const ok=await removeNote(dir,input.remove);await log({type:'daynote_remove',ok});return send(res,ok?200:404,ok?await view():{error:'That note is already gone.'});}
  const from=FROM.includes(input?.from)?input.from:'dad';
  try{const n=await addNote(dir,{child:input?.child,text:input?.text,from,memory:!!input?.memory,now:now(),timeZone,children});
   // (the diagnostics log never holds the note itself)
   await log({type:'daynote_add',player:n.child,from:n.from,memory:!!n.memory,length:n.text.length});}
  catch(e){return send(res,400,{error:e.message});}
  return send(res,200,await view());}
 return {handle,dir};
}
