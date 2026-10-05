// Real renderer and service, pointer input and recorded playback. All progress lives in a disposable Book root.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {guardChrome} from '../../hub/scripts/headless-guard.mjs';
import {worldService} from '../../hub/world-service.mjs';
import {bookService} from '../../hub/book-service.mjs';
import {createWorldModel} from '../../hub/public/world-model.mjs';
import {measureWorldGeometry,worldGeometryIssues} from '../../hub/scripts/world-geometry.mjs';
const publicDir=fileURLToPath(new URL('../../hub/public/',import.meta.url)),pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function auditEpisode(ch,{paths,library,viewports=[[1366,768],[390,844]]}={}){
 const root=await mkdtemp(join(tmpdir(),'quest-audit-')),bookDir=join(root,'book'),player=ch.player;let chrome,ws,server;const issues=[],frames=[];
 try{
  await mkdir(join(bookDir,player,'review'),{recursive:true});await mkdir(join(bookDir,'world'),{recursive:true});
  await writeFile(join(bookDir,player,'review',ch.date+'.json'),JSON.stringify(ch));
  await writeFile(join(bookDir,'profiles.json'),JSON.stringify({[player]:{age:ch.level==='early'?4:8}}));
  await symlink(resolve(paths.voice),join(bookDir,'voice'));await symlink(resolve(paths.book,'art'),join(bookDir,'art'));
  const config={players:[{id:player,name:ch.name||'Explorer',age:ch.level==='early'?4:8}]};
  const book=bookService({bookDir,data:join(root,'data'),players:[player],config,timeZone:paths.timeZone,now:()=>Date.parse(ch.date+'T12:00:00')});
  const service=worldService({bookDir,config,book:{...book,library:async()=>library},authorized:()=>true});
  server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/book/review/gate'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({unlocked:true}));return;}if(await service.handle(req,res,u)!==false)return;if(await book.handle(req,res,u)!==false)return;const name=u.pathname.slice(1);if(!/^[a-z0-9/-]+\.(mjs|css|m4a|svg|woff2)$/.test(name)||name.includes('..')){res.writeHead(404);res.end();return;}const bytes=await readFile(join(publicDir,name));res.writeHead(200,{'Content-Type':name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);}catch(e){res.writeHead(500);res.end(e.message);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,query=new URLSearchParams({player,preview:'1',review:'1',date:ch.date});
  chrome=guardChrome(spawn(process.env.CHROME||join(homedir(),'.local/share/family-games/bin/test-chrome'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+join(root,'chrome'),'--mute-audio','--autoplay-policy=no-user-gesture-required','--no-first-run'],{stdio:'ignore'}));
  let port;for(let i=0;i<100;i++){try{port=(await readFile(join(root,'chrome','DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}if(!port)throw Error('Test Chrome did not start');
  const target=(await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json())).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.exception?.description||'Browser error');};
  const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq,t=setTimeout(()=>no(Error('CDP timeout '+method)),20000);pending.set(id,v=>{clearTimeout(t);v.error?no(Error(JSON.stringify(v.error))):ok(v.result);});ws.send(JSON.stringify({id,method,params}));});
  const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'JS error');return r.result.value;};
  const until=async expression=>{for(let i=0;i<180;i++){if(await js(expression))return;await pause(75);}throw Error('Timed out '+expression+' '+await js('document.body.innerText'));};
  const tap=async sel=>{const box=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw Error('No target '+${JSON.stringify(sel)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...box,button:'left',clickCount:1});};
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__auditDocument=Date.now()+Math.random();globalThis.__played=[];globalThis.__renderPosts=0;const f=fetch;globalThis.fetch=(...a)=>{if(String(a[0]).includes('/voice')&&a[1]?.method==='POST')__renderPosts++;return f(...a);};const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.addEventListener('playing',()=>__played.push(this.currentSrc+'#'+document.querySelector('#world')?.dataset.clip),{once:true});return play.call(this);};Object.defineProperty(window,'speechSynthesis',{value:{speak(){throw Error('Device voice forbidden');},cancel(){},getVoices(){return [];}}});`});
  const payload=await fetch(base+'/api/world?'+query).then(r=>r.json());if(!payload.definition)throw Error(payload.error);const model=createWorldModel(payload.definition),save=join(bookDir,'world',player+'.review-'+ch.episode.id+'.json');
  const load=async s=>{await writeFile(save,JSON.stringify(s));const previousDocument=await js('globalThis.__auditDocument');await send('Page.navigate',{url:base+'/world?'+query});await until(`globalThis.__auditDocument!==${JSON.stringify(previousDocument)}&&document.querySelector('#world')?.hidden===false&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);};
  const state=()=>fetch(base+'/api/world?'+query).then(r=>r.json()).then(j=>j.state);
  const geometry=async label=>{await js(`Promise.all(document.getAnimations().filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))`);const m=await js('('+measureWorldGeometry.toString()+')()');const bad=worldGeometryIssues(m);const clipped=await js(`(()=>{const els=[...document.querySelectorAll('.hud button,.signpost,.opening,#goal,#tutorial,#caption,#challenge,#challenge button,#map:not([hidden]),#map:not([hidden]) button')].filter(e=>e.getClientRects().length);return els.filter(e=>{const r=e.getBoundingClientRect();return r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5;}).map(e=>e.id||e.className);})()`);frames.push({label,issues:[...bad,...clipped.map(x=>'Clipped '+x)]});if(bad.length||clipped.length)throw Error(label+': '+[...bad,...clipped].join(' | '));};
  const travel=async to=>{while((await state()).room!==to){const s=await state(),next=model.routeTo(s.room,to,s)[1],r=model.ROOMS[s.room];if(!next)throw Error('Unreachable next step');await tap(r.door?.to===next?'.opening':'.signpost.'+Object.keys(r.exits).find(k=>r.exits[k]===next));await until(`document.querySelector('#scene').dataset.room===${JSON.stringify(next)}`);}};
  for(const [w,h]of viewports){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<h});await load({...model.freshWorld(),tutorial:{walk:true,talk:true}});
   // All grown map rooms remain physically accessible on both layouts.
   for(const room of Object.keys(model.ROOMS)){await load({...model.worldAction(model.freshWorld(),{action:'quest'}).state,room,tutorial:{walk:true,talk:true}});await geometry(w+'x'+h+' '+room);if(room.startsWith(ch.episode.id+'--')){await tap('.actor:not(.hero)');
    // Walking can replace its short on-way cue before it starts. Verify the friend's final line.
    await until(`document.querySelector('#world').dataset.line?.startsWith(${JSON.stringify('friend-'+room+'-')})`);const clip=await js(`document.querySelector('#world').dataset.clip`);await until(`__played.some(x=>x.includes(${JSON.stringify(clip)}))`);await geometry(w+'x'+h+' friend '+room);}}
   await load({...model.freshWorld(),tutorial:{walk:true,talk:true}});await tap('.actor:not(.hero)');await until(`fetch('/api/world?${query}').then(r=>r.json()).then(j=>j.state.questStarted)`);
   let steps=0;while(steps++<30){const s=await state(),goal=model.nextGoal(s);if(goal.key==='next-done')break;await travel(goal.room);
    if(goal.target.startsWith('lock-')){const id=goal.target.slice(5),l=model.LOCKS[id];await tap('[data-item="'+l.item+'"]');await tap('[data-object="'+goal.target+'"]');await until(`fetch('/api/world?${query}').then(r=>r.json()).then(j=>j.state.flags.includes(${JSON.stringify(id)}))`);}
    else if(goal.target.startsWith('gate-')){const id=goal.target.slice(5),g=model.GATES[id];await tap('[data-object="'+goal.target+'"]');await until(`!document.querySelector('#challenge').hidden`);await geometry(w+'x'+h+' puzzle '+id);
     if(g.kind==='count'){for(let i=0;i<g.count;i++){await tap('[data-step="'+i+'"]');if(i<g.count-1)await pause(100);}}
     else if(g.kind==='tiles'){const wrong=g.words[0].split('').find(c=>c!==g.words[0][0]);if(wrong){await tap('[data-letter="'+wrong+'"]');await until(`__played.some(x=>x.includes(${JSON.stringify(ch.episode.lines['sound-'+id+'-'+wrong].clip)}))`);await until(`!document.querySelector('.hint-text').hidden`);}for(const c of g.words.join('')){await tap('[data-letter="'+c+'"]');await until(`__played.some(x=>x.includes(${JSON.stringify(ch.episode.lines['sound-'+id+'-'+c].clip)}))`);}}
     else{await tap('[data-answer="'+g.options.find(x=>x!==g.answer)+'"]');await until(`!document.querySelector('.hint-text').hidden`);await geometry(w+'x'+h+' hint '+id);if(g.kind==='sound'){await tap('.hear-sound');await until(`__played.some(x=>x.includes(${JSON.stringify(ch.episode.lines['sound-'+id+'-'+g.letter].clip)}))`);}await tap('[data-answer="'+g.answer+'"]');}
     await until(`fetch('/api/world?${query}').then(r=>r.json()).then(j=>j.state.solved.includes(${JSON.stringify(id)}))`);if(id===model.definition.finishGate){await until(`!document.querySelector('#map').hidden`);await geometry(w+'x'+h+' reveal');await tap('#map .continue');}
    }else throw Error('Unknown hinted affordance '+goal.target);
   }
   if(!(await state()).treasureOpen||steps>=30)throw Error('Pointer quest failed to finish');
   const before=await state();await send('Page.reload');await until(`document.querySelector('#world')?.hidden===false`);if(JSON.stringify(await state())!==JSON.stringify(before))throw Error('Reload lost progress');
   if(await js('__renderPosts'))throw Error('Playback requested voice rendering');
  }
  if(errors.length)throw Error(errors.join(' | '));return {issues,viewports,frames:frames.length,playable:true};
 }catch(e){return {issues:[e.message],viewports,frames:frames.length,playable:false};}
 finally{ws?.close();if(chrome){chrome.kill();await new Promise(r=>{if(chrome.exitCode!==null)return r();chrome.once('exit',r);setTimeout(r,3000);});}if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
