import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {SMALL} from '../public/world-definitions.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {guardChrome} from '../scripts/headless-guard.mjs';
import {worldLines} from '../world-service.mjs';

test('cropped painted doors remain visible and accept a physical pointer at every viewport', {timeout:90000},async()=>{
 const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160"><rect width="100" height="160" fill="gold"/></svg>');
 const backgrounds=Object.fromEntries(Object.entries(SMALL.ROOMS).map(([id,r])=>[r.bg||id,{url:image,size:[3000,1000],ground:.97,groundStart:.5}]));
 const actors=Object.fromEntries(['hero',...new Set(Object.values(SMALL.ROOMS).map(r=>r.friend))].map(id=>[id,{name:id,h:.4,poses:{idle:{url:image,ar:.44}}}]));
 const art={backgrounds,actors,props:{chest:{url:image}}};let definition=SMALL,state;
 const server=createServer(async(req,res)=>{try{if(req.url.startsWith('/api/book/review/gate')){res.setHeader('Content-Type','application/json');res.end('{"unlocked":true}');return;}if(req.url.startsWith('/api/world')){if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;state=createWorldModel(definition).worldAction(state,JSON.parse(raw)).state;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state,art,lines:worldLines({},definition),definition,name:'Hero'}));return;}
 if(req.url.split('?')[0]==='/shared/uuid.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('../../shared/uuid.mjs',import.meta.url)));return;}
 const path=req.url.split('?')[0]==='/world'?'world.html':req.url.split('?')[0].slice(1);if(path.includes('..'))throw Error('Invalid path');res.setHeader('Content-Type',({'.mjs':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(await readFile(new URL('../public/'+path,import.meta.url)));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=await mkdtemp(join(tmpdir(),'world-geometry-'));let chrome,ws;
 try{chrome=guardChrome(spawn(process.env.CHROME||join(homedir(),'.local/share/family-games/bin/test-chrome'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--mute-audio'],{stdio:'ignore'}));
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(50);}}assert.ok(port,'Chrome did not start');
 let target;for(let i=0;i<100&&!target;i++){target=(await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json())).find(t=>t.type==='page');if(!target)await sleep(50);}assert.ok(target,'Chrome did not create a page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const browserErrors=[];const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}if(v.method==='Runtime.exceptionThrown')browserErrors.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>reject(Error('CDP timeout '+method)),10000);pending.set(id,v=>{clearTimeout(t);v.error?reject(Error(JSON.stringify(v.error))):resolve(v.result);});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const v=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description||v.exceptionDetails.text);return v.result?.value;};await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.__worldTrace=[];'});

 for(const [width,height]of [[1366,768],[1180,820],[820,1180],[390,844],[844,390]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<height});
  state={...createWorldModel(definition).freshWorld(),room:'pizza-party',questStarted:true,tutorial:{walk:true,talk:true}};
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/world?player=hero&preview=1`});
  let ready=false;for(let i=0;i<150;i++){ready=await js(`document.querySelector('#world')?.hidden===false&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);if(ready)break;await sleep(20);}assert.ok(ready,'scene renders');
  assert.deepEqual(await js('[innerWidth,innerHeight]'),[width,height],'actual CSS viewport');
  const rect=await js(`(()=>{const e=document.querySelector('.painted-opening'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
  assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=width+.5&&rect.bottom<=height+.5,`${width}x${height}: ${JSON.stringify(rect)}`);
  assert.ok(rect.w>=64&&rect.h>=64,'door keeps its minimum touch area');assert.ok(rect.hit,'door is not covered');
  for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:rect.x+rect.w/2,y:rect.y+rect.h/2,button:'left',clickCount:1});
  let entered=false;for(let i=0;i<300;i++){if(await js(`document.querySelector('#scene').dataset.room==='home-room'`)){entered=true;break;}await sleep(20);}assert.ok(entered,'physical tap enters the room');
 }
 assert.deepEqual(browserErrors,[]);
 }finally{ws?.close();if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){const closed=new Promise(r=>chrome.once('exit',r));chrome.kill();await closed;}server.closeAllConnections();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
