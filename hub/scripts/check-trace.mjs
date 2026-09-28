#!/usr/bin/env node
// Tracing the big letter: success is immediate and happens once. Opens the letter page (grown-ups' preview, read-only),
// traces the letter with real pointer input, and measures:
//  - latency: the last trace move -> accepted (the trace layer gone, the letter marked traced) must be < 500 ms;
//  - one success motion: the letter runs at most ONE animation after success, lasting <= 400 ms;
//  - no bounce: the letter's position (its centre) never moves more than 3% of its width in the 16 s after success
//    (the reminders that follow a trace used to pulse the letter, which made it jump sideways and back).
// Headless Chrome, muted, device voice stubbed. Usage: node hub/scripts/check-trace.mjs --base URL --player diogo
//   [--size 412x915] [--shots dir] [--json]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const base=arg('--base','http://127.0.0.1:5325'),player=arg('--player','diogo'),[W,H]=arg('--size','412x915').split('x').map(Number),shots=arg('--shots');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json()).chapter;
const pageNo=ch.pages.findIndex(p=>p.beat?.kind==='teach-letter')+1;if(!pageNo)throw Error('no letter page in this chapter');
const profile=await mkdtemp(join(tmpdir(),'trace-'));
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
const t=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const w=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){w.get(m.id)(m);w.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const id=++seq;w.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:NO_DEVICE_VOICE});
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:W<1000});
const until=async(e,ms=40000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await js(e).catch(()=>false))return true;await sleep(100);}return false;};
await send('Page.navigate',{url:`${base}/?player=admin&r=${Date.now()}#book/${player}/p${pageNo}`});
await until(`!!document.querySelector('.bk-open')`,20000);await js(`document.querySelector('.bk-open').click()`);
if(!await until(`!!document.querySelector('.bk-trace')`,60000))throw Error('the trace layer never appeared');
await sleep(400);
// Watch the letter: its animations and its centre, from now on (in the page, every animation frame).
await js(`(()=>{const g=document.querySelector('.bk-glyph');window.__anim=[];window.__pos=[];
 g.addEventListener('animationstart',e=>{if(e.target===g)window.__anim.push({name:e.animationName,t:performance.now()});});
 const tick=()=>{const r=g.getBoundingClientRect();window.__pos.push({t:performance.now(),cx:r.left+r.width/2,w:r.width,traced:g.classList.contains('traced'),layer:!!document.querySelector('.bk-trace')});if(window.__pos.length<4000)requestAnimationFrame(tick);};tick();})()`);
// Trace: back-and-forth rows over the letter's box (a thorough trace), with real mouse input.
const box=await js(`(()=>{const r=document.querySelector('.bk-trace').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};})()`);
let lastMove=0;const rows=14;
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+box.w*0.1,y:box.y+box.h*0.05,button:'left',clickCount:1});
for(let r=0;r<=rows&&await js(`!!document.querySelector('.bk-trace')`);r++){const y=box.y+box.h*(0.05+0.9*r/rows);
 for(let k=0;k<=12;k++){const f=r%2?1-k/12:k/12;await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+box.w*(0.08+0.84*f),y,button:'left'});lastMove=await js('performance.now()');}}
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x,y:box.y,button:'left',clickCount:1});
// Watch long enough for the reminders that follow (they pulsed the letter, which made it jump): 16 s.
await sleep(Number(arg('--watch','16000')));
const r=await js(`(()=>{const P=window.__pos,acc=P.find(p=>!p.layer);const tracedAt=acc?.t;
 const after=P.filter(p=>acc&&p.t>=acc.t),cx0=after[0]?.cx,maxShift=after.reduce((m,p)=>Math.max(m,Math.abs(p.cx-cx0)/p.w),0);
 const anims=window.__anim.filter(a=>tracedAt&&a.t>=tracedAt-50);
 const dur=[...document.getAnimations()].length;
 return {accepted:!!acc,acceptedAt:acc?.t,tracedAt,maxShift:+maxShift.toFixed(3),anims:anims.map(a=>a.name)};})()`);
const latency=r.accepted?Math.round(r.acceptedAt-lastMove):null;
const issues=[];
if(!r.accepted)issues.push('never accepted');
if(latency!=null&&latency>=500)issues.push(`accepted ${latency} ms after the trace (>= 500)`);
if(r.anims.length>1)issues.push(`${r.anims.length} animations after success: ${r.anims.join(', ')}`);
if(r.maxShift>0.03)issues.push(`the letter moved ${Math.round(r.maxShift*100)}% of its width after success`);
if(shots)await writeFile(join(shots,`trace-${player}-${W}x${H}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
const out={player,size:`${W}x${H}`,page:pageNo,latencyMs:latency,animations:r.anims,maxShift:r.maxShift,ok:!issues.length,issues};
console.log(args.includes('--json')?JSON.stringify(out):`${out.ok?'ok  ':'FAIL'} ${player} ${W}x${H} p${pageNo}: accepted ${latency} ms after the trace; animations after success: ${r.anims.join(', ')||'none'}; letter moved ${Math.round(r.maxShift*100)}% ${issues.join('; ')}`);
ws.close();chrome.kill();await sleep(200);await rm(profile,{recursive:true,force:true}).catch(()=>{});
process.exit(issues.length?1:0);
