import http from 'node:http';
import {bookPaths,readProfiles} from '../book/paths.mjs';
import {onboardingService} from './onboarding-service.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rename,appendFile,mkdir} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostname,networkInterfaces} from 'node:os';
import {fresh,act,VERSION} from './dribble.mjs';
import {actLive} from './live-state.mjs';
import {proxy} from './proxy.mjs';
import {previewRoute,readRegistry,bannerHTML,cookieOf} from './preview-route.mjs';
import {chessService} from './chess-service.mjs';
import {cachedMenuOrderService} from './menu-cache.mjs';
import {bookService} from './book-service.mjs';
import {bookReviewService} from './book-review-service.mjs';
import {worldService} from './world-service.mjs';
import {dayNotesService,dayNotesStore} from './daynotes-service.mjs';
import {listenService,listenSettings} from './listen-service.mjs';
import {literacyFrom,DEFAULT_TRACK} from './public/word-break.mjs';
import {SHORTCUTS} from './public/home-shortcuts.mjs';
import {releasedShortcuts} from './shortcut-release.mjs';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'..'),data=process.env.FAMILY_DATA||join(root,'.data','hub');
const ids=['letter-quest','word-arcade','number-park','maze-garden','three-in-a-row','target-trail'];
const base=Number(process.env.BASE_PORT||4811);
const defaults={players:[{id:'beginner',name:'Beginner',level:1,world:'small',chess:{band:'steps',strength:'friendly',matchRating:250,bigHints:true}},{id:'explorer',name:'Explorer',level:3,world:'castle',chess:{band:'stretch',strength:'club',matchRating:600}},{id:'admin',name:'Admin',level:1}],games:Object.fromEntries(ids.map((id,i)=>[id,base+i])),hosts:[]};
const config=process.env.FAMILY_CONFIG?JSON.parse(await readFile(process.env.FAMILY_CONFIG,'utf8')):defaults;
if(!config.players?.length||config.players.some(p=>!/^\w{1,24}$/.test(p.id)||typeof p.name!=='string')||ids.some(id=>!Number.isInteger(config.games[id])||config.games[id]<1024||config.games[id]>65535))throw Error('Invalid local hub configuration');
// An immutable release overlay can hold reviewed household home choices without changing saves.
let homeShortcuts={};try{homeShortcuts=JSON.parse(await readFile(join(here,'home-shortcuts.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const deploymentRoot=process.env.FAMILY_DEPLOY_DIR?resolve(process.env.FAMILY_DEPLOY_DIR,'..'):null;
const staging=process.env.FAMILY_CHANNEL==='staging';
const profilePaths=bookPaths({...process.env,FAMILY_DATA:data,FAMILY_DEPLOY_ROOT:process.env.FAMILY_DEPLOY_ROOT||deploymentRoot||data,
 FAMILY_BOOK:process.env.FAMILY_BOOK||(deploymentRoot?join(deploymentRoot,...(staging?['staging-data','book']:['book'])):undefined),
 FAMILY_LEARNER:process.env.FAMILY_LEARNER||(deploymentRoot?join(deploymentRoot,...(staging?['staging-data','learner']:['learner'])):undefined)});
const basePlayers=structuredClone(config.players);
function applyProfiles(profiles){
 const children=Object.entries(profiles).filter(([id,p])=>/^(?:beginner|explorer)(?:_[1-9]\d{0,3})?$/.test(id)&&p?.onboarding).map(([id,p])=>({...basePlayers.find(x=>x.id===id)||basePlayers.find(x=>x.id===id.split('_')[0]),id,name:p.name,level:p.level==='reader'?3:1,world:p.level==='reader'?'castle':'small'}));
 config.players.splice(0,config.players.length,...basePlayers.filter(p=>!children.some(c=>c.id===p.id)&&(!children.length||!['beginner','explorer'].includes(p.id))),...children);
}
applyProfiles(readProfiles(profilePaths));
const players=config.players.map(p=>p.id);
// Only this machine's own names and addresses. The network interfaces are re-read every few seconds, so a new
// address (a new router, a VPN) works without a restart. FAMILY_EXTRA_HOSTS (comma or space separated) adds
// other names this machine answers to, such as a VPN DNS name.
const BASE_HOSTS=['localhost','127.0.0.1',...(config.hosts||[])];let hostCache=null,hostCacheAt=0;
function allowedHosts(){if(hostCache&&Date.now()-hostCacheAt<5000)return hostCache;const me=hostname().toLowerCase(),short=me.replace(/\.local$/,'');hostCacheAt=Date.now();return hostCache=new Set([...BASE_HOSTS.map(h=>String(h).toLowerCase()),me,short,short+'.local',...(process.env.FAMILY_EXTRA_HOSTS||'').split(/[\s,]+/).filter(Boolean).map(h=>h.toLowerCase()),...Object.values(networkInterfaces()).flat().filter(Boolean).map(i=>i.family==='IPv6'||i.family===6?'['+i.address.toLowerCase()+']':i.address)]);}
await mkdir(join(data,'logs'),{recursive:true,mode:0o700});let queue=Promise.resolve(),logError=null;
async function log(row){try{await appendFile(join(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,hubVersion:HUB_VERSION,...row})+'\n',{mode:0o600});logError=null;}catch(e){logError=e.code;console.error('Diagnostics unavailable',e.code);}}
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
async function load(player){try{return JSON.parse(await readFile(join(data,player+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return fresh(player,config.players.find(x=>x.id===player).level||1);throw e;}}
const icons={'letter-quest':'games/letter-quest/public/icons/app-192-v2.png','word-arcade':'games/word-arcade/public/icons/app-192-v1.png','number-park':'games/number-park/public/icons/number-park-192.png','maze-garden':'games/maze-garden/public/icon-192.png','three-in-a-row':'games/three-in-a-row/dist/icon-192.png','target-trail':'games/target-trail/dist/icon-192.png'};
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.m4a':'audio/mp4'};
// The living book (real-time scenes) and its vendored renderer: one flat folder each, safe names only.
const LIVING_FILE=/^(?:living|vendor\/three)\/[a-z0-9][a-z0-9._-]{0,60}\.(?:mjs|js|html|css|png|webp|jpg)$/;
const files=['world-approach.mjs','world-progress.mjs','world-scene-puzzles.mjs','reading-support.mjs','reading-support.css','word-families.mjs','world-intro.mjs','world-episode.mjs','world-definitions.mjs','audio-scope.mjs','world-icons.mjs','world-model.mjs','world.mjs','world.css','world.html','release-loader.mjs','pond/pond.mjs','pond/narration.mjs','pond/destination.svg','pond/index.html','pond/scene.mjs','pond/pond.css','pond/review.mjs','pond/sound.mjs','pond/model.mjs','pond/water.m4a','book-calm.css','calm-sound.mjs','calm/harp-c4.m4a','calm/harp-d4.m4a','calm/harp-e4.m4a','calm/harp-f4.m4a','calm/harp-g4.m4a','calm/harp-a4.m4a','calm/harp-b4.m4a','calm/reward-pop.m4a','calm/harp-c5.m4a','calm/harp-strum.m4a','calm/soft.m4a','hunt.mjs','repeats.mjs','hunt-icon.svg','my-book.svg','places.mjs','slalom-logo.svg','listen.mjs','chess/request.mjs','chess/match-voice.mjs','chess/feedback.mjs','home-shortcuts.mjs','home-pages.mjs','snack-friend.svg','balance-scale.svg','balance-scale-k.svg','pattern-parade.svg','trace-numbers.svg','take-away.svg','maze-maker.svg','maze-trace.svg','letter-labyrinth.svg','calm-home.css','menu-cache.mjs','chess/tokens.mjs','chess/steps-curriculum.mjs','chess/foundations-curriculum.mjs','chess/sequel-curriculum.mjs','chess/bridge-curriculum.mjs','chess/practice-curriculum.mjs','chess/teaching.mjs','chess/audio.mjs','menu-options.mjs','soccer-logo.svg','drawing-studio.svg','sling.svg','chess/path.mjs','chess/narration.mjs','chess/pieces.mjs','chess/academy-world.png','catalog.mjs','letter-book.svg','chess/rook.mjs','chess/app.mjs','chess/style.css','chess/art.mjs','chess/board.mjs','chess/rules.mjs','chess/curriculum.mjs','chess/icon.svg','chess/CHESS-JS-LICENSE.txt','index.html','hub.mjs','style.css','embedded.css','bridge.mjs','dribble-ui.mjs','dribble-classic.mjs','soccer-mode.mjs','dribble-live.mjs','dribble-live-v1.mjs','dribble-live-v2.mjs','reading-reward.mjs','live-pitch.mjs','pitch.mjs','save-request.mjs','book-adventure.mjs','book.mjs','book.css','book-scene.mjs','book-painted-layout.mjs','book-foreground.mjs','word-break.mjs','icon.svg','favicon.png','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','manifest.webmanifest','chess/banter.mjs'];

function playerManifest(base,p){const first=p.name.split(/\s/)[0],start='/?player='+encodeURIComponent(p.id);return {...base,id:start,start_url:start,name:`${base.name} · ${p.name}`,short_name:`${first}'s Games`};}
const HUB_VERSION='family-games-2026-09-27-friendly-coach';
// Optional managed deployment (see DEPLOY.md). A release directory carries .release.json;
// FAMILY_DEPLOY_DIR holds current.json (running game releases) and activity.json (last real play).
const deployDir=process.env.FAMILY_DEPLOY_DIR||null,channel=process.env.FAMILY_CHANNEL||'';
let HUB_RELEASE='';try{HUB_RELEASE=JSON.parse(readFileSync(join(root,'.release.json'),'utf8')).version||'';}catch{}
let currentCache={at:0,value:{}};
function currentReleases(){if(!deployDir)return {};if(Date.now()-currentCache.at<3000)return currentCache.value;let value={};try{value=JSON.parse(readFileSync(join(deployDir,'current.json'),'utf8'));}catch{}currentCache={at:Date.now(),value};return value;}
const activity={};let activityDirty=false;
function touch(key,at=Date.now()){if(!deployDir||!(ids.includes(key)||key==='hub'))return;if(!activity[key]||at>activity[key]){activity[key]=at;activityDirty=true;}}
function flushActivity(){if(!activityDirty)return;activityDirty=false;try{const file=join(deployDir,'activity.json');let old={};try{old=JSON.parse(readFileSync(file,'utf8'));}catch{}for(const [k,v] of Object.entries(activity))if(!old[k]||Date.parse(old[k])<v)old[k]=new Date(v).toISOString();writeFileSync(file+'.tmp',JSON.stringify(old));renameSync(file+'.tmp',file);}catch(e){console.error('activity file',e.code||e.message);}}
if(deployDir)setInterval(flushActivity,5000).unref();
const releaseOf=game=>game==='hub'?HUB_RELEASE:String(currentReleases()[game]||'');
// Smart home order: each child's reviewed shortcuts are favourites/cards; `nudge` (grown-ups only, same private
// file) is an optional override that forces the nudge card (empty by default: the nudge comes from each child's
// skill evidence). The reasons go to the diagnostics log, never to the page.
const shortcutsFor=p=>releasedShortcuts(Array.isArray(homeShortcuts[p.id])?homeShortcuts[p.id]:Array.isArray(p.homeShortcuts)?p.homeShortcuts:[],SHORTCUTS,deployDir);
const newGamesFor=p=>homeShortcuts.newGames?.[p.id]||{};
const homeSettings=()=>Object.fromEntries(config.players.map(p=>[p.id,{shortcuts:shortcutsFor(p),newGames:newGamesFor(p),nudges:Array.isArray(homeShortcuts.nudge?.[p.id])?homeShortcuts.nudge[p.id]:[]}]));
const menuTimeZone=process.env.FAMILY_TZ||Intl.DateTimeFormat().resolvedOptions().timeZone;
// Analytic nudges read an optional private skills profile at <skills dir>/<player>.json.
// The profile stays outside the release and is re-read on each scan; missing = neutral.
const learnerDir=process.env.FAMILY_LEARNER||(deployDir?join(deployDir,'..',channel==='staging'?join('staging-data','learner'):'learner'):profilePaths.learner);
const skillsDir=process.env.FAMILY_SKILLS||(deployDir?join(deployDir,'..','skills-focus'):join(data,'skills-focus'));
const makeMenu=()=>cachedMenuOrderService({players,home:homeSettings(),timeZone:menuTimeZone,skillsDir,onHome:(player,h)=>void log({type:'menu_home',player,day:h.day,order:h.order,nudge:h.nudge,forgotten:h.forgotten,why:h.why,skills:h.skills,analytics:h.analytics}),onError:detail=>void log({type:'menu_refresh_error',detail}),sources:{...Object.fromEntries(ids.map(id=>[id,join(config.gameData?.[id]||join(data,'..',id),'logs')])),hub:join(data,'logs')}});
let menu=makeMenu();
// The Book: chapters are generated nightly into the deployment's book directory (read-only here).
// Staging reads its own copy (staging-data/book), like its copy of the saves.
const bookDir=process.env.FAMILY_BOOK||(deployDir?join(deployDir,'..',channel==='staging'?join('staging-data','book'):'book'):profilePaths.book);
const timeZone=process.env.FAMILY_TZ||Intl.DateTimeFormat().resolvedOptions().timeZone;
// Private 3D toys (GLB) for the living book, next to the deployment (never in the repository).
const assets3d=process.env.FAMILY_ASSETS3D||(deployDir?join(deployDir,'..','assets3d'):join(data,'assets3d'));
const review=bookReviewService({bookDir,config,timeZone});
let book=bookService({data,bookDir,players,config,log,timeZone,assets3d});
let world=worldService({bookDir,config,book,authorized:review.authorized});
// Day notes: the grown-ups' page (/daynotes) about each child's day, woven into that night's chapter (book/daynotes.mjs).
let daynotes=dayNotesService({dir:dayNotesStore({deployDir,channel,bookDir}),config,timeZone,log});
const listen=listenService({settings:listenSettings({deployDir}),players,log});
const chessSettings=Object.fromEntries(config.players.map(p=>[p.id,{coachChatter:process.env.FAMILY_COACH_CHATTER,...(p.chess||{})}]));
const chess=chessService({data,players,log,settingsFor:chessSettings});
const onboarding=onboardingService({paths:{...profilePaths,book:bookDir,profiles:join(bookDir,'profiles.json'),cast:join(bookDir,'cast.json'),learner:learnerDir},authorized:review.authorized,onSave:async profiles=>{
 applyProfiles(profiles);players.splice(0,players.length,...config.players.map(p=>p.id));
 menu.close();menu=makeMenu();Object.assign(chessSettings,Object.fromEntries(config.players.map(p=>[p.id,{coachChatter:process.env.FAMILY_COACH_CHATTER,...(p.chess||{})}])));
 book=bookService({data,bookDir,players,config,log,timeZone,assets3d});world=worldService({bookDir,config,book,authorized:review.authorized});
 daynotes=dayNotesService({dir:dayNotesStore({deployDir,channel,bookDir}),config,timeZone,log});
}});
// A hub preview: the whole request goes to the preview's own hub (same path, same body; the answer comes back as is).
function forward(req,res,port){const headers={...req.headers};
 const up=http.request({host:'127.0.0.1',port,path:req.url,method:req.method,headers,timeout:30000},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 up.on('timeout',()=>up.destroy(new Error('preview timed out')));
 up.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/html','Retry-After':'3'});res.end('<meta http-equiv="refresh" content="3"><p>This preview is starting. <a href="/preview/exit">Leave the preview</a></p>');});
 req.on('aborted',()=>up.destroy());req.pipe(up);}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
 try{
  // Behind a local TLS proxy (e.g. a VPN's HTTPS serve) the page's real scheme is https. Trust the forwarded
  // scheme only from a loopback peer, so origin comparisons use the address the browser actually sees.
  const tls=req.headers['x-forwarded-proto']==='https'&&/^(?:127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress||'');
  const u=new URL(req.url,(tls?'https://':'http://')+req.headers.host);
  if(!allowedHosts().has(u.hostname.toLowerCase())||req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site'&&!(['GET','HEAD'].includes(req.method)&&req.headers['sec-fetch-mode']==='navigate'&&['document','empty',undefined].includes(req.headers['sec-fetch-dest'])))return send(res,403,{error:'Use the local games address.'});
  // Previews (staging site only): /preview/<name>/ opens one, /preview/exit leaves it (see preview-route.mjs).
  const pv=channel==='staging'&&deployDir?previewRoute(req,u,readRegistry(join(deployDir,'..','previews.json'))):null;
  if(pv&&['enter','exit','unknown'].includes(pv.kind)){res.writeHead(302,{Location:pv.location,'Set-Cookie':pv.cookie});res.end();return;}
  if(pv?.kind==='hub')return forward(req,res,pv.preview.port);
  const match=u.pathname.match(/^\/g\/([a-z-]+)\/(\w+)\/(.*)$/);
  if(match){const [,game,player,path]=match;
   if(pv?.kind==='game'&&ids.includes(game)&&players.includes(player))return proxy(req,res,{game,player,players,playerName:config.players.find(p=>p.id===player)?.name,port:pv.preview.port,prefix:`/g/${game}/${player}/`,path:'/'+path+(u.search||''),releases:{hub:HUB_RELEASE,game:'preview:'+pv.preview.name}},log);if(!ids.includes(game)||!players.includes(player))return send(res,404,{error:'Unknown game or player.'});if(!['GET','HEAD','OPTIONS'].includes(req.method))touch(game);return proxy(req,res,{game,player,players,playerName:config.players.find(p=>p.id===player)?.name,port:config.games[game],prefix:`/g/${game}/${player}/`,path:'/'+path+u.search,releases:{hub:HUB_RELEASE,game:releaseOf(game)}},log);}
  // Some SSR runtimes construct import paths at runtime from "/" + asset name.
  // Keep their router separators intact and scope those requests using the
  // same-origin embedding document/module, never a caller-selected upstream.
  if(req.method==='GET'&&/^\/(?:assets|_next)\//.test(u.pathname)&&req.headers.referer){
   const ref=new URL(req.headers.referer),from=ref.pathname.match(/^\/g\/([a-z-]+)\/(\w+)\//);
   if(ref.origin===u.origin&&from&&ids.includes(from[1])&&players.includes(from[2])){res.writeHead(307,{Location:`/g/${from[1]}/${from[2]}${u.pathname}${u.search}`});res.end();return;}
  }
  if(u.pathname==='/__deploy/version'&&req.method==='GET'){const g=u.searchParams.get('game'),idle=Number(u.searchParams.get('idle'));if(Number.isFinite(idle)&&idle>=0&&idle<120)touch(g,Date.now()-idle*1000);const games=Object.fromEntries(ids.map(id=>[id,releaseOf(id)]));return send(res,200,{hub:HUB_RELEASE,games,channel});}
  if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(req.method))touch('hub');
  if(u.pathname==='/api/onboarding'||u.pathname.startsWith('/onboarding')){const handled=await onboarding.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname==='/api/chess')return await chess.handle(req,res,u);
  if(u.pathname.startsWith('/api/listen')){const handled=await listen.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname==='/pond/companions.json'&&req.method==='GET'){try{return send(res,200,JSON.parse(await readFile(join(data,'pond-companions.json'),'utf8')));}catch{return send(res,200,{});}}
  if(u.pathname==='/api/daynotes'||u.pathname.startsWith('/daynotes')){const handled=await daynotes.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname.startsWith('/api/book/review')||u.pathname.startsWith('/book-review')){const handled=await review.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname.startsWith('/api/world')||u.pathname==='/world'||/^\/world\.(mjs|css)$/.test(u.pathname)||u.pathname==='/world-model.mjs'){const handled=await world.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname==='/api/book/preview'&&u.searchParams.get('review')==='1'&&!review.authorized(req))return send(res,403,{error:'Open the grown-ups gate.'});
  if(u.pathname.startsWith('/api/book')||u.pathname.startsWith('/book-voice/')||u.pathname.startsWith('/book-art/')||u.pathname.startsWith('/book-3d/')){const handled=await book.handle(req,res,u);if(handled!==false)return;}
  if(u.pathname==='/health')return send(res,200,{ok:true,version:HUB_VERSION,release:HUB_RELEASE||null,channel:channel||null,physicsVersion:VERSION,diagnostics:{ok:!logError,error:logError}});
  if(/^\/(?:voice|chess-voice)\/(manifest\.json|[a-f0-9]{16}\.wav)$/.test(u.pathname)&&req.method==='GET'){try{const bytes=await readFile(join(data,u.pathname.slice(1)));res.writeHead(200,{'Content-Type':u.pathname.endsWith('.wav')?'audio/wav':'application/json','Content-Length':bytes.length,...(u.pathname.endsWith('.wav')?{'Cache-Control':'private, max-age=31536000, immutable'}:{})});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Use device narration.'});else throw e;}return;}
  if(u.pathname==='/api/config'&&req.method==='GET')return send(res,200,{players:await Promise.all(config.players.map(async p=>({...p,world:await world.preview(p.id),worldQuest:await world.available(p.id),homeShortcuts:shortcutsFor(p),homeNewGames:newGamesFor(p)}))),onboardingRequired:(await onboarding.store.read()).required,menuTimeZone,version:HUB_VERSION,release:HUB_RELEASE});
  if(u.pathname.startsWith('/api/')){
   const player=u.searchParams.get('player');if(!players.includes(player))return send(res,400,{error:'Choose a player.'});
   // The shared end-of-game word break follows each child's Letter Quest progress (read only).
   if(u.pathname==='/api/word-break'&&req.method==='GET'){let save=null;try{save=JSON.parse(await readFile(join(process.env.LETTER_QUEST_DATA||config.gameData?.['letter-quest']||join(data,'..','letter-quest'),player+'.json'),'utf8'));}catch{}const lit=literacyFrom(save,DEFAULT_TRACK[player]||'mixed');try{const m=JSON.parse(await readFile(join(learnerDir,player+'.json'),'utf8'));if(m.literacy?.masteryRule){lit.wordLevel=m.literacy.wordLevel;lit.sentenceLevel=m.literacy.sentenceLevel;}}catch{}return send(res,200,lit);}
   if(u.pathname==='/api/menu'&&req.method==='GET'){const {order,ready,home}=menu.ranking(player);return send(res,200,{order,ready,home:home?.order||null,nudge:home?.nudge||null,familyOrder:home?.familyOrder||null,...(u.searchParams.get('why')==='1'&&home?{day:home.day,why:home.why,skills:home.skills||null,analytics:home.analytics||null}:{})});}
   // The unified learner model (the Book's nightly, book/learner-compile.mjs), for the grown-ups' diagnostics only:
   // nothing on the children's screens reads it. Private file outside the release; missing = 404.
   if(u.pathname==='/api/reading-support'&&req.method==='GET'){try{const m=JSON.parse(await readFile(join(learnerDir,player+'.json'),'utf8'));return send(res,200,m.literacy?.masteryRule?m.literacy:{wordsMastered:[]});}catch{return send(res,200,{wordsMastered:[]});}}
   if(u.pathname==='/api/learner'&&req.method==='GET'){try{return send(res,200,JSON.parse(await readFile(join(learnerDir,player+'-learner.json'),'utf8')));}catch{return send(res,404,{error:'No learner model yet.'});}}
   if(u.pathname==='/api/dribble'&&req.method==='GET'){await queue.catch(()=>{});return send(res,200,{profile:await load(player),version:VERSION});}
   if(req.method!=='POST'||!['/api/dribble','/api/events'].includes(u.pathname))return send(res,405,{error:'Unsupported action.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
   let raw='';for await(const part of req){raw+=part;if(raw.length>8192)return send(res,413,{error:'Too much data.'});}let input;try{input=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
   if(u.pathname==='/api/events'){await log({type:'client',player,kind:String(input.kind||'').slice(0,60),detail:String(input.detail||'').slice(0,300),servedRelease:HUB_RELEASE||'development',clientRelease:String(input.clientRelease||'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,120),...(input.kind==='error'?{stack:String(input.stack||'').slice(0,1500)}:{})});return send(res,200,{ok:true});}
   queue=queue.catch(()=>{}).then(async()=>{try{const p=await load(player),live=String(input.type).startsWith('live-'),before=live?{id:p.live?.round?.id,level:p.live?.level,inputs:p.live?.round?.inputs?.length}:structuredClone(p.round),result=live?actLive(p,input,config.players.find(x=>x.id===player).level||1):act(p,input),file=join(data,player+'.json');await writeFile(file+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file+'.tmp',file);await log({type:live?'dribble-live':'dribble',player,input,before,result,level:live?p.live.level:p.level,goals:p.goals,dribbles:live?p.live.wins:p.dribbles});send(res,200,{profile:p,result,version:VERSION});}catch(e){await log({type:'rejected',player,error:e.message});send(res,e.status||500,{error:e.status?e.message:'Could not save. Please Refresh.',code:e.code==='CLIENT_UPDATE'?'CLIENT_UPDATE':undefined});}});return;
  }
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Read only.'});
  let file;const preview=u.pathname.match(/^\/previews\/([a-z-]+)\.jpg$/);const icon=u.pathname.match(/^\/game-icons\/([a-z-]+)\.png$/);
  if(preview&&['hunt','letter-slalom','letter-quest','word-arcade','number-park','maze-garden','maze-maker','chess','three-in-a-row','target-trail','dribble-duel','maze-letters','maze-rescue','soccer-classic','soccer-penalties','sling'].includes(preview[1]))file=join(here,'public','previews',preview[1]+'.jpg');else if(icon&&icons[icon[1]])file=join(root,icons[icon[1]]);else if(u.pathname==='/dribble.mjs')file=join(here,'dribble.mjs');else{const name=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!files.includes(name)&&!LIVING_FILE.test(name))return send(res,404,{error:'Not found.'});file=join(here,'public',name);}
  let bytes=await readFile(file);
  // Installable app per player: /?player=<id> links a manifest whose id and start_url open that player's profile,
  // so each child's installed app is its own app. Unknown players get the shared manifest.
  const who=players.includes(u.searchParams.get('player'))?u.searchParams.get('player'):null;
  if(who&&file.endsWith('manifest.webmanifest'))bytes=Buffer.from(JSON.stringify(playerManifest(JSON.parse(bytes.toString()),config.players.find(p=>p.id===who))));
  if(who&&file.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace('href="/manifest.webmanifest"',`href="/manifest.webmanifest?player=${who}"`));
  // Stamp the document, rather than /api/config: a retained tab may fetch config from a newer release.
  if(file.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace('</head>',`<meta name="family-release" content="${String(HUB_RELEASE||'development').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,120)}"></head>`));
  // A preview's own hub, or the staging hub while a game preview is open: the small PREVIEW banner.
  {const pvName=process.env.FAMILY_PREVIEW||(channel==='staging'&&deployDir?cookieOf(req):null);
   if(pvName&&file.endsWith('index.html')&&(process.env.FAMILY_PREVIEW||readRegistry(join(deployDir,'..','previews.json')).previews?.[pvName]))bytes=Buffer.from(bytes.toString().replace(/<body([^>]*)>/i,`<body$1>${bannerHTML(pvName)}`));}
  if(channel==='staging'&&file.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace(/<body([^>]*)>/i,'<body$1><div role="note" style="position:fixed;z-index:99999;top:0;left:50%;transform:translateX(-50%);background:#c62828;color:#fff;font:700 14px/1.2 system-ui,sans-serif;padding:4px 14px;border-radius:0 0 10px 10px;letter-spacing:.08em;pointer-events:none">STAGING · test copy, not the kids\' games</div>'));
  // Caching (repeat opens on a slow connection should not re-download the app): every file carries a strong ETag and
  // a repeat request is answered 304 when nothing changed. Pages, code and styles are revalidated on every load
  // (a new release shows at once); pictures may be reused for a day without asking.
  const etag='"'+createHash('sha1').update(bytes).digest('base64url').slice(0,22)+'"',ext=extname(file);
  const cc=file.includes('/vendor/three/')||/^\.(png|jpe?g|webp|svg|woff2|m4a)$/.test(ext)?'max-age=86400':'no-cache';
  if(req.headers['if-none-match']===etag){res.writeHead(304,{ETag:etag,'Cache-Control':cc});res.end();return;}
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':bytes.length,ETag:etag,'Cache-Control':cc});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){await log({type:'error',detail:e.message});send(res,e.code==='ENOENT'?404:500,{error:'Could not load. Try Refresh.'});}
});
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
 if(stopping)return;stopping=true;menu.close();if(deployDir)flushActivity();
 // A tablet can retain a connection after the listener closes. Drain saved actions
 // before exiting, and bound idle/streaming socket shutdown during local updates.
 const timer=setTimeout(()=>server.closeAllConnections(),2000);timer.unref();
 server.close(async()=>{clearTimeout(timer);await Promise.allSettled([chess.close(),queue]);process.exit(0);});
 server.closeIdleConnections();
});
server.requestTimeout=20000;server.headersTimeout=20000;server.listen(Number(process.env.PORT||base-1),process.env.HOST||'127.0.0.1',()=>console.log(`Family Learning Games: http://localhost:${server.address().port}`));
