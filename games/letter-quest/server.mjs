import {useHint} from './public/hints.mjs';
import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createDiagnostics,cleanEvent,identifier} from './diagnostics.mjs';
import {BUILD} from './public/version.mjs';
import {freshProfile,nextChallenge,applyAttempt,leagueRows,resetProgress,challengeKey,startDuel,startAdventure,claimQuest,DUEL_LEVELS,useMatchHint} from './public/engine.mjs';
import {storyAction,storyState} from './public/story.mjs';
import {mazeAction,mazeState} from './public/maze.mjs';
import {rescueAction,rescueState} from './public/rescue.mjs';
import {soccerAction,soccerState} from './public/soccer.mjs';
import {readingAction,readingState} from './public/reading.mjs';
import {claimLeague,advanceLeague} from './public/league.mjs';
import {backupProfile} from './profile-backup.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.LETTER_QUEST_DATA||path.join(os.homedir(),'.local/share/family-learning-games/letter-quest');
await mkdir(data,{recursive:true,mode:0o700});
const diagnostics=createDiagnostics(data);
await diagnostics.record('server_start');
const port=Number(process.env.PORT||4318),host=process.env.HOST||'127.0.0.1';
const allowedHosts=new Set(['localhost','127.0.0.1',os.hostname().toLowerCase(),'localhost',...Object.values(os.networkInterfaces()).flat().filter(Boolean).map(i=>i.address)]);
let queue=Promise.resolve();
async function load(id){try{return JSON.parse(await readFile(path.join(data,id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return freshProfile(id);throw e;}}
async function save(p){const file=path.join(data,p.id+'.json');await writeFile(file+'.tmp',JSON.stringify(p,null,2),{mode:0o600});await rename(file+'.tmp',file);}
const files={'/hints.mjs':'hints.mjs','/':'index.html','/app.mjs':'app.mjs','/engine.mjs':'engine.mjs','/dialogue.mjs':'dialogue.mjs','/voice.mjs':'voice.mjs','/telemetry.mjs':'telemetry.mjs','/version.mjs':'version.mjs','/style.css':'style.css','/rook.svg':'rook.svg','/favicon.ico':'rook.svg'};
Object.assign(files,{'/hub.mjs':'hub.mjs','/hub.css':'hub.css'});
for(const file of ['rescue.mjs','rescue-puzzles.mjs','rescue-view.mjs','rescue.css','player-banner.css'])files['/'+file]=file;
for(const file of ['story.mjs','story-ui.mjs','rook.mjs','story.css'])files['/'+file]=file;
for(const file of ['maze.mjs','maze-view.mjs','maze-renderer.mjs','maze-themes.mjs','maze-learning.mjs','maze-curriculum.mjs','maze-skills.mjs','phonics.mjs','maze.css','league.mjs','league.css'])files['/'+file]=file;
for(const file of ['soccer.mjs','soccer-view.mjs','soccer-audio.mjs','soccer.css'])files['/'+file]=file;
for(const file of ['reading-client.mjs','reading.mjs','reading-view.mjs','reading.css','foundation.mjs','guided-trace.mjs'])files['/'+file]=file;
for(const version of [1,2])for(const size of [16,32,48,180,192,512])files[`/icons/app-${size}-v${version}.png`]=`icons/app-${size}-v${version}.png`;
files['/icons/favicon-v1.ico']='icons/favicon-v1.ico';files['/icons/favicon-v2.ico']='icons/favicon-v2.ico';files['/favicon.ico']='icons/favicon-v2.ico';files['/manifest.webmanifest']='manifest.webmanifest';
const mime={html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',ico:'image/x-icon',webmanifest:'application/manifest+json'};
function reply(res,status,body){if(status>=400)res.diagnosticReason=body.error;res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body.profile?{...body,serverNow:Date.now()}:body));}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>200000)throw Object.assign(Error('Request too large'),{status:413});}try{return JSON.parse(data);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}}
function validStrokes(strokes){return Array.isArray(strokes)&&strokes.length<=8&&strokes.every(s=>Array.isArray(s)&&s.length>=2&&s.length<=1000&&s.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=-10&&v<=110)));}
const telemetryRates=new Map(),badSockets=new WeakSet();
const server=http.createServer(async(req,res)=>{
 const requestId=randomUUID(),began=Date.now(),session=identifier(req.headers['x-letter-quest-session']);
 const route=(req.url||'/').split('?')[0].slice(0,180);
 res.setHeader('X-Request-ID',requestId);
 res.once('finish',()=>void diagnostics.record('http',{requestId,session,route,method:req.method,status:res.statusCode,durationMs:Date.now()-began,reason:res.diagnosticReason}));
 req.once('aborted',()=>void diagnostics.record('request_aborted',{requestId,session,route}));
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
  const requestHost=(req.headers.host||'').split(':')[0].toLowerCase();
  if(!allowedHosts.has(requestHost))return reply(res,403,{error:'Unrecognized host'});
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Use the game from its own address'});
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health')return reply(res,200,{ok:true,version:BUILD,diagnostics:diagnostics.status()});
  if(url.pathname==='/api/diagnostics'){
   if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'JSON required'});
   const address=req.socket.remoteAddress,now=Date.now();
   for(const [key,value] of telemetryRates)if(now-value.at>60000)telemetryRates.delete(key);
   const rate=telemetryRates.get(address)||{at:now,count:0};rate.count++;telemetryRates.set(address,rate);
   if(rate.count>120)return reply(res,429,{error:'Diagnostic rate limit; retry later'});
   const input=await body(req);let events;
   try{if(!Array.isArray(input?.events)||input.events.length<1||input.events.length>25)throw Error();events=input.events.map(cleanEvent);}catch{return reply(res,400,{error:'Invalid diagnostic batch'});}
   const saved=await diagnostics.record('client_events',{requestId,events});
   return reply(res,saved?200:503,saved?{ok:true,accepted:events.length}:{error:'Diagnostics storage unavailable'});
  }
  if(url.pathname==='/voice/manifest.json'||/^\/voice\/[a-f0-9]{16}\.wav$/.test(url.pathname)){
   if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});
   const file=path.join(data,'voice',path.basename(url.pathname));
   let bytes;try{bytes=await readFile(file);}catch(e){if(e.code==='ENOENT')return reply(res,404,{error:'Voice is not ready yet'});throw e;}
   res.setHeader('Content-Type',url.pathname.endsWith('.wav')?'audio/wav':'application/json');
   if(url.pathname.endsWith('.wav'))res.setHeader('Cache-Control','public, max-age=31536000, immutable');
   res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);return;
  }
  const match=url.pathname.match(/^\/api\/(explorer|beginner|admin)\/(state|attempt|settings|chest|promote|advance|reset|skip|duel|adventure|quest|hint|story|maze|soccer|reading|rescue)$/);
  if(match){
   const [,id,action]=match;
   if(action==='reset'&&id!=='admin')return reply(res,403,{error:'Child progress cannot be reset from the website'});
   if(req.method==='GET'&&action==='state'){await queue;const p=await load(id);return reply(res,200,{profile:p,challenge:nextChallenge(p)});}
   if(req.method!=='POST'||action==='state')return reply(res,405,{error:'Method not allowed'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'JSON required'});
   const input=await body(req);
   if(!input||typeof input!=='object'||Array.isArray(input))return reply(res,400,{error:'JSON object required'});
   const work=queue.then(async()=>{
    let p=await load(id),result={},attempt,storyEvent,mazeEvent,soccerEvent,readingEvent,rescueEvent;
    if(action==='attempt'){
     const challenge=nextChallenge(p);
     if(input.challengeId!==challenge.id)return reply(res,409,{error:'Progress changed on another device. Reload to continue.'});
     if(!Number.isFinite(input.durationMs)||input.durationMs<0||input.durationMs>86400000||typeof input.helped!=='boolean')return reply(res,400,{error:'Invalid attempt'});
     if(challenge.type==='trace'?!validStrokes(input.strokes):typeof input.answer!=='string'||input.answer.length>20)return reply(res,400,{error:'Invalid answer'});
     const key=challengeKey(challenge);
     const before={...(p.skills[key]||{level:0,seen:0,hits:0,streak:0})};
     const beforeFoundation=structuredClone(p.foundation||null);
     result=applyAttempt(p,challenge,input);
     attempt={player:id,session,requestId,key,challenge,input:{challengeId:input.challengeId,answer:input.answer,strokes:challenge.type==='trace'?input.strokes:undefined,durationMs:input.durationMs,helped:p.history.at(-1).helped},before,after:p.skills[key],result,revision:p.revision,completed:p.completed,...(challenge.foundation?{foundation:{before:beforeFoundation,after:p.foundation}}:{})};
    }else if(action==='hint'){
     if(input.challengeId!==nextChallenge(p).id)return reply(res,409,{error:'Progress changed. Reload before asking for help.'});
     try{if(nextChallenge(p).duel)result=useMatchHint(p);else {const spent=useHint(p,`lesson:${input.challengeId}`);if(spent)p.revision++;result={helped:true,spent};}}catch(e){return reply(res,e.status||400,{error:e.message});}
    }else if(action==='story'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload to continue the story.'});
     const before=structuredClone(storyState(p));
     try{result=storyAction(p,input);}catch(e){return reply(res,e.status||400,{error:e.message});}
     storyEvent={requestId,session,player:id,input:{kind:input.kind,position:input.position,guided:input.guided,revision:input.revision},before,after:storyState(p),result,revision:p.revision};
    }else if(action==='rescue'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Refresh to continue your rescue.'});
     if(input.rescueVersion!==2&&(rescueState(p).engine===2||input.kind==='next'))return reply(res,409,{error:'New rescue puzzles are ready. Tap Refresh at the top. Your progress is saved.'});
     const before=structuredClone(rescueState(p));
     try{result=rescueAction(p,input);}catch(e){return reply(res,400,{error:e.message});}
     rescueEvent={requestId,session,player:id,input:{kind:input.kind,card:input.card,turn:input.turn,mission:input.mission,revision:input.revision},before,after:rescueState(p),result,revision:p.revision};
    }else if(action==='maze'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload to continue the labyrinth.'});
     if(input.kind==='answer'&&(!Number.isFinite(input.durationMs)||input.durationMs<0||input.durationMs>86400000))return reply(res,400,{error:'Invalid puzzle timing'});
     const before=structuredClone(mazeState(p));
     try{result=mazeAction(p,input);}catch(e){return reply(res,e.status||400,{error:e.message});}
     mazeEvent={requestId,session,player:id,input:{kind:input.kind,turn:input.turn,index:input.index,questionId:input.questionId,answer:input.answer,durationMs:input.durationMs,revision:input.revision},before,after:mazeState(p),result,revision:p.revision};
    }else if(action==='soccer'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload to continue the shootout.'});
     if(input.kind==='answer'&&(!Number.isFinite(input.durationMs)||input.durationMs<0||input.durationMs>86400000))return reply(res,400,{error:'Invalid puzzle timing'});
     const before=structuredClone(soccerState(p));
     try{result=soccerAction(p,input);}catch(e){return reply(res,e.status||400,{error:e.message});}
     soccerEvent={requestId,session,player:id,input:{kind:input.kind,level:input.level,aim:input.aim,questionId:input.questionId,answer:input.answer,durationMs:input.durationMs,revision:input.revision},before,after:soccerState(p),result,revision:p.revision};
    }else if(action==='reading'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload to continue reading.'});
     const s=readingState(p),before={run:s.run,step:s.step,phase:s.phase,question:s.question,help:[...s.help],mistakes:s.mistakes,skills:structuredClone(s.skills)};
     try{result=readingAction(p,input);}catch(e){return reply(res,e.status||400,{error:e.message});}
     const after=readingState(p);
     readingEvent={requestId,session,player:id,input:{kind:input.kind,focus:input.focus,level:input.level,replace:input.replace,questionId:input.questionId,answer:input.answer,draft:input.draft,position:input.position,ink:input.ink,help:input.help,durationMs:input.durationMs,revision:input.revision},before,after:{run:after.run,step:after.step,phase:after.phase,help:after.help,mistakes:after.mistakes,skills:after.skills},result,revision:p.revision};
    }else if(action==='duel'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload before starting a duel.'});
     if(input.difficulty!==undefined&&!DUEL_LEVELS.some(d=>d.id===input.difficulty))return reply(res,400,{error:'Choose Friendly, Clever, or Boss'});
     startDuel(p,input.difficulty);result={duel:p.duel};
    }else if(action==='adventure'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload before continuing.'});
     startAdventure(p);result={paused:!!p.duel?.paused};
    }else if(action==='quest'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload before claiming a reward.'});
     result=claimQuest(p,input.questId);
     if(!result)return reply(res,400,{error:'This quest reward is not ready or was already collected'});
    }else if(action==='skip'){
     const skippedChallenge=nextChallenge(p);
     if(skippedChallenge.duel)return reply(res,400,{error:'Use Show me for help, or pause this match.'});
     if(input.challengeId!==skippedChallenge.id)return reply(res,409,{error:'Progress changed. Reload before choosing another challenge.'});
     p.seq++;p.revision++;delete p.retryTrace;result={skipped:true,skippedChallenge};
    }else if(action==='reset'){
     if(input.confirmation!=='RESET ADMIN')return reply(res,400,{error:'Confirm resetting Admin practice'});
     if(input.revision!==p.revision)return reply(res,409,{error:'Admin practice changed. Reload before resetting.'});
     const backup=await backupProfile(data,p);p=resetProgress(p);result={reset:true,backup};
    }else if(action==='settings'){
     for(const k of ['leftHanded','sound'])if(typeof input[k]==='boolean')p.settings[k]=input[k];
    }else if(action==='chest'){
     if(p.chests<1)return reply(res,400,{error:'Complete three lessons to earn a chest'});p.chests--;p.gems+=25;result={gems:25};
    }else if(action==='promote'){
     if(!leagueRows(p)[0].you)return reply(res,400,{error:'Reach first place to claim your crown'});
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload to claim your crown.'});
     result=claimLeague(p);if(!result)return reply(res,400,{error:'This crown was already collected. Enjoy first place!'});
    }else if(action==='advance'){
     if(input.revision!==p.revision)return reply(res,409,{error:'Progress changed. Reload before advancing.'});
     result=advanceLeague(p);if(!result)return reply(res,400,{error:'Claim this gem’s crown first'});
    }
    await save(p);
    if(storyEvent)await diagnostics.record('story_action',storyEvent);
    if(mazeEvent)await diagnostics.record('maze_action',mazeEvent);
    if(rescueEvent)await diagnostics.record('rescue_action',rescueEvent);
    if(soccerEvent)await diagnostics.record('soccer_action',soccerEvent);
    if(readingEvent)await diagnostics.record('reading_action',readingEvent);
    if(attempt)await diagnostics.record('attempt',attempt);
    else await diagnostics.record('profile_action',{requestId,session,player:id,action,settings:action==='settings'?p.settings:undefined,hintBank:p.hintBank,backup:result.backup,skippedChallenge:result.skippedChallenge,duel:['duel','adventure','hint'].includes(action)?p.duel:undefined,questId:action==='quest'?input.questId:undefined,reward:['quest','hint','story','promote','advance'].includes(action)?result:undefined});
    reply(res,200,{profile:p,challenge:nextChallenge(p),result});
   });queue=work.catch(()=>{});await work;return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});
  const file=files[url.pathname];if(!file)return reply(res,404,{error:'Not found'});
  res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)]});res.end(req.method==='HEAD'?undefined:await readFile(path.join(root,'public',file)));
 }catch(e){console.error(e.message);await diagnostics.record('server_error',{requestId,session,route,code:e.code,message:e.message,stack:e.stack});if(!res.headersSent)reply(res,e.status||500,{error:e.status?e.message:'Could not save progress. Please try again.'});else res.end();}
});
server.on('error',async e=>{await diagnostics.record('server_error',{code:e.code,message:e.message,stack:e.stack});process.exitCode=1;});
server.on('clientError',(e,socket)=>{
 if(badSockets.has(socket))return;badSockets.add(socket);
 // An HTTPS ClientHello on our HTTP port never becomes a normal request.
 const tls=e.rawPacket?.[0]===22&&e.rawPacket?.[1]===3;
 void diagnostics.record('protocol_error',{code:e.code,reason:tls?'https_sent_to_http_port':'invalid_http'});
 if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');else socket.destroy();
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(async()=>{await diagnostics.record('server_stop',{signal});await diagnostics.flush();process.exit(0);});setTimeout(()=>process.exit(1),5000).unref();});
server.listen(port,host,()=>console.log(`Letter Quest listening on ${host}:${port}; progress at ${data}`));
