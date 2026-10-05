import {readFile} from 'node:fs/promises';
import {onboardingStore} from './onboarding-store.mjs';
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
export function onboardingService({paths,authorized,onSave}){
 const store=onboardingStore({paths,onSave});
 return {store,async handle(req,res,u){
  const pages={'/onboarding':['onboarding.html','text/html'],'/onboarding.mjs':['onboarding.mjs','text/javascript'],'/onboarding.css':['onboarding.css','text/css']};
  if(pages[u.pathname]&&req.method==='GET'){const [name,type]=pages[u.pathname];res.writeHead(200,{'Content-Type':type+'; charset=utf-8','X-Robots-Tag':'noindex'});res.end(await readFile(new URL('./public/'+name,import.meta.url)));return;}
  if(u.pathname!=='/api/onboarding')return false;
  if(!authorized(req))return send(res,403,{error:'Open the grown-ups gate.'});
  try{
   if(req.method==='GET')return send(res,200,await store.read());
   if(req.method!=='POST')return send(res,405,{error:'Use GET or POST.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'Use JSON.'});
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>9e6)return send(res,413,{error:'Choose smaller photos.'});chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(res,400,{error:'Invalid JSON.'});}
   return send(res,200,await store.save(body));
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save. Your private data directory must be writable.'});}
 }};
}
