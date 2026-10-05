#!/usr/bin/env node
// Read-only browser checks and private home screenshots: --base URL --out DIR --players preset,preset
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {guardChrome} from './headless-guard.mjs';
import {homePins} from '../public/home-pages.mjs';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
for(const k of ['--base','--out','--players'])assert.ok(args.includes(k),k+' is required');
const base=arg('--base'),out=resolve(arg('--out')),players=arg('--players').split(',');
await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'world-home-chrome-'));
const chrome=guardChrome(spawn(process.env.CHROME||join(homedir(),'.local/share/family-games/bin/test-chrome'),['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--mute-audio'],{stdio:'ignore'}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0,pending=new Map(),errors=[],checks=[],screens=[];
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(50);}}
 const target=(await fetch('http://127.0.0.1:'+port+'/json').then(r=>r.json())).find(t=>t.type==='page');assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){pending.get(v.id)?.(v);pending.delete(v.id);}if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq,t=setTimeout(()=>no(Error('CDP timeout '+method)),10000);pending.set(id,v=>{clearTimeout(t);v.error?no(Error(JSON.stringify(v.error))):ok(v.result);});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await js(expression))return;await sleep(50);}throw Error('Timed out: '+expression+' '+await js('document.body.innerText'));};
 const navigate=async path=>{const previous=await js('globalThis.__homeDocument');await send('Page.navigate',{url:base+path});await until(`globalThis.__homeDocument!==${JSON.stringify(previous)}`);};
 const tap=async selector=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();if(!r)return null;const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,clear:hit===e||e.contains(hit)};})()`);assert.ok(p?.clear,'Covered '+selector);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',clickCount:1});};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__homeDocument=Date.now()+Math.random();globalThis.__adultGateRequests=0;const originalFetch=fetch;globalThis.fetch=(...args)=>{if(String(args[0]).includes('/api/book/review/gate'))__adultGateRequests++;return originalFetch(...args);};`});
 const config=await fetch(base+'/api/config').then(r=>r.json());
 for(const player of players){
  const p=config.players.find(p=>p.id===player);assert.ok(p);const pins=homePins(p);
  for(const [label,width,height]of [['laptop',1366,768],['phone',390,844]]){
   await send('Network.clearBrowserCookies');await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<height});
   await navigate('/?player='+encodeURIComponent(player)+'#games');
   await until(`!!document.querySelector('.home-page-1')&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);
   assert.deepEqual(await js(`[...document.querySelectorAll('.cards>.card')].slice(0,2).map(e=>e.dataset.game)`),pins.map(c=>c.id));
   assert.equal(await js(`document.querySelector('[data-game="my-world"] h2').textContent`),pins[0].name);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const file=player+'-home-'+label+'.png';await writeFile(join(out,file),Buffer.from(shot.data,'base64'));screens.push(file);
   await tap('[data-game="my-world"]');await until(`document.querySelector('#world')?.hidden===false&&[...document.images].every(i=>i.complete&&i.naturalWidth)`);
   assert.equal(await js(`document.querySelector('#adult').hidden`),true);assert.equal(await js('__adultGateRequests'),0);
   await tap('#home-button');await until(`location.pathname==='/'&&!!document.querySelector('.home-page-1')`);
   assert.equal(await js('new URL(location.href).searchParams.get("player")'),player);assert.equal(await js('location.hash'),'#games');
   assert.equal(await js(`!!document.querySelector('.bk-root')`),false,'Games must show home even with an unread chapter');
   await tap('.pager-btn.more');await until(`!!document.querySelector('.home-page-2')`);assert.equal(await js(`document.querySelectorAll('[data-game="my-world"],[data-game="my-book"]').length`),0);
   await navigate('/world?player='+encodeURIComponent(player)+'&review=1');await until(`document.querySelector('#adult')?.hidden===false`);
   await navigate('/world?player='+encodeURIComponent(player)+'&preview=1&date=2099-01-01');await until(`document.querySelector('#adult')?.hidden===false`);
   checks.push({player,label,worldName:pins[0].name,childUngated:true,exitHome:true,pageOnePinned:true,reviewGated:true,futureGated:true});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS',checks.length,'home, entry, exit and adult gate flows;',screens.length,'screenshots');
}finally{await writeFile(join(out,'home-audit.json'),JSON.stringify({checks,screens,errors},null,2));ws?.close();chrome.kill();}
