// node hub/tests/world-ui-audit.mjs --base URL --book ISOLATED_BOOK --out PRIVATE_DIR --players older,younger
// Real painted UI, pointer events and recorded audio. Only the supplied copied saves are written.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {guardChrome} from '../scripts/headless-guard.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {questGoals} from '../public/world-progress.mjs';
import {measureWorldGeometry,worldGeometryIssues} from '../scripts/world-geometry.mjs';
const args=process.argv.slice(2),arg=(k)=>args[args.indexOf(k)+1];
for(const k of ['--base','--book','--out','--players'])assert.ok(args.includes(k),k+' is required');
const base=arg('--base'),book=resolve(arg('--book')),out=resolve(arg('--out')),players=arg('--players').split(',');
assert.ok(!book.startsWith(join(homedir(),'.local/share/family-games/book')),'Use a copied Book');
await mkdir(out,{recursive:true});await mkdir(join(book,'world'),{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'world-ui-')),chrome=guardChrome(spawn(process.env.CHROME||join(homedir(),'.local/share/family-games/bin/test-chrome'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--mute-audio','--autoplay-policy=no-user-gesture-required'],{stdio:'ignore'}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0,pending=new Map(),errors=[],checks=[],screens=[],voicePosts=0;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(50);}}
 let target;for(let i=0;i<100&&!target;i++){target=(await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json())).find(t=>t.type==='page');if(!target)await sleep(50);}assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);if(v.method==='Network.requestWillBeSent'&&v.params.request.method==='POST'&&v.params.request.url.includes('/api/world/voice'))voicePosts++;};
 const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq,t=setTimeout(()=>no(Error('CDP timeout '+method)),10000);pending.set(id,v=>{clearTimeout(t);v.error?no(Error(JSON.stringify(v.error))):ok(v.result);});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const v=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description||v.exceptionDetails.text);return v.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await js(expression))return;await sleep(30);}throw Error('Timed out: '+expression+' '+await js('document.body.innerText'));};
 const tap=async selector=>{const p=await js(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}),r=b?.getBoundingClientRect();if(!r)return null;const x=r.x+r.width/2,y=r.y+r.height/2,e=document.elementFromPoint(x,y);return {x,y,hit:e===b||b.contains(e),cover:e?.id||e?.className};})()`);assert.ok(p,'Missing '+selector);assert.ok(p.hit,'Covered '+selector+' '+p.cover);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',clickCount:1});};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(out,name+'.png'),Buffer.from(r.data,'base64'));screens.push(name+'.png');};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__uiDocument=Date.now()+Math.random();globalThis.__media=new Set();globalThis.__voiceStarts=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){__media.add(this);if(!this.__tracked){this.__tracked=true;this.addEventListener('playing',()=>{if(this.src.startsWith('blob:')||this.src.includes('/book-voice/'))__voiceStarts.push({at:performance.now(),clip:document.querySelector('#world')?.dataset.clip,key:document.querySelector('#world')?.dataset.line});});}return play.call(this);};addEventListener('pagehide',()=>sessionStorage.setItem('worldExit',JSON.stringify({blocked:familyAudio?.blocked,paused:[...__media].every(m=>m.paused),epoch:familyAudio?.epoch})));`});
 await send('Page.navigate',{url:base+'/world?player='+players[0]});await until(`document.querySelector('#adult')?.hidden===false||document.querySelector('#world')?.hidden===false`);
 if(await js(`!document.querySelector('#adult').hidden`)){await js(`document.querySelector('#answer').value=document.querySelector('#code').textContent.split(' ').map(w=>w[0]).reverse().join('')`);await tap('#gate-form button');await until(`document.querySelector('#world').hidden===false`);}
 for(const player of players){const q=new URLSearchParams({player}).toString(),data=await js(`fetch('/api/world?${q}').then(r=>r.json())`),model=createWorldModel(data.definition),d=model.definition;
  const save=join(book,'world',player+'.json'),copied=await readFile(save).then(b=>JSON.parse(b)).catch(()=>model.freshWorld());
  const open=async state=>{await writeFile(save,JSON.stringify(state));const previous=await js('globalThis.__uiDocument');await send('Page.navigate',{url:base+'/world?'+q});await until(`globalThis.__uiDocument!==${JSON.stringify(previous)}&&document.querySelector('#world')?.hidden===false&&document.querySelector('#scene')?.dataset.room===${JSON.stringify(state.room)}&&document.querySelector('#loading').hidden&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);};
  for(const [label,width,height] of [['laptop',1366,768],['tablet',768,1024],['phone',390,844],['landscape-phone',844,390]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<height});
   for(const room of Object.keys(d.ROOMS)){
    await open({...model.freshWorld(),room});
    assert.deepEqual(await js('('+measureWorldGeometry.toString()+')()').then(m=>worldGeometryIssues(m)),[],d.id+' '+room+' '+label);
    const h=await js(`(()=>{const b=document.querySelector('#home-button'),r=b.getBoundingClientRect();return {text:b.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,display:getComputedStyle(b).display};})()`);assert.match(h.text,/←.*Games/);assert.ok(h.x>=0&&h.x<=24&&h.y>=0&&h.right<=width&&h.bottom<=height&&h.w>=74&&h.h>=44,d.id+' '+room+' '+label+' Home '+JSON.stringify(h));
    assert.deepEqual(await js(`(()=>{const selectors='.hud button,#goal,#quest-button';return [...document.querySelectorAll(selectors)].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5;}).map(e=>e.id||e.className);})()`),[],'Clipped '+room+' '+label);
    if(room===d.startRoom&&label!=='landscape-phone')await shot(d.id+'-'+label+'-home');
    await tap('#home-button');await until(`location.pathname==='/'&&!!document.querySelector('main')`);const exit=await js(`JSON.parse(sessionStorage.getItem('worldExit'))`);assert.ok(exit.blocked&&exit.paused&&exit.epoch>0);checks.push({kind:'exit',world:d.id,room,label,...exit});
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  const medalEntries=Object.entries(model.GATES).filter(([,g])=>g.rewards.some(id=>model.ITEMS[id]?.collection)),missing=medalEntries.at(-1)?.[0];
  const ready={...model.freshWorld(),room:d.startRoom,questStarted:true,tutorial:{walk:true,talk:true},treasureOpen:true,doorOpen:true,solved:Object.keys(model.GATES).filter(id=>id!==missing),items:Object.keys(model.ITEMS).filter(id=>!model.GATES[missing]?.rewards.includes(id)),flags:[...new Set([...Object.keys(model.LOCKS),'acorns-traded','ball-returned','bridge-tied','bridge','night','runaway','dig'])],collected:['acorn-1','acorn-2','acorn-3','ball'],visited:Object.keys(model.ROOMS)};
  for(const [mode,s]of [['fresh',model.freshWorld()],['copied',model.upgradeWorld(copied)],['completed',ready]]){await open(s);await tap('#map-button');const pins=await js(`Object.fromEntries([...document.querySelectorAll('#map [data-room][data-goals]')].map(e=>[e.dataset.room,e.dataset.goals.split(' ')]))`);for(const g of questGoals(model,s).filter(g=>!g.done))assert.ok(pins[g.room]?.includes(g.id),mode+' missing '+g.id);checks.push({kind:'map',world:d.id,mode});if(mode==='completed')await shot(d.id+'-remaining-goals');await tap('#map .continue');}
  for(const [kind,label]of [['tetherball','tablet'],['soccer','laptop']]){
   const room=Object.keys(d.ROOMS).find(id=>{const defaults=d.early?{tetherball:'tetherball-yard',soccer:'pizza-party'}:{tetherball:'treehouse-town',soccer:'soccer-pitch'};return id===defaults[kind];});assert.ok(room);
   const [width,height]=label==='tablet'?[768,1024]:[1366,768];await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:label==='tablet'});await open({...ready,room});const before=await readFile(save);
   for(let i=0;i<20;i++)await tap(`[data-toy="${kind}"]`);assert.deepEqual(await readFile(save),before,'Toy must not write progression');await shot(d.id+'-'+kind);checks.push({kind:'toy',world:d.id,toy:kind,taps:20});
   if(kind==='soccer'){await tap('#replay-button');await tap('#what-next');await until(`__voiceStarts.length>0`);await tap('#home-button');await until(`location.pathname==='/'`);const exit=await js(`JSON.parse(sessionStorage.getItem('worldExit'))`);assert.ok(exit.blocked&&exit.paused);checks.push({kind:'audible-exit',world:d.id,...exit});}
  }
 }
 assert.equal(voicePosts,0);assert.deepEqual(errors,[]);assert.equal(screens.length,12);console.log(JSON.stringify({checks:checks.length,screens,voicePosts,errors}));
}catch(e){errors.push(e.stack);process.exitCode=1;console.error(e);}
finally{await writeFile(join(out,'ui-audit.json'),JSON.stringify({checks,screens,errors,voicePosts},null,2));ws?.close();if(chrome.exitCode===null&&chrome.signalCode===null){const closed=new Promise(r=>chrome.once('exit',r));chrome.kill();await closed;}await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
