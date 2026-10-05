#!/usr/bin/env node
// Synthetic API state only: this audit never reads or writes a household save.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir,homedir} from 'node:os';
import {join,extname} from 'node:path';
import {fileURLToPath as fromURL} from 'node:url';
import assert from 'node:assert/strict';
import {SMALL} from '../public/world-definitions.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {artFor} from '../public/book-scene.mjs';
import {applyBackgroundLayouts} from '../public/book-painted-layout.mjs';
import {worldLines} from '../world-service.mjs';
import {guardChrome} from './headless-guard.mjs';
const root=fromURL(new URL('../public/',import.meta.url)),out=process.argv[2];assert.ok(out,'Pass a screenshot output directory');await mkdir(out,{recursive:true});
const model=createWorldModel(SMALL),generic=JSON.parse(await readFile(join(root,'book-art/library.json'))),layouts=JSON.parse(await readFile(new URL('../book-art-layouts.json',import.meta.url)));
let lib=applyBackgroundLayouts({...generic,backgrounds:{...generic.backgrounds,...layouts}});lib.actors.young=lib.actors.hero;lib.actors.dad=lib.actors['grown-up'];lib.actors.mom=lib.actors['grown-up'];
const art=artFor(Object.values(SMALL.ROOMS).map(r=>({scene:{bg:r.bg,actors:['young','dad','mom'].map(id=>({id,pose:'idle'})),props:[]}})),lib);
const lines=Object.fromEntries(Object.entries(worldLines({},SMALL)).map(([id,l])=>[id,{...l,clip:'fixture.wav'}]));
let state=model.freshWorld();const errors=[];
const wav=Buffer.alloc(44+1600);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(u.pathname==='/api/book/review/gate')return send(200,{unlocked:true});
 if(u.pathname==='/api/world'){if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);const r=model.worldAction(state,b);state=r.state;return send(200,r);}return send(200,{state,definition:SMALL,art,lines,name:'Explorer'});}
 if(u.pathname.startsWith('/book-voice/')){res.writeHead(200,{'Content-Type':'audio/wav'});return res.end(wav);}
 const name=u.pathname==='/world'?'world.html':u.pathname.slice(1);if(name.includes('..'))return send(404,{});const bytes=await readFile(join(root,name));res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.m4a':'audio/mp4'})[extname(name)]||'application/octet-stream'});res.end(bytes);
 }catch(e){res.writeHead(e.status||500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'world-scene-chrome-'));const chrome=guardChrome(spawn(process.env.CHROME||join(homedir(),'.local/share/family-games/bin/test-chrome'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--autoplay-policy=no-user-gesture-required','--mute-audio'],{stdio:'ignore'}));
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let port;for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await pause(350);}}
 assert.ok(port);const target=(await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json())).find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p?.reject(Error(JSON.stringify(v.error))):p?.resolve(v.result);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const js=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(await js(expression))return;await pause(50);}throw Error('Timed out '+expression+' '+JSON.stringify(await js('document.body.innerText')));};
 const tap=async selector=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});};
 await send('Page.enable');await send('Runtime.enable');
 const cases=[['stones','laptop',1366,768],['stones','tablet',1024,768],['stones','phone',390,844],['mats','laptop',1366,768],['mats','phone',390,844],['stone-subtract','tablet',1024,768],['gift','phone',390,844],['pattern-studio','laptop',1366,768]];
 const report=[];
 for(const [gate,label,width,height]of cases){const g=SMALL.GATES[gate];state={...model.freshWorld(),room:g.room,questStarted:true,tutorial:{walk:true,talk:true},flags:['gift-door'],items:['stone','flower','thought','pizza','ribbon'],visited:Object.keys(SMALL.ROOMS)};
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/world?player=young'});await until(`document.querySelector('#world')?.hidden===false&&document.querySelector('#scene').dataset.room===${JSON.stringify(g.room)}&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);
  await tap('[data-object="gate-'+gate+'"]');await until(`document.querySelector('#challenge').classList.contains('world-scene-challenge')&&!document.querySelector('#challenge').hidden`);
  await pause(80);
  const geometry=await js(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {id:e.dataset.paintedId||e.id||e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};return {panel:rect(document.querySelector('#challenge')),targets:[...document.querySelectorAll('.world-painted-target')].map(rect),actors:[...document.querySelectorAll('.actor')].map(rect),hud:rect(document.querySelector('.hud')),goal:rect(document.querySelector('#goal'))};})()`);
  for(const r of [geometry.panel,...geometry.targets])assert.ok(r.x>=0&&r.y>=0&&r.right<=width+.1&&r.bottom<=height+.1,'Out of viewport '+gate+' '+label+' '+JSON.stringify(r));
  for(const r of geometry.targets){assert.ok(r.w>=64&&r.h>=64);assert.ok(r.y>=Math.max(geometry.hud.bottom,geometry.goal.bottom),'target hidden by controls');}
  for(const actor of geometry.actors){const p=geometry.panel;assert.ok(!(actor.x<p.right&&actor.right>p.x&&actor.y<p.bottom&&actor.bottom>p.y),'Panel covers family '+gate+' '+label);}
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(out,gate+'-'+label+'.png'),Buffer.from(shot.data,'base64'));
  // All actual pointer centres must hit their own painted object. Generous
  // hit-box overlap is resolved by the nearest-object rule in the renderer.
  const ids=await js(`[...document.querySelectorAll('.world-painted-target')].map(e=>e.dataset.paintedId)`);
  if(ids.length){assert.ok(await js(`[...document.querySelectorAll('#challenge [data-answer]')].every(b=>b.disabled)`)||g.scenePuzzle.mode==='order');
   for(const object of ids){const p=await js(`(()=>{const e=document.querySelector('[data-painted-id="${object}"] span'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});await pause(350);}
   // For take away, the first pass removed four stones; the next pass counts
   // the eight remaining stones, each still painted in its original position.
   if(g.scenePuzzle.mode==='subtract')for(const object of ids.slice(g.scenePuzzle.takeAway)){await tap('[data-painted-id="'+object+'"]');await pause(350);}
   if(g.scenePuzzle.mode!=='order'){await until(`[...document.querySelectorAll('#challenge [data-answer]')].every(b=>!b.disabled)`);await tap('#challenge [data-answer="'+g.answer+'"]');}
  }else await tap('#challenge [data-answer="'+g.answer+'"]');
  await until(`document.querySelector('#challenge').hidden`);assert.ok(state.solved.includes(gate),gate+' not saved');await until(`!document.querySelector('.world-painted-layer')`);
  report.push({gate,label,geometry,solved:true});console.log('PASS',gate,label);
 }
 assert.deepEqual(errors,[]);await writeFile(join(out,'report.json'),JSON.stringify({cases:report,errors},null,2)+'\n');
}finally{ws?.close();chrome.kill('SIGKILL');await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
