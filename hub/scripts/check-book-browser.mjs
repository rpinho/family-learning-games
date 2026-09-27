#!/usr/bin/env node
// Browser check for The Book: opens a child's chapter in a headless Chrome with its own profile and the
// real autoplay rule (sound needs one user gesture), taps the cover ONCE with a trusted tap, then lets the
// book run: story pages turn on their own, beats are solved by script clicks (untrusted, so they grant no
// new permission). It verifies that each page turn plays that page's narration straight away, that no
// play() is refused, and saves screenshots. Uses the grown-ups' preview, so nothing is saved.
// Usage: node hub/scripts/check-book-browser.mjs --base http://127.0.0.1:5325 --player <id> [--size 390x844]
//        [--mobile] [--shots <dir>] [--shot-pages 0,3] [--label phone] [--chrome <path>]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const base=arg('--base','http://127.0.0.1:4810'),player=arg('--player'),[W,H]=arg('--size','1366x768').split('x').map(Number),mobile=flag('--mobile');
const shots=arg('--shots'),shotPages=new Set((arg('--shot-pages','')||'').split(',').filter(Boolean).map(Number)),label=arg('--label',`${W}x${H}`);
const chrome=arg('--chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=await mkdtemp(join(tmpdir(),'book-check-chrome-'));
const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--autoplay-policy=document-user-activation-required','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
let port=null;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
if(!port){proc.kill();throw Error('Chrome did not start');}
const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let seq=0;const waiting=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}};
const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(`${method} timed out`));},20000);});
const js=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'eval failed');return r.result.value;};
const until=async(expr,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){if(await js(expr))return true;await sleep(150);}return false;};
setTimeout(()=>{console.log(JSON.stringify({player,label,ok:false,errors:['overall timeout']}));proc.kill();process.exit(1);},8*60000).unref();
const result={player,label,size:`${W}x${H}`,pages:[],refused:0,beforeTap:null,errors:[]};
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:mobile?2:1,mobile});
 if(mobile)await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const book=await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json();const ch=book.chapter;if(!ch)throw Error('no chapter');
 await send('Page.navigate',{url:`${base}/?player=admin#book/${player}`});
 if(!await until(`!!document.querySelector('.bk-open')`,20000))throw Error('the book did not open');
 // Control: before any tap, the browser must refuse sound (so the check below means something).
 const clip=ch.cover.line.clip;result.beforeTap=await js(`(async()=>{try{await new Audio('/book-voice/${clip}').play();return 'played'}catch(e){return e.name}})()`);
 const shot=async name=>{if(!shots)return;await mkdir(shots,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(shots,name),Buffer.from(r.data,'base64'));};
 await shot(`${player}-${label}-cover.png`);
 const rect=await js(`(()=>{const r=document.querySelector('.bk-open').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:rect.x,y:rect.y,button:'left',clickCount:1});
 const click=sel=>js(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(b){b.click();return true}return false})()`);
 // Balls are flicked: pointer down then up (script events, no new permission).
 const flickEl=expr=>js(`(()=>{const b=${expr};if(!b)return false;const r=b.getBoundingClientRect(),o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1};b.dispatchEvent(new PointerEvent('pointerdown',o));b.dispatchEvent(new PointerEvent('pointerup',{...o,clientY:o.clientY-120,clientX:o.clientX+40}));return true})()`);
 const nowPage=()=>js(`[...document.querySelectorAll('.bk-dots i')].findIndex(i=>i.classList.contains('now'))`);
 for(let i=0;i<ch.pages.length;i++){
  const p=ch.pages[i],t0=Date.now();
  if(!await until(`(${await nowPage()}===${i})||[...document.querySelectorAll('.bk-dots i')].findIndex(i=>i.classList.contains('now'))===${i}`,40000)){result.errors.push(`page ${i+1} never came`);break;}
  const played=await until(`__bookAudio.some(a=>a.page===${i}&&a.ok)`,12000);
  // Time from the page turn to the first narration that the browser allowed to play.
  const lat=await js(`(()=>{const s=__bookAudio.filter(a=>a.page===${i}&&a.shown).at(-1),f=__bookAudio.find(a=>a.page===${i}&&a.ok&&a.at>=(s?s.shown:0));return s&&f?f.at-s.shown:null})()`);
  result.pages.push({page:i+1,kind:p.beat?.kind||(p.action?'action:'+p.action.kind:p.magic?'magic':'story'),bg:p.scene.bg,played,msToFirstSound:lat});
  if(shotPages.has(i)){await sleep(1200);await shot(`${player}-${label}-p${i+1}-${p.beat?.kind||p.scene.bg}.png`);}
  const b=p.beat;
  if(p.action){const k=p.action.kind;
   if(k==='drive'){await until(`!!document.querySelector('.bk-btn.go')`,40000);await click('.bk-btn.go');}
   else{await until(`!!document.querySelector('.bk-ball')`,40000);await sleep(300);await flickEl(`document.querySelector('.bk-ball')`);}
   if(shotPages.has(i)){await sleep(700);await shot(`${player}-${label}-p${i+1}-${k}-action.png`);}}
  // With a recogniser the word is a talk button: the fake microphone plays a tone, so it takes the misses and the
  // narrator's help before anything counts; keep tapping, like a child would, until the page moves on.
  const tapUntilNext=async sel=>{for(let k=0;k<8;k++){if(await nowPage()!==i)return;await click(sel);if(await until(`[...document.querySelectorAll('.bk-dots i')].findIndex(x=>x.classList.contains('now'))!==${i}||!!document.querySelector('.bk-card')`,9000))break;}if(await js(`!!document.querySelector('.bk-card')`))await click('.bk-card [data-a="tap"]');};
  if(p.magic){await until(`!!document.querySelector('.bk-magic')`,30000);await sleep(400);await tapUntilNext('.bk-magic');}
  if(b){
   const ans=v=>`.bk-play [data-v="${String(v).replace(/"/g,'\\"')}"]`;
   if(b.kind==='teach-letter'){await until(`!!document.querySelector('.bk-glyph')`,30000);
    // The trace step (if any): three taps without tracing move on, like a child who taps instead.
    if(await until(`!!document.querySelector('.bk-trace')`,25000)){for(let k=0;k<3;k++){await js(`(()=>{const c=document.querySelector('.bk-trace');if(!c)return;const r=c.getBoundingClientRect(),o={bubbles:true,clientX:r.x+5,clientY:r.y+5,pointerId:1};c.dispatchEvent(new PointerEvent('pointerdown',o));c.dispatchEvent(new PointerEvent('pointerup',o));})()`);await sleep(150);}}
    await sleep(1500);await tapUntilNext('.bk-glyph');}
   if(b.kind==='order'){await until(`document.querySelectorAll('.bk-play .bk-btn.ball').length>=5`,30000);for(let k=1;k<=5;k++){await click(`.bk-play [data-v="${k}"]`);await sleep(700);}}
   if(b.kind==='stones'){await until(`document.querySelectorAll('.bk-btn.stone').length>0`,30000);for(let k=0;k<b.need;k++){await js(`(()=>{const s=[...document.querySelectorAll('.bk-btn.stone')].find(x=>x.textContent===${JSON.stringify(b.letter)}&&!x.classList.contains('lit'));s&&s.click()})()`);await sleep(700);}}
   if(b.kind==='count'){await until(`document.querySelectorAll('.bk-thing').length===${b.n}`,30000);for(let k=0;k<b.n;k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-thing')].find(x=>!x.dataset.n);t&&t.click()})()`);await sleep(900);}await until(`!!document.querySelector('${ans(b.answer)}')`,20000);await click(ans(b.answer));}
   if(b.kind==='kick-letter'){await until(`document.querySelectorAll('.bk-ball').length>=${b.balls.length}`,30000);await sleep(300);await flickEl(`[...document.querySelectorAll('.bk-ball')].find(x=>x.dataset.v===${JSON.stringify(b.letter)})`);if(shotPages.has(i)){await sleep(500);await shot(`${player}-${label}-p${i+1}-kick-letter-goal.png`);}}
   if(b.kind==='signs'){await until(`!!document.querySelector('${ans(b.target)}')`,30000);await click(ans(b.target));}
   if(b.kind==='spell'){await until(`document.querySelectorAll('.bk-play .bk-btn.word').length>0`,30000);for(const w of b.answer){await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn.word')].find(x=>x.textContent===${JSON.stringify(w)}&&!x.classList.contains('used'));t&&t.click()})()`);await sleep(250);}}
   if(b.kind==='share'){await until(`!!document.querySelector('.bk-pizza')`,30000);for(let k=0;k<Math.ceil(b.total/b.groups);k++){await click('.bk-pizza');await sleep(120);}await until(`!!document.querySelector('${ans(b.answer)}')`,20000);await click(ans(b.answer));}
   if(b.kind==='score'){await until(`!!document.querySelector('${ans(b.answer)}')`,30000);await click(ans(b.answer));}
   if(b.kind==='no'){await until(`!!document.querySelector('.bk-btn.no')`,30000);if(shotPages.has(i))await shot(`${player}-${label}-p${i+1}-no-beat.png`);await click('.bk-btn.no');await until(`!!document.querySelector('${ans(b.right)}')`,30000);await click(ans(b.right));}
  }
 }
 if(await until(`!!document.querySelector('.bk-quest')`,40000)){await sleep(800);await shot(`${player}-${label}-end.png`);result.ended=true;}
 const audit=await js('__bookAudio');result.refused=audit.filter(a=>a.clip&&!a.ok&&a.err!=='AbortError').length;result.interrupted=audit.filter(a=>a.err==='AbortError').length;result.failures=audit.filter(a=>a.clip&&!a.ok&&a.err!=='AbortError');result.plays=audit.filter(a=>a.clip&&a.ok).length;
 result.ok=result.beforeTap==='NotAllowedError'&&result.pages.length===ch.pages.length&&result.pages.every(p=>p.played)&&result.refused===0&&result.ended===true&&!result.errors.length;
}catch(e){result.errors.push(String(e.message||e));result.ok=false;}
finally{try{ws.close();}catch{}proc.kill();}
console.log(JSON.stringify(result));
process.exit(result.ok?0:1);
