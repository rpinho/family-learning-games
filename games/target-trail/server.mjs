import http from 'node:http';
import {readFile,writeFile,rename,mkdir,appendFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {homedir,hostname,networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';
import {action,freshProfile,publicState,PLAYERS,VERSION} from './engine.mjs';
import {literacyFrom,DEFAULT_TRACK} from './dist/word-break.mjs';
const root=fileURLToPath(new URL('./dist/',import.meta.url)),data=process.env.TARGET_DATA||join(homedir(),'.local/share/family-learning-games/target-trail'),port=Number(process.env.PORT||4324);
const letterData=process.env.LETTER_QUEST_DATA||join(homedir(),'.local/share/family-learning-games/letter-quest');
// Read-only look at Letter Quest progress so word breaks and sling letters match each child.
const literacy=async id=>{let save=null;try{save=JSON.parse(await readFile(join(letterData,id+'.json'),'utf8'));}catch{}return literacyFrom(save,DEFAULT_TRACK[id]||'mixed');};
await mkdir(join(data,'logs'),{recursive:true,mode:0o700});let queue=Promise.resolve(),logError=null;
const log=async row=>{try{await appendFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,...row})+'\n',{mode:0o600});logError=null;}catch(e){logError=e.code;console.error('Log failed',e.code);}};
const hosts=new Set(['localhost','127.0.0.1','localhost','localhost',hostname().toLowerCase(),...Object.values(networkInterfaces()).flat().filter(Boolean).map(v=>v.address)]);
const load=async id=>{try{return JSON.parse(await readFile(join(data,id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return freshProfile(id);throw e;}};
const reply=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
const files={'/':'index.html','/sling':'sling.html','/sling-app.mjs':'sling-app.mjs','/word-break.mjs':'word-break.mjs','/sling.svg':'sling.svg','/app.mjs':'app.mjs','/style.css':'style.css','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.wav':'audio/wav'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 let u;try{u=new URL(req.url,'http://'+req.headers.host);if(!hosts.has(u.hostname.toLowerCase())||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return reply(res,403,{error:'Use the home-network address.'});}catch{return reply(res,400,{error:'Invalid address.'});}
 try{
  if(u.pathname==='/health')return reply(res,200,{ok:true,version:VERSION,diagnostics:{ok:!logError,error:logError}});
  if(['/api/state','/api/action','/api/events','/api/word-break'].includes(u.pathname)){
   const player=u.searchParams.get('player');if(!Object.hasOwn(PLAYERS,player))return reply(res,400,{error:'Choose a player.'});
   if(u.pathname==='/api/word-break'){if(req.method!=='GET')return reply(res,405,{error:'Read only.'});return reply(res,200,await literacy(player));}
   if(req.method==='GET'&&u.pathname==='/api/state'){queue=queue.catch(()=>{}).then(async()=>{try{reply(res,200,publicState(await load(player)));}catch{reply(res,500,{error:'Could not load. Try Refresh.'});}});return;}
   if(req.method!=='POST'||u.pathname==='/api/state')return reply(res,405,{error:'Unsupported method.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'JSON required.'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return reply(res,413,{error:'Too much data.'});}let input;try{input=JSON.parse(raw);}catch{return reply(res,400,{error:'Invalid JSON.'});}
   if(u.pathname==='/api/events'){await log({type:'client',player,kind:String(input?.kind||'').slice(0,60),detail:String(input?.detail||'').slice(0,300)});return reply(res,200,{ok:true});}
   if(input&&typeof input==='object'){delete input.literacy;if(input.type==='sling-start')input.literacy=await literacy(player);}
   queue=queue.catch(()=>{}).then(async()=>{try{const p=await load(player),before=p.revision;action(p,input);if(before!==p.revision){const file=join(data,player+'.json');await writeFile(file+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file+'.tmp',file);}await log({type:'action',player,input:{...input,literacy:undefined},revision:p.revision,level:p.level,round:String(input.type).startsWith('sling')?p.sling?.round:p.round});reply(res,200,publicState(p));}catch(e){await log({type:'rejected',player,input,error:e.message});reply(res,e.status||500,{error:e.status?e.message:'Could not save. Tap Refresh.'});}});return;
  }
  if(!['GET','HEAD'].includes(req.method))return reply(res,405,{error:'Read only.'});
  let file;if(u.pathname==='/'&&u.searchParams.get('mode')==='sling')file=join(root,'sling.html');else if(['/engine.mjs','/challenges.mjs','/sling.mjs'].includes(u.pathname))file=fileURLToPath(new URL('.'+u.pathname,import.meta.url));else if(/^\/voice\/(manifest\.json|[a-f0-9]{16}\.wav)$/.test(u.pathname))file=join(data,u.pathname.slice(1));else if(files[u.pathname])file=join(root,files[u.pathname]);else return reply(res,404,{error:'Not found.'});
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){await log({type:'error',path:u.pathname,error:e.code||e.message});reply(res,e.code==='ENOENT'?404:500,{error:'Could not load. Tap Refresh.'});}
});
server.requestTimeout=10000;server.headersTimeout=10000;server.on('clientError',(_,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Target Trail: http://localhost:${server.address().port}`));
