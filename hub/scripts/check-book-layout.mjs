#!/usr/bin/env node
// Layout check for The Book: every character must be SEEN. For each page of a child's chapter, at each screen
// size, it samples the character's own opaque pixels and asks whether anything painted above them (a wagon, the
// engine, a prop, another character, a caption, a button) or the screen edge hides them. Alpha-aware: the empty
// part of a picture hides nothing. Rules: a standing character shows >= 90% of himself; a rider in a wagon shows
// >= 55% (the wagon's front wall hides his legs) and >= 95% of his upper half. Grown-ups' preview: nothing saved.
// Usage: node hub/scripts/check-book-layout.mjs --base http://127.0.0.1:5325 --player <id>[,<id>]
//        [--sizes 390x844m,1366x768] [--shots <dir>] [--ui-wait 12000] [--chrome <path>]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const base=arg('--base','http://127.0.0.1:4810'),players=String(arg('--player','')).split(',').filter(Boolean),shots=arg('--shots'),uiWait=Number(arg('--ui-wait','0'));
const sizes=String(arg('--sizes','390x844m,1366x768')).split(',').map(s=>{const m=s.match(/^(\d+)x(\d+)(m?)$/);return {W:+m[1],H:+m[2],mobile:!!m[3],label:m[3]?'phone':s==='1366x768'?'chromebook':s};});
const chrome=arg('--chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const RULES={standing:0.9,rider:0.55,riderHead:0.95};
// Runs in the page: what share of each character on the current page can be seen.
const MEASURE=`(async()=>{
 const page=[...document.querySelectorAll('.bk-page')].at(-1),W=innerWidth,H=innerHeight;if(!page)return null;
 const occ=[...document.querySelectorAll('.bk img:not(.bk-bg),.bk-caption,.bk-magic,.bk-btn,.bk-board,.bk-glyph,.bk-thing,.bk-plate,.bk-pizza,.bk-slots span,.bk-quest,.bk-exit,.bk-hear,.bk-ball,.bk-mic,.bk-listen,.bk-card')]
  .filter(e=>!e.closest('.bk-fx')&&!e.closest('.bk-page.out')&&(()=>{const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05;})());
 const masks=new Map();
 async function mask(img){let m=masks.get(img);if(m)return m;await img.decode().catch(()=>{});const r=img.getBoundingClientRect(),cw=Math.max(1,Math.round(r.width)),ch=Math.max(1,Math.round(r.height));
  const cv=new OffscreenCanvas(cw,ch),g=cv.getContext('2d');try{g.drawImage(img,0,0,cw,ch);}catch{}m={r,cw,ch,d:g.getImageData(0,0,cw,ch).data};masks.set(img,m);return m;}
 async function alpha(img,x,y){const clip=img.closest('.bk-car');if(clip){const c=clip.getBoundingClientRect();if(x<c.left||x>=c.right||y<c.top||y>=c.bottom)return 0;}
  const m=await mask(img),ix=Math.floor(x-m.r.left),iy=Math.floor(y-m.r.top);return ix<0||iy<0||ix>=m.cw||iy>=m.ch?0:m.d[(iy*m.cw+ix)*4+3];}
 const out=[];
 for(const el of page.querySelectorAll('.bk-actor')){const img=el.querySelector('img');if(!img)continue;const m=await mask(img),step=Math.max(2,Math.min(m.cw,m.ch)/36);
  const above=occ.filter(o=>o!==img&&!el.contains(o)&&(img.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING||o.classList.contains('bk-ball')));
  const pts=[];for(let y=m.r.top+step/2;y<m.r.bottom;y+=step)for(let x=m.r.left+step/2;x<m.r.right;x+=step)if(m.d[(Math.floor(y-m.r.top)*m.cw+Math.floor(x-m.r.left))*4+3]>96)pts.push([x,y]);
  if(!pts.length)continue;const top=Math.min(...pts.map(p=>p[1])),bot=Math.max(...pts.map(p=>p[1])),mid=top+(bot-top)*0.5;
  let seen=0,headN=0,headSeen=0;const by={};
  for(const [x,y] of pts){let hid=x<0||y<0||x>=W||y>=H?'off-screen':null;
   if(!hid)for(const o of above){const r=o.getBoundingClientRect();if(x<r.left||x>=r.right||y<r.top||y>=r.bottom)continue;
    if(o.tagName==='IMG'){if(await alpha(o,x,y)>96){hid=o.closest('.bk-car')?'wagon:'+(o.closest('.bk-car').className):o.closest('.bk-actor')?'actor:'+o.closest('.bk-actor').dataset.id:'prop';break;}}
    else{hid=o.className.split(' ')[0]||o.tagName;break;}}
   if(!hid)seen++;else by[hid]=(by[hid]||0)+1;if(y<=mid){headN++;if(!hid)headSeen++;}}
  out.push({id:el.dataset.id,rider:el.classList.contains('rider'),share:+(seen/pts.length).toFixed(3),head:+(headSeen/Math.max(1,headN)).toFixed(3),hiddenBy:by});}
 return out;})()`;
const report={ok:true,checked:0,failures:[],pages:[]};
for(const size of sizes){
 const profile=await mkdtemp(join(tmpdir(),'book-layout-chrome-'));
 const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--mute-audio',`--window-size=${size.W},${size.H}`,'about:blank'],{stdio:'ignore'});
 try{
  let port=null;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
  if(!port)throw Error('Chrome did not start');
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  let seq=0;const waiting=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}};
  const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(method+' timed out'));},30000);});
  const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'eval failed');return r.result.value;};
  const until=async(e,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(await js(e))return true;await sleep(150);}return false;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:size.W,height:size.H,deviceScaleFactor:size.mobile?2:1,mobile:size.mobile});
  for(const player of players){
   const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json()).chapter;if(!ch)throw Error('no chapter for '+player);
   await send('Page.navigate',{url:`${base}/?player=admin#book/${player}`});
   if(!await until(`!!document.querySelector('.bk-open')&&typeof __bookGo==='function'`,20000))throw Error('the book did not open');
   for(let i=0;i<ch.pages.length;i++){
    await js(`__bookGo(${i})`);await sleep(1800);
    // Freeze only what is running (resuming a finished entry animation would replay it).
    const freeze=`(()=>{window.__frozen=document.getAnimations().filter(a=>a.playState==='running');window.__frozen.forEach(a=>{try{a.pause()}catch{}});return 1})()`,thaw=`(window.__frozen||[]).forEach(a=>{try{a.play()}catch{}})`;
    const stages=[['scene',await js(freeze)&&await js(MEASURE)]];
    if(shots){await mkdir(shots,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(shots,`${player}-${size.label}-p${i+1}.png`),Buffer.from(r.data,'base64'));}
    await js(thaw);
    if(uiWait&&(ch.pages[i].beat||ch.pages[i].magic||ch.pages[i].action)&&await until(`!!document.querySelector('.bk-page:last-child .bk-play button,.bk-magic,.bk-glyph,.bk-ball,.bk-btn.go')`,uiWait)){
     await sleep(600);await js(freeze);stages.push(['ui',await js(MEASURE)]);await js(thaw);}
    for(const [stage,res] of stages){for(const a of res||[]){report.checked++;
     const bad=a.rider?(a.share<RULES.rider||a.head<RULES.riderHead):a.share<RULES.standing;
     const row={player,size:size.label,page:i+1,stage,...a};report.pages.push(row);if(bad){report.ok=false;report.failures.push(row);}}}
   }
  }
  ws.close();
 }finally{proc.kill();await sleep(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
}
console.log(JSON.stringify({ok:report.ok,checked:report.checked,failures:report.failures,worst:report.pages.sort((a,b)=>a.share-b.share).slice(0,8)},null,1));
process.exit(report.ok?0:1);
