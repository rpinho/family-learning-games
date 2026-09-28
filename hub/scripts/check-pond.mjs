// Review-only browser check. No profile API, progress writes or production mutations.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.POND_REVIEW_BASE||'http://localhost:4810';
const out=process.argv[2];if(!out)throw Error('Pass a private screenshot output directory');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'pond-review-'));
const child=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const errors=[],writes=[],failures=[];
try{
 let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
 assert.ok(port,'Chrome started');const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&m.params.request.method!=='GET')writes.push(m.params.request.url);if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&!m.params.response.url.endsWith('favicon.ico'))failures.push([m.params.response.status,m.params.response.url]);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const t=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},20000);pending.set(id,m=>{clearTimeout(t);m.error?reject(Error(JSON.stringify(m.error))):resolve(m);});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.result.value;
 const until=async expression=>{for(let i=0;i<120;i++){if(await js(expression))return;await sleep(100);}throw Error('Timed out: '+expression);};
 const nav=async query=>{await send('Page.navigate',{url:base+'/pond/index.html'+query});await until('!!document.querySelector(".pond-prompt")');await sleep(100);};
 const touch=async sel=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:2,radiusY:2}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(out,name+'.png'),Buffer.from(r.result.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setTouchEmulationEnabled',{enabled:true});
 const views=[['phone',390,844],['chromebook',1366,768]],metrics=[];
 for(const [name,width,height] of views){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='phone'});
  await nav('?before=1');await shot(name+'-before');
  await nav('?mode=count');await shot(name+'-count-before-touch');
  for(const id of [4,4,2,0,3,1])await touch(`[data-leaf="${id}"]`);
  assert.equal(await js('window.__pondReview.getState().counted.length'),5);assert.equal(await js('window.__pondReview.getState().phase'),'done');
  await shot(name+'-count-after');assert.equal(await js('document.documentElement.scrollWidth>innerWidth'),false,'no horizontal overflow');
  await touch('[data-act=continue]');assert.match(await js('document.body.textContent'),/A small thing, noticed together/);
  await nav('?mode=flow');await shot(name+'-flow-before');
  await js('window.__frames=[];window.__last=performance.now();window.__measure=true;requestAnimationFrame(function sample(t){if(!window.__measure)return;window.__frames.push(t-window.__last);window.__last=t;requestAnimationFrame(sample)})');
  await touch('[data-bank=flowers]');await until('window.__pondReview.getState().phase==="explain"');
  await js('window.__measure=false');metrics.push({view:name,...await js('({nodes:document.querySelectorAll("*").length,frameMedian:window.__frames.sort((a,b)=>a-b)[Math.floor(window.__frames.length/2)],frameP95:window.__frames[Math.floor(window.__frames.length*.95)]})')});
  assert.equal(await js('window.__pondReview.getState().trials[0].matched'),false);
  await touch('[data-act=gate]');await touch('[data-bank=flowers]');await until('window.__pondReview.getState().phase==="done"');await shot(name+'-flow-after');
  assert.equal(await js('window.__pondReview.getState().trials.length'),2);
  await nav('?mode=flow');await touch('[data-act=continue]');assert.match(await js('document.body.textContent'),/A small thing, noticed together/);
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await nav('?mode=flow');await touch('[data-bank=reeds]');await until('window.__pondReview.getState().phase==="explain"');await shot('reduced-motion-flow');
 await nav('?mode=count');await touch('[data-act=help]');assert.equal(await js('window.__pondReview.getState().helped'),true);await touch('[data-act=replay]');
 await sleep(300);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(failures,[]);
 const report={ok:true,metrics,errors,writes,failures,checks:['two viewports','touch','count deduplication','wrong prediction','two flow paths','skip','finish','help','recorded voice requests','reduced motion','zero writes']};await writeFile(join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await send('Browser.close');
}finally{if(ws)ws.close();if(child.exitCode===null)child.kill();}
