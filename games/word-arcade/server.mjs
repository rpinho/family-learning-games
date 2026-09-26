import http from 'node:http';
import {readFile,writeFile,rename,mkdir,appendFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir,hostname,networkInterfaces} from 'node:os';
import {literacyFrom,DEFAULT_TRACK} from './lib/word-break.mjs';
import {fresh,act,VERSION} from './lib/engine.mjs';
import {AUDIO_FILES,audioRange} from './lib/audio-files.mjs';
const letterData=process.env.LETTER_QUEST_DATA||join(homedir(),'.local/share/family-learning-games/letter-quest');
// Read-only look at Letter Quest progress so word breaks match each child.
async function literacy(id){let save=null;try{save=JSON.parse(await readFile(join(letterData,id+'.json'),'utf8'));}catch{}return literacyFrom(save,DEFAULT_TRACK[id]||'mixed');}
const data=process.env.WORD_ARCADE_DATA||join(homedir(),'.local/share/family-learning-games/word-arcade'),port=Number(process.env.PORT||4319);
const staticRoot=fileURLToPath(new URL('./dist/client/',import.meta.url));
await mkdir(join(data,'logs'),{recursive:true,mode:0o700});await mkdir(join(data,'voice'),{recursive:true,mode:0o700});
let queue=Promise.resolve(),logError=null;
async function log(row){try{await appendFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,...row})+'\n',{mode:0o600});logError=null;}catch(e){logError=e.code;console.error('Log write failed',e.code);}}
async function profile(id){try{return JSON.parse(await readFile(join(data,id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return fresh(id);throw e;}}
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const hosts=new Set(['localhost','127.0.0.1',hostname().toLowerCase(),...Object.values(networkInterfaces()).flat().filter(Boolean).map(v=>v.address)]);
const server=http.createServer(async(req,res)=>{
 const started=Date.now();res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 let url;try{url=new URL(req.url,'http://'+req.headers.host);if(!hosts.has(url.hostname.toLowerCase()))return send(res,403,{error:'Home network address required'});if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Foreign origin rejected'});}catch{return send(res,400,{error:'Invalid address'});}
 res.on('finish',()=>{if(url.pathname.startsWith('/api'))void log({type:'request',path:url.pathname,status:res.statusCode,ms:Date.now()-started});});
 try{
  if(process.env.WORD_ARCADE_QA==='1'&&url.pathname==='/__qa'){const w=Math.max(320,Math.min(1500,Number(url.searchParams.get('w'))||1024)),h=Math.max(320,Math.min(1000,Number(url.searchParams.get('h'))||600));res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><title>Isolated arcade viewport</title><body style="margin:0;background:#ddd"><iframe title="Arcade ${w} by ${h}" src="/?player=admin" style="border:0;width:${w}px;height:${h}px"></iframe></body>`);return;}
  if(url.pathname==='/health')return send(res,200,{ok:true,version:VERSION,diagnostics:{ok:!logError,error:logError}});
  if(url.pathname.startsWith('/audio/')){
   if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only'});
   const name=url.pathname.slice(7);if(!AUDIO_FILES.has(name))return send(res,404,{error:'Not found'});
   const file=new URL('./public/audio/'+name,import.meta.url),{size}=await stat(file),range=audioRange(req.headers.range,size);
   if(!range){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
   const {start,end,partial}=range;
   res.writeHead(partial?206:200,{'Content-Type':name.endsWith('.mp3')?'audio/mpeg':name.endsWith('.wav')?'audio/wav':'text/plain; charset=utf-8','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':name.endsWith('.md')?'no-cache':'public, max-age=31536000, immutable',...(partial?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
   if(req.method==='HEAD')res.end();else{const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}return;
  }
  if(url.pathname==='/manifest.webmanifest'||url.pathname==='/favicon.ico'||/^\/icons\/(app-(16|32|48|180|192|512)-v1\.png|favicon-v1\.ico)$/.test(url.pathname)){
   if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only'});
   const name=url.pathname==='/favicon.ico'?'icons/favicon-v1.ico':url.pathname.slice(1),bytes=await readFile(new URL('./public/'+name,import.meta.url));
   res.writeHead(200,{'Content-Type':name.endsWith('.webmanifest')?'application/manifest+json':name.endsWith('.ico')?'image/x-icon':'image/png','Content-Length':bytes.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);return;
  }
  const breakMatch=url.pathname.match(/^\/api\/(explorer|beginner|admin)\/word-break$/);
  if(breakMatch){if(req.method!=='GET')return send(res,405,{error:'Read only'});return send(res,200,await literacy(breakMatch[1]));}
  if(url.pathname.startsWith('/voice/')){if(req.method!=='GET')return send(res,405,{error:'GET only'});const name=url.pathname.slice(7);if(name!=='manifest.json'&&!/^[a-f0-9]{16}\.wav$/.test(name))return send(res,404,{});const file=join(data,'voice',name);await stat(file);res.writeHead(200,{'Content-Type':name.endsWith('wav')?'audio/wav':'application/json','Cache-Control':name==='manifest.json'?'no-store':'public, max-age=31536000, immutable'});createReadStream(file).pipe(res);return;}
  const match=url.pathname.match(/^\/api\/(explorer|beginner|admin)(?:\/(action|events))?$/);
  if(match){const [,id,op]=match;if(req.method==='GET'&&!op)return send(res,200,{profile:await profile(id),version:VERSION});if(req.method!=='POST'||!op)return send(res,405,{error:'Unsupported method'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)return send(res,413,{error:'Request too large'});}let input;try{input=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON'});}
   if(op==='events'){const allowed=['open','button','error','voice','audio','visibility','pause','gameplay','word-break'];const events=Array.isArray(input.events)?input.events.slice(0,25):[];for(const e of events)if(allowed.includes(e.kind))await log({type:'client',player:id,event:{kind:e.kind,name:String(e.name||'').slice(0,150),game:String(e.game||'').slice(0,25),detail:String(e.detail||'').slice(0,300)}});return send(res,200,{ok:true});}
   queue=queue.catch(()=>{}).then(async()=>{const p=await profile(id);if(input.revision!==p.revision)return send(res,409,{error:'Your game changed in another tab. Refresh to continue.',profile:p});try{const before=structuredClone(p.session),beforeLowercase=structuredClone(p.lowercase||null),beforeFoundation=structuredClone(p.foundation||null),beforeBuilder=structuredClone(p.builder||null),beforeDrills=structuredClone(p.drills||null),beforeVariety=structuredClone(p.variety||null),result=act(p,input);const file=join(data,id+'.json');await writeFile(file+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file+'.tmp',file);const {kind,game,focus,level,mode,deck,questionId,answer,draft,pixels,durationMs,revision}=input;await log({type:'action',player:id,input:{kind,game,focus,level,mode,deck,questionId,answer,draft,pixels,durationMs,revision},before,result,after:p.session,...(p.lowercase?{lowercase:{before:beforeLowercase,after:p.lowercase}}:{}),...(p.foundation?{foundation:{before:beforeFoundation,after:p.foundation}}:{}),...(p.variety?{variety:{before:beforeVariety,after:p.variety}}:{}),...(p.drills?{drills:{before:beforeDrills,after:p.drills}}:{}),...(p.builder?{builder:{before:beforeBuilder,after:p.builder}}:{})});send(res,200,{profile:p,result});}catch(e){await log({type:'rejected',player:id,error:e.message});send(res,400,{error:e.message});}});return;
  }
  if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Unknown route'});
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only'});
  if(url.pathname!=='/'&&url.pathname!=='/og.png'&&!/^\/assets\/[a-zA-Z0-9_./-]+$/.test(url.pathname))return send(res,404,{error:'Not found'});
  const file=resolve(staticRoot,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(staticRoot))return send(res,404,{error:'Not found'});
  const body=await readFile(file);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){if(e.code==='ENOENT')return send(res,404,{error:'Not found'});await log({type:'error',error:e.message});send(res,500,{error:'Could not save or load. Please keep this page open and retry.'});}
});
server.on('clientError',(e,s)=>{void log({type:'protocol_error',error:e.code});s.end('HTTP/1.1 400 Bad Request\r\n\r\n');});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Word Arcade http://localhost:${port} | ${data}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit()));
