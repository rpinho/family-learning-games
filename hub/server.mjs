import http from 'node:http';
import {readFile,writeFile,rename,appendFile,mkdir} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostname,networkInterfaces} from 'node:os';
import {fresh,act,VERSION} from './dribble.mjs';
import {actLive} from './live-state.mjs';
import {proxy} from './proxy.mjs';
import {chessService} from './chess-service.mjs';
import {cachedMenuOrderService} from './menu-cache.mjs';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'..'),data=process.env.FAMILY_DATA||join(root,'.data','hub');
const ids=['letter-quest','word-arcade','number-park','maze-garden','three-in-a-row','target-trail'];
const base=Number(process.env.BASE_PORT||4811);
const defaults={players:[{id:'beginner',name:'Beginner',level:1,chess:{band:'steps',strength:'friendly'}},{id:'explorer',name:'Explorer',level:3,chess:{band:'stretch',strength:'club'}},{id:'admin',name:'Admin',level:1}],games:Object.fromEntries(ids.map((id,i)=>[id,base+i])),hosts:[]};
const config=process.env.FAMILY_CONFIG?JSON.parse(await readFile(process.env.FAMILY_CONFIG,'utf8')):defaults;
if(!config.players?.length||config.players.some(p=>!/^\w{1,24}$/.test(p.id)||typeof p.name!=='string')||ids.some(id=>!Number.isInteger(config.games[id])||config.games[id]<1024||config.games[id]>65535))throw Error('Invalid local hub configuration');
const players=config.players.map(p=>p.id),hosts=new Set(['localhost','127.0.0.1',hostname().toLowerCase(),...Object.values(networkInterfaces()).flat().filter(Boolean).map(x=>x.address),...(config.hosts||[])]);
await mkdir(join(data,'logs'),{recursive:true,mode:0o700});let queue=Promise.resolve(),logError=null;
async function log(row){try{await appendFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,hubVersion:HUB_VERSION,...row})+'\n',{mode:0o600});logError=null;}catch(e){logError=e.code;console.error('Diagnostics unavailable',e.code);}}
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
async function load(player){try{return JSON.parse(await readFile(join(data,player+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return fresh(player,config.players.find(x=>x.id===player).level||1);throw e;}}
const icons={'letter-quest':'games/letter-quest/public/icons/app-192-v2.png','word-arcade':'games/word-arcade/public/icons/app-192-v1.png','number-park':'games/number-park/public/icons/number-park-192.png','maze-garden':'games/maze-garden/public/icon-192.png','three-in-a-row':'games/three-in-a-row/dist/icon-192.png','target-trail':'games/target-trail/dist/icon-192.png'};
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const files=['chess/request.mjs','menu-cache.mjs','chess/tokens.mjs','chess/steps-curriculum.mjs','chess/foundations-curriculum.mjs','chess/sequel-curriculum.mjs','chess/teaching.mjs','chess/audio.mjs','menu-options.mjs','soccer-logo.svg','chess/path.mjs','chess/narration.mjs','chess/pieces.mjs','chess/academy-world.png','catalog.mjs','letter-book.svg','chess/rook.mjs','chess/app.mjs','chess/style.css','chess/art.mjs','chess/board.mjs','chess/rules.mjs','chess/curriculum.mjs','chess/icon.svg','chess/CHESS-JS-LICENSE.txt','index.html','hub.mjs','style.css','embedded.css','bridge.mjs','dribble-ui.mjs','dribble-classic.mjs','soccer-mode.mjs','dribble-live.mjs','dribble-live-v1.mjs','dribble-live-v2.mjs','reading-reward.mjs','live-pitch.mjs','pitch.mjs','save-request.mjs','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest'];
const HUB_VERSION='family-games-2026-09-19-quiet-tasks';
const menu=cachedMenuOrderService({players,onError:detail=>void log({type:'menu_refresh_error',detail}),sources:{...Object.fromEntries(ids.map(id=>[id,join(config.gameData?.[id]||join(data,'..',id),'logs')])),hub:join(data,'logs')}});
const chess=chessService({data,players,log,settingsFor:Object.fromEntries(config.players.map(p=>[p.id,p.chess||{}]))});
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
 try{
  const u=new URL(req.url,'http://'+req.headers.host);
  if(!hosts.has(u.hostname.toLowerCase())||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Use the local games address.'});
  const match=u.pathname.match(/^\/g\/([a-z-]+)\/(\w+)\/(.*)$/);
  if(match){const [,game,player,path]=match;if(!ids.includes(game)||!players.includes(player))return send(res,404,{error:'Unknown game or player.'});return proxy(req,res,{game,player,players,port:config.games[game],prefix:`/g/${game}/${player}/`,path:'/'+path+u.search},log);}
  // Some SSR runtimes construct import paths at runtime from "/" + asset name.
  // Keep their router separators intact and scope those requests using the
  // same-origin embedding document/module, never a caller-selected upstream.
  if(req.method==='GET'&&/^\/(?:assets|_next)\//.test(u.pathname)&&req.headers.referer){
   const ref=new URL(req.headers.referer),from=ref.pathname.match(/^\/g\/([a-z-]+)\/(\w+)\//);
   if(ref.origin===u.origin&&from&&ids.includes(from[1])&&players.includes(from[2])){res.writeHead(307,{Location:`/g/${from[1]}/${from[2]}${u.pathname}${u.search}`});res.end();return;}
  }
  if(u.pathname==='/api/chess')return await chess.handle(req,res,u);
  if(u.pathname==='/health')return send(res,200,{ok:true,version:HUB_VERSION,physicsVersion:VERSION,diagnostics:{ok:!logError,error:logError}});
  if(/^\/(?:voice|chess-voice)\/(manifest\.json|[a-f0-9]{16}\.wav)$/.test(u.pathname)&&req.method==='GET'){try{const bytes=await readFile(join(data,u.pathname.slice(1)));res.writeHead(200,{'Content-Type':u.pathname.endsWith('.wav')?'audio/wav':'application/json'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Use device narration.'});else throw e;}return;}
  if(u.pathname==='/api/config'&&req.method==='GET')return send(res,200,{players:config.players,version:HUB_VERSION});
  if(u.pathname.startsWith('/api/')){
   const player=u.searchParams.get('player');if(!players.includes(player))return send(res,400,{error:'Choose a player.'});
   if(u.pathname==='/api/menu'&&req.method==='GET'){const {order,ready}=menu.ranking(player);return send(res,200,{order,ready});}
   if(u.pathname==='/api/dribble'&&req.method==='GET'){await queue.catch(()=>{});return send(res,200,{profile:await load(player),version:VERSION});}
   if(req.method!=='POST'||!['/api/dribble','/api/events'].includes(u.pathname))return send(res,405,{error:'Unsupported action.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
   let raw='';for await(const part of req){raw+=part;if(raw.length>8192)return send(res,413,{error:'Too much data.'});}let input;try{input=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
   if(u.pathname==='/api/events'){await log({type:'client',player,kind:String(input.kind||'').slice(0,60),detail:String(input.detail||'').slice(0,300)});return send(res,200,{ok:true});}
   queue=queue.catch(()=>{}).then(async()=>{try{const p=await load(player),live=String(input.type).startsWith('live-'),before=live?{id:p.live?.round?.id,level:p.live?.level,inputs:p.live?.round?.inputs?.length}:structuredClone(p.round),result=live?actLive(p,input,config.players.find(x=>x.id===player).level||1):act(p,input),file=join(data,player+'.json');await writeFile(file+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file+'.tmp',file);await log({type:live?'dribble-live':'dribble',player,input,before,result,level:live?p.live.level:p.level,goals:p.goals,dribbles:live?p.live.wins:p.dribbles});send(res,200,{profile:p,result,version:VERSION});}catch(e){await log({type:'rejected',player,error:e.message});send(res,e.status||500,{error:e.status?e.message:'Could not save. Please Refresh.',code:e.code==='CLIENT_UPDATE'?'CLIENT_UPDATE':undefined});}});return;
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only.'});
  let file;const preview=u.pathname.match(/^\/previews\/([a-z-]+)\.jpg$/);const icon=u.pathname.match(/^\/game-icons\/([a-z-]+)\.png$/);
  if(preview&&['letter-quest','word-arcade','number-park','maze-garden','chess','three-in-a-row','target-trail','dribble-duel','maze-letters','maze-rescue','soccer-classic','soccer-penalties'].includes(preview[1]))file=join(here,'public','previews',preview[1]+'.jpg');else if(icon&&icons[icon[1]])file=join(root,icons[icon[1]]);else if(u.pathname==='/dribble.mjs')file=join(here,'dribble.mjs');else{const name=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!files.includes(name))return send(res,404,{error:'Not found.'});file=join(here,'public',name);}
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){await log({type:'error',detail:e.message});send(res,e.code==='ENOENT'?404:500,{error:'Could not load. Try Refresh.'});}
});
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
 if(stopping)return;stopping=true;menu.close();
 // A tablet can retain a connection after the listener closes. Drain saved actions
 // before exiting, and bound idle/streaming socket shutdown during local updates.
 const timer=setTimeout(()=>server.closeAllConnections(),2000);timer.unref();
 server.close(async()=>{clearTimeout(timer);await Promise.allSettled([chess.close(),queue]);process.exit(0);});
 server.closeIdleConnections();
});
server.requestTimeout=20000;server.headersTimeout=20000;server.listen(Number(process.env.PORT||base-1),process.env.HOST||'127.0.0.1',()=>console.log(`Family Learning Games: http://localhost:${server.address().port}`));
