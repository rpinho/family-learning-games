import http from 'node:http';
import {readFile,writeFile,rename,mkdir,appendFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {homedir,hostname,networkInterfaces} from 'node:os';
import {freshProfile,action,publicState,prepareProfile,VERSION} from './lib/math.mjs';
import {recognizeArt} from './lib/symbol-recognition.mjs';
const doodleModel=JSON.parse(await readFile(new URL('./data/doodle-model.json',import.meta.url),'utf8'));
const symbolModel=JSON.parse(await readFile(new URL('./data/symbol-model.json',import.meta.url),'utf8'));
const data=process.env.NUMBER_PARK_DATA||join(homedir(),'.local/share/family-learning-games/number-park');
const root=resolve(process.env.NUMBER_PARK_STATIC||'dist/client'),port=Number(process.env.PORT||4321);
await mkdir(join(data,'logs'),{recursive:true,mode:0o700});
let queue=Promise.resolve(),logError=null;
const log=async row=>{try{await appendFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,...row})+'\n',{mode:0o600});logError=null;}catch(e){logError=e.code;console.error('Log failed',e.code);}};
const load=async id=>{try{return prepareProfile(JSON.parse(await readFile(join(data,id+'.json'),'utf8')));}catch(e){if(e.code==='ENOENT')return freshProfile(id);throw e;}};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const hosts=new Set(['localhost','127.0.0.1','localhost',hostname().toLowerCase(),...Object.values(networkInterfaces()).flat().filter(Boolean).map(i=>i.address)]);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.rsc':'text/x-component','.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.wav':'audio/wav','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 const began=Date.now();let url;
 const diagnostic={clientId:String(req.headers['x-game-client']||'legacy').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,96),requestId:String(req.headers['x-game-request']||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,112)};
 try{url=new URL(req.url,'http://'+req.headers.host);if(!hosts.has(url.hostname.toLowerCase())||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Use the home-network address.'});}catch{return send(res,400,{error:'Invalid address.'});}
 res.on('finish',()=>{if(res.statusCode>=400)void log({type:'request_error',...diagnostic,path:url.pathname.slice(0,120),status:res.statusCode,ms:Date.now()-began});});
 res.on('close',()=>{if(!res.writableFinished&&url.pathname.startsWith('/api/'))void log({type:'response_interrupted',...diagnostic,path:url.pathname.slice(0,120),ms:Date.now()-began});});
 try{
  if(url.pathname==='/health')return send(res,200,{ok:true,version:VERSION,diagnostics:{ok:!logError,error:logError}});
  const route=url.pathname.match(/^\/api\/(beginner|explorer|admin)(?:\/(action|events))?$/);
  if(route){
   const [,id,op]=route;
   if(req.method==='GET'&&!op){
    queue=queue.catch(()=>{}).then(async()=>{try{const p=await load(id);await log({type:'sync_read',...diagnostic,player:id,revision:p.revision});send(res,200,publicState(p));}catch(e){send(res,500,{error:'Could not load your game.'});}});return;
   }
   if(req.method!=='POST'||!op)return send(res,405,{error:'Unsupported method.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>150000)return send(res,413,{error:'Too much data.'});}
   let input;try{input=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
   if(!input||typeof input!=='object'||Array.isArray(input))return send(res,400,{error:'Invalid action.'});
   if(op==='events'){if(!['open','voice','error','trace_pause','trace_done','group','pattern','cookie','place','sync','drawing','reading','planning'].includes(input.kind))return send(res,400,{error:'Invalid event.'});await log({type:'client',...diagnostic,player:id,kind:input.kind,name:String(input.name||'').slice(0,160),detail:String(input.detail||'').slice(0,500)});return send(res,200,{ok:true});}
   queue=queue.catch(()=>{}).then(async()=>{
    let currentRevision;
    try{const p=await load(id),before=structuredClone(p.session),planningBefore=input.kind?.startsWith('plan_')?structuredClone(p.planning||null):undefined;currentRevision=p.revision;action(p,input,Date.now(),{recognize:(ink,mode)=>recognizeArt(ink,doodleModel,symbolModel,mode)});const file=join(data,id+'.json');await writeFile(file+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file+'.tmp',file);await log({type:'action',...diagnostic,player:id,input,before,after:p.session,...(input.kind?.startsWith('plan_')?{planningBefore,planning:p.planning}:{}),...(input.kind?.startsWith('art_')?{art:p.art.history.at(-1)}:{}),...(input.kind?.startsWith('reading_')?{reading:{level:p.reading.level,round:p.reading.session.round,finished:p.reading.session.finished,stars:p.reading.stars,question:p.reading.session.questions[p.reading.session.round]}}:{}),revision:p.revision});send(res,200,publicState(p));}
    catch(e){await log({type:'rejected',...diagnostic,player:id,kind:input.kind,submittedRevision:input.revision,currentRevision,questionId:String(input.questionId||'').slice(0,120),error:e.message});send(res,e.status||500,{error:e.status?e.message:'Could not save. Keep this page open and retry.'});}
   });return;
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only.'});
  let file;
  if(url.pathname.startsWith('/voice/')){const name=url.pathname.slice(7);if(name!=='manifest.json'&&!/^[a-f0-9]{16}\.wav$/.test(name))return send(res,404,{error:'Not found.'});file=join(data,'voice',name);}
  else{
   const name=decodeURIComponent(url.pathname);if(name.includes('..')||!/^\/[a-zA-Z0-9_./-]*$/.test(name))return send(res,404,{error:'Not found.'});
   file=resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))return send(res,404,{error:'Not found.'});
  }
  const info=await stat(file);if(!info.isFile())return send(res,404,{error:'Not found.'});
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});
  if(req.method==='HEAD')res.end();else{const stream=createReadStream(file);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}
 }catch(e){if(e.code==='ENOENT')return send(res,404,{error:'Not found.'});await log({type:'error',error:e.message});send(res,500,{error:'Could not load. Please try again.'});}
});
server.on('clientError',(e,s)=>{void log({type:'protocol_error',error:e.code});s.end('HTTP/1.1 400 Bad Request\r\n\r\n');});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Number Park: http://localhost:${port} | ${data} | ${root}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit()));
