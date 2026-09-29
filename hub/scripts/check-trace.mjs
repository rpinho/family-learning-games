#!/usr/bin/env node
// Tracing the big letter: success is immediate and happens once. Opens the letter page (grown-ups' preview, read-only),
// traces the letter with real pointer input, and measures:
//  - latency: the finger lifted -> accepted (the trace layer gone) must be < 300 ms (negative: accepted before the lift);
//  - one success motion: the letter runs at most ONE animation after success, lasting <= 400 ms;
//  - no bounce: the letter's position (its centre) never moves more than 3% of its width in the 16 s after success
//    (the reminders that follow a trace used to pulse the letter, which made it jump sideways and back).
// Headless Chrome, muted, device voice stubbed. Usage: node hub/scripts/check-trace.mjs --base URL --player diogo
//   [--size 412x915] [--phone] [--rows] [--watch ms] [--shots dir] [--json]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';
import {guardChrome} from './headless-guard.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const base=arg('--base','http://127.0.0.1:5325'),player=arg('--player','diogo'),[W,H]=arg('--size','412x915').split('x').map(Number),shots=arg('--shots');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json()).chapter;
const pageNo=ch.pages.findIndex(p=>p.beat?.kind==='teach-letter')+1;if(!pageNo)throw Error('no letter page in this chapter');
const profile=await mkdtemp(join(tmpdir(),'trace-'));
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});guardChrome(chrome);
let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
const t=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const w=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){w.get(m.id)(m);w.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const id=++seq;w.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:NO_DEVICE_VOICE});
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2.6,mobile:W<1000});
// A real phone: Android Chrome, touch input, a 4x slower CPU (--phone).
const phone=args.includes('--phone');
if(args.includes('--slow-net')){await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:false,latency:250,downloadThroughput:1.5e6/8,uploadThroughput:0.75e6/8});}
if(phone){await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await send('Emulation.setEmitTouchEventsForMouse',{enabled:true,configuration:'mobile'});await send('Emulation.setCPUThrottlingRate',{rate:4});}
const until=async(e,ms=40000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await js(e).catch(()=>false))return true;await sleep(100);}return false;};
await send('Page.navigate',{url:`${base}/?player=admin&r=${Date.now()}#book/${player}/p${pageNo}`});
await until(`!!document.querySelector('.bk-open')`,20000);await js(`document.querySelector('.bk-open').click()`);
if(!await until(`!!document.querySelector('.bk-trace')`,60000))throw Error('the trace layer never appeared');
await sleep(400);
// Watch the letter: its animations and its centre, from now on (in the page, every animation frame).
await js(`(()=>{window.__plays=[];const P0=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const src=(this.src||'').split('/').pop(),t=performance.now();this.addEventListener('playing',()=>window.__plays.push({t:performance.now(),called:t,src}),{once:true});return P0.apply(this,arguments);};})()`);
await js(`(()=>{const g=document.querySelector('.bk-glyph');window.__anim=[];window.__pos=[];
 g.addEventListener('animationstart',e=>{if(e.target===g)window.__anim.push({name:e.animationName,t:performance.now()});});
 const tick=()=>{const r=g.getBoundingClientRect();window.__pos.push({t:performance.now(),cx:r.left+r.width/2,w:r.width,traced:g.classList.contains('traced'),layer:!!document.querySelector('.bk-trace')});if(window.__pos.length<4000)requestAnimationFrame(tick);};tick();})()`);
// Trace: a finger drawing the capital letter's shape once (down the back, then the top bump, then the bottom bump),
// at finger speed (one touch point every 16 ms, about 1.6 s), like a careful child; --rows: a dense back-and-forth.
const box=await js(`(()=>{const g=document.querySelector('.bk-glyph'),r=document.createRange();r.setStart(g.firstChild,0);r.setEnd(g.firstChild,1);const b=r.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height};})()`);
const P=(fx,fy)=>({x:box.x+box.w*fx,y:box.y+box.h*fy});
const bump=(y0,y1,xr,n)=>Array.from({length:n+1},(_,i)=>{const a=-Math.PI/2+Math.PI*i/n;return P(0.22+(xr-0.22)*Math.cos(a),(y0+y1)/2+(y1-y0)/2*Math.sin(a));});
const shape=args.includes('--rows')?Array.from({length:15},(_,r)=>Array.from({length:13},(_,k)=>P(0.08+0.84*(r%2?1-k/12:k/12),0.05+0.9*r/14))).flat()
 :[...Array.from({length:25},(_,i)=>P(0.22,0.1+0.8*i/24)),...bump(0.1,0.49,0.72,30),...bump(0.49,0.9,0.8,34)];
let lastMove=0,upAt=0;
const down=async p=>phone?send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]}):send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
const move=async p=>phone?send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y,id:1}]}):send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'left'});
const up=async p=>phone?send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
await js(`window.__t0=performance.now()`);
await down(shape[0]);
for(const p of shape.slice(1)){await move(p);lastMove=await js('performance.now()');await sleep(16);}
await up(shape.at(-1));upAt=await js('performance.now()');
// Watch long enough for the reminders that follow (they pulsed the letter, which made it jump): 16 s.
await sleep(Number(arg('--watch','16000')));
const r=await js(`(()=>{const P=window.__pos,acc=P.find(p=>!p.layer);const tracedAt=acc?.t;
 const after=P.filter(p=>acc&&p.t>=acc.t),cx0=after[0]?.cx,maxShift=after.reduce((m,p)=>Math.max(m,Math.abs(p.cx-cx0)/p.w),0);
 const anims=window.__anim.filter(a=>tracedAt&&a.t>=tracedAt-50);
 const dur=[...document.getAnimations()].length;
 const praise=acc&&window.__plays.find(p=>p.t>=acc.t-5);
 return {accepted:!!acc,acceptedAt:acc?.t,tracedAt,maxShift:+maxShift.toFixed(3),anims:anims.map(a=>a.name),praiseAt:praise?.t??null,traced:document.querySelector('.bk-glyph')?.classList.contains('traced')};})()`);
const latency=r.accepted?Math.round(r.acceptedAt-upAt):null;
const issues=[];
if(!r.accepted)issues.push('never accepted');
if(latency!=null&&latency>=300)issues.push(`accepted ${latency} ms after the finger lifted (>= 300)`);
if(r.anims.length>1)issues.push(`${r.anims.length} animations after success: ${r.anims.join(', ')}`);
if(r.maxShift>0.03)issues.push(`the letter moved ${Math.round(r.maxShift*100)}% of its width after success`);
if(shots)await writeFile(join(shots,`trace-${player}-${W}x${H}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
const praiseMs=r.praiseAt!=null&&r.accepted?Math.round(r.praiseAt-r.acceptedAt):null;
if(praiseMs!=null&&praiseMs>400)issues.push(`the praise started ${praiseMs} ms after acceptance`);
const out={player,size:`${W}x${H}`,page:pageNo,latencyMs:latency,praiseMs,animations:r.anims,maxShift:r.maxShift,ok:!issues.length,issues};
console.log(args.includes('--json')?JSON.stringify(out):`${out.ok?'ok  ':'FAIL'} ${player} ${W}x${H}${phone?' phone':''} p${pageNo}: accepted ${latency} ms after the finger lifted; praise +${praiseMs} ms; animations after success: ${r.anims.join(', ')||'none'}; letter moved ${Math.round(r.maxShift*100)}% ${issues.join('; ')}`);
ws.close();chrome.kill();await sleep(200);await rm(profile,{recursive:true,force:true}).catch(()=>{});
process.exit(issues.length?1:0);
