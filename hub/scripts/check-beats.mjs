#!/usr/bin/env node
// No dead ends: every beat type, for both kinds of book (a letters book and a quest-style reader's book, plus the
// classic reader beats), is played in a real browser four ways: the right answer, wrong answers, no input at all,
// and "Hear it again" (🔊) pressed mid-beat before answering (the 2026-09-28 jam). Each run must end with the page
// finished or with "tap to go on" showing. Headless Chrome, muted, device voice stubbed (a call is a failure);
// clips are not served (the silent path), and the book's timings are sped up (globalThis.__bookFast).
// Usage: node hub/scripts/check-beats.mjs [--only kind,kind] [--scenario right,wrong,none,replay] [--json]
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,extname,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planChapter} from '../../book/plan.mjs';
import {templateChapter} from '../../book/template.mjs';
import {assemble} from '../../book/assemble.mjs';
import {actorIdsFor} from '../../book/generate.mjs';
import {young,older} from '../../book/tests/fixtures.mjs';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const args0=process.argv.slice(2),pubArg=args0.indexOf('--public');
// --public <dir>: test another build of the book (e.g. a release), to prove a fix.
const pub=pubArg>=0?args0[pubArg+1]:join(here,'..','public');
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const only=arg('--only')?.split(','),scenarios=(arg('--scenario')||'right,wrong,none,replay').split(',');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const FAST=10;

// The chapters: a letters book (Diogo-like, with and without soccer), a quest reader (several days, so every
// puzzle variant shows up) and a classic reader (share/score).
const library=JSON.parse(await readFile(join(pub,'book-art','library.json'),'utf8'));
function chapterFor(model,profile,date){const p=planChapter(model,{date,profile});p.actorIds=actorIdsFor(p,library);return assemble(templateChapter(p,library),p,{library,actors:p.actorIds.all});}
const books=[];
for(const d of ['2026-03-10','2026-03-11'])books.push({who:'letters',ch:chapterFor({...young,interests:d.endsWith('0')?['soccer']:[]},{},d)});
for(const d of ['2026-03-10','2026-03-11','2026-03-12','2026-03-13','2026-03-14','2026-03-15'])books.push({who:'quest',ch:chapterFor(older,{bookStyle:'quest',bookTheme:'spellbook'},d)});
// The place-value NO! beat (Sage flags place value: the 2026-09-28 jam) and the football play card.
books.push({who:'quest',ch:chapterFor({...older,sage:{practising:['place value']}},{bookStyle:'quest',details:[{id:'american football',seed:'football'}]},'2026-03-16')});
for(const d of ['2026-03-10','2026-03-11','2026-03-12','2026-03-13'])books.push({who:'reader',ch:chapterFor(older,{},d)});
// A reader without division practice gets the scoreboard (score) instead of sharing.
books.push({who:'reader',ch:chapterFor({...older,math:{...older.math,hardShares:[]}},{},'2026-03-10')});
// One case per beat kind and variant (the first book that has it).
const cases=[],seen=new Set();
for(const {who,ch} of books)ch.pages.forEach((p,i)=>{if(!p.beat)return;const k=`${p.beat.kind}${p.beat.variant?':'+p.beat.variant:''}${p.beat.kind==='no'?':'+(p.beat.pv?'place-value':who):''}`;if(seen.has(k)||(only&&!only.includes(p.beat.kind)))return;seen.add(k);cases.push({who,key:k,ch,page:i,b:p.beat});});

// A tiny server: the book's code and a stubbed book API (nothing saved; clips 404, so every line is the silent path).
let current=null;
const types={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.html':'text/html'};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');
 if(u.pathname==='/api/book'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({date:'2026-03-10',chapter:current.ch,progress:{page:current.page,finished:false},collection:{keys:[],words:[]},open:true}));}
 if(u.pathname.startsWith('/api/')){let b='';for await(const c of req)b+=c;res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"ok":true}');}
 if(u.pathname==='/harness.html'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(`<!doctype html><meta name=viewport content="width=device-width"><link rel=stylesheet href=/book.css><body style="margin:0"><main id=main></main><script>globalThis.__bookFast=${FAST};${NO_DEVICE_VOICE}</script><script type=module>import {mountBook,loadBook} from '/book.mjs';const book=await loadBook('kid');window.__mounted=true;mountBook(document.getElementById('main'),{player:'kid',book});</script>`);}
 const f=normalize(join(pub,u.pathname));if(!f.startsWith(pub)){res.writeHead(404);return res.end();}
 try{const b=await readFile(f);res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;

// One headless Chrome for the whole run.
const profile=await mkdtemp(join(tmpdir(),'beats-'));
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','--window-size=412,915','about:blank'],{stdio:'ignore'});
let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const waiting=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){waiting.get(m.id)(m);waiting.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const id=++seq;waiting.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});
const until=async(e,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(await js(e).catch(()=>false))return true;await sleep(100);}return false;};
// Real input (pointer events go through the page, so the book sees him touch the screen).
const tapAt=async(x,y)=>{for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});};
const tap=async sel=>{const r=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!r)return false;await tapAt(r.x,r.y);return true;};
const swipe=async sel=>{const r=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!r)return false;
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+30,y:r.y-60,button:'left'});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+40,y:r.y-120,button:'left',clickCount:1});return true;};
const ans=v=>`.bk-play [data-v="${String(v).replace(/"/g,'\\"')}"]`;
const finished=`document.querySelector('.bk-tapnext.on')!==null`;
// Ready: the beat's own controls are there (the page's lines were said).
const READY={'teach-letter':'.bk-glyph','kick-letter':'.bk-ball','stones':'.bk-btn.stone','count':'.bk-thing','signs':'.bk-play .bk-btn','spell':'.bk-play .bk-btn.word','share':'.bk-pizza','score':'.bk-play .bk-btn','puzzle':'.bk-play .bk-btn','remainder':'.bk-box','fork':'.bk-btn.fork','no':'.bk-btn.no','order':'.bk-play .bk-btn.ball'};
async function right(b){
 switch(b.kind){
  case 'teach-letter':for(let k=0;k<6&&!(await js(finished));k++){await tap('.bk-glyph');await sleep(700);}return;
  case 'order':for(let k=1;k<=5;k++){await tap(`.bk-play [data-v="${k}"]`);await sleep(250);}return;
  case 'stones':for(let k=0;k<b.need;k++){await js(`(()=>{const s=[...document.querySelectorAll('.bk-btn.stone')].find(x=>x.textContent===${JSON.stringify(b.letter)}&&!x.classList.contains('lit'));s&&s.click()})()`);await sleep(300);}return;
  case 'count':for(let k=0;k<b.n;k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-thing')].find(x=>!x.dataset.n);t&&t.click()})()`);await sleep(300);}await until(`!!document.querySelector('${ans(b.answer)}')`);await tap(ans(b.answer));return;
  case 'kick-letter':await swipe(`.bk-ball[data-v="${b.letter}"]`)||await swipe('.bk-ball');return;
  case 'signs':return void await tap(ans(b.target));
  case 'spell':for(const w of b.answer){await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn.word')].find(x=>x.textContent===${JSON.stringify(w)}&&!x.classList.contains('used'));t&&t.click()})()`);await sleep(200);}return;
  case 'share':for(let k=0;k<Math.ceil(b.total/b.groups);k++){await tap('.bk-pizza');await sleep(120);}await until(`!!document.querySelector('${ans(b.answer)}')`);return void await tap(ans(b.answer));
  case 'remainder':for(let k=0;k<Math.floor(b.total/b.groups);k++){await tap('.bk-box');await sleep(150);}await until(`!!document.querySelector('${ans(b.answer)}')`);return void await tap(ans(b.answer));
  case 'fork':return void await tap('.bk-btn.fork');
  case 'no':await tap('.bk-btn.no');await until(`!!document.querySelector('${ans(b.right)}')`);return void await tap(ans(b.right));
  default:return void await tap(ans(b.answer));
 }
}
async function wrong(b){
 const w=(b.options||b.balls||b.stones||[]).map(String).find(v=>v!==String(b.answer??b.right??b.target??b.letter));
 switch(b.kind){
  case 'no':for(let k=0;k<3;k++){await until(`!!document.querySelector('.bk-btn.ok')`,8000);await tap('.bk-btn.ok');await sleep(300);}
   await until(`!!document.querySelector('${ans(b.wrong)}')`);for(let k=0;k<6&&!(await js(finished));k++){await tap(ans(b.wrong));await sleep(400);}return;
  case 'count':for(let k=0;k<b.n;k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-thing')].find(x=>!x.dataset.n);t&&t.click()})()`);await sleep(300);}await until(`document.querySelectorAll('.bk-play .bk-btn').length>1`);
   for(let k=0;k<6&&!(await js(finished));k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn')].find(x=>x.dataset.v!==${JSON.stringify(String(b.answer))});t&&t.click()})()`);await sleep(400);}return;
  case 'share':case 'remainder':{const sel=b.kind==='share'?'.bk-pizza':'.bk-box';for(let k=0;k<Math.ceil(b.total/b.groups);k++){await tap(sel);await sleep(120);}await until(`document.querySelectorAll('.bk-play .bk-btn').length>1`);
   for(let k=0;k<6&&!(await js(finished));k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn')].find(x=>x.dataset.v!==${JSON.stringify(String(b.answer))});t&&t.click()})()`);await sleep(400);}return;}
  case 'stones':for(let k=0;k<6&&!(await js(finished));k++){await js(`(()=>{const s=[...document.querySelectorAll('.bk-btn.stone')].find(x=>x.textContent!==${JSON.stringify(b.letter)});s&&s.click()})()`);await sleep(400);}return;
  case 'kick-letter':for(let k=0;k<3;k++){await js(`(()=>{const s=[...document.querySelectorAll('.bk-ball')].find(x=>x.dataset.v&&x.dataset.v!==${JSON.stringify(b.letter)});return !!s})()`);const sel=await js(`(()=>{const s=[...document.querySelectorAll('.bk-ball')].findIndex(x=>x.dataset.v&&x.dataset.v!==${JSON.stringify(b.letter)});return s})()`);if(sel>=0)await swipe(`.bk-ball:nth-of-type(${sel+1})`);await sleep(600);}return;
  case 'teach-letter':case 'fork':return;   // nothing to get wrong (the rescue must still come)
  case 'spell':for(let k=0;k<6&&!(await js(finished));k++){await js(`(()=>{const ts=[...document.querySelectorAll('.bk-play .bk-btn.word')].filter(x=>!x.classList.contains('used'));const t=ts.at(-1);t&&t.click()})()`);await sleep(300);}return;
  default:for(let k=0;k<6&&!(await js(finished));k++){if(w)await tap(ans(w));await sleep(400);}
 }
}
const results=[];
for(const c of cases)for(const sc of scenarios){
 current=c;const t0=Date.now();let ok=false,why='';
 try{
  await send('Page.navigate',{url:`${base}/harness.html?${Date.now()}`});
  if(!await until(`!!document.querySelector('.bk')`,15000))throw Error('book did not mount');
  await js(`document.querySelector('.bk-open')?.click()`);
  if(!await until(`!!document.querySelector(${JSON.stringify(READY[c.b.kind]||'.bk-play .bk-btn')})`,30000))throw Error('beat controls never appeared');
  await sleep(300);
  if(sc==='replay'){await tap('.bk-hear');await sleep(800);await right(c.b);}
  else if(sc==='right')await right(c.b);
  else if(sc==='wrong')await wrong(c.b);
  // Finished: the page can be left ("tap to go on"), or it already moved on.
  ok=await until(`${finished}||[...document.querySelectorAll('.bk-dots i')].findIndex(i=>i.classList.contains('now'))!==${c.page}`,sc==='none'||sc==='wrong'?30000:20000);
  if(!ok)why=`stuck: ${await js(`JSON.stringify({btns:[...document.querySelectorAll('.bk-play .bk-btn')].map(b=>b.textContent).slice(0,6),next:!!document.querySelector('.bk-tapnext.on')})`)}`;
  const dv=await js(`(globalThis.__deviceVoice||[]).length`);if(dv){ok=false;why+=` device voice used (${dv})`;}
 }catch(e){ok=false;why=e.message;}
 results.push({book:c.who,beat:c.key,scenario:sc,ok,ms:Date.now()-t0,...(why?{why}:{})});
 if(!args.includes('--json'))console.log(`${ok?'ok  ':'FAIL'} ${c.who.padEnd(7)} ${c.key.padEnd(18)} ${sc.padEnd(7)} ${Date.now()-t0} ms ${why}`);
}
ws.close();chrome.kill();server.close();await sleep(200);await rm(profile,{recursive:true,force:true}).catch(()=>{});
const bad=results.filter(r=>!r.ok);
if(args.includes('--json'))console.log(JSON.stringify({ok:!bad.length,checked:results.length,failures:bad}));
else console.log(`${results.length} runs, ${bad.length} failed`);
process.exit(bad.length?1:0);
