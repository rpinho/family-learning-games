#!/usr/bin/env node
// Turning the phone must never mess up the book: open a page (a story page, a page with a game waiting, a kick),
// rotate 5 times between portrait and landscape (412x915 <-> 915x412, a resize plus an orientationchange each time),
// then compare with a fresh load of the same page at the final size: every friend, prop, ball and the goal in the same
// place (within 3% of the screen), one page, one scene layer, nobody twice. Headless Chrome (muted, device voice
// stubbed), read-only grown-ups' preview. Usage: node hub/scripts/check-rotate.mjs --base URL --player id
//   [--pages 1,5,9] [--shots dir] [--sizes 412x915,915x412] [--json]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const base=arg('--base','http://127.0.0.1:5325'),player=arg('--player','diogo'),shots=arg('--shots');
const [A,B]=arg('--sizes','412x915,915x412').split(',').map(s=>s.split('x').map(Number));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json()).chapter;if(!ch)throw Error('no chapter');
// Pages: the first page, a page with a game, a kick page if any (or the one given).
const pick=arg('--pages')?arg('--pages').split(',').map(Number):[1,ch.pages.findIndex(p=>p.beat&&p.beat.kind!=='teach-letter')+1,ch.pages.findIndex(p=>p.action?.kind==='kick'||p.beat?.kind==='kick-letter')+1].filter((x,i,a)=>x>0&&a.indexOf(x)===i);
const profile=await mkdtemp(join(tmpdir(),'rotate-'));
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
const t=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const w=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){w.get(m.id)(m);w.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const id=++seq;w.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:NO_DEVICE_VOICE});
const size=async([W,H])=>{await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});await js(`dispatchEvent(new Event('orientationchange'))`);};
const until=async(e,ms=30000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await js(e).catch(()=>false))return true;await sleep(150);}return false;};
// What is on screen, as fractions of the screen.
const SNAP=`(()=>{const R=document.querySelector('.bk').getBoundingClientRect(),f=e=>{const r=e.getBoundingClientRect();return [(r.left-R.left)/R.width,(r.top-R.top)/R.height,r.width/R.width,r.height/R.height].map(x=>Math.round(x*1000)/1000);};
 const pg=document.querySelector('.bk-view .bk-page:last-child');if(!pg)return null;
 const actors=[...pg.querySelectorAll('.bk-actor')].map(a=>({id:a.dataset.id,pose:a.dataset.pose,r:f(a)}));
 return {pages:document.querySelectorAll('.bk-view .bk-page').length,layers:pg.querySelectorAll('.bk-layer').length,actors,
  props:[...pg.querySelectorAll('.bk-layer > .bk-prop')].map(f),balls:[...pg.querySelectorAll('.bk-ball')].map(b=>({v:b.dataset.v||'',r:f(b)})),goal:[...pg.querySelectorAll('.bk-goal')].map(f),
  dup:actors.map(a=>a.id).filter((x,i,a)=>a.indexOf(x)!==i),dv:(globalThis.__deviceVoice||[]).length};})()`;
async function open(pageNo,sz){await size(sz);await send('Page.navigate',{url:`${base}/?player=admin&r=${Date.now()}#book/${player}/p${pageNo}`});
 await until(`!!document.querySelector('.bk-open')`,20000);await js(`document.querySelector('.bk-open').click()`);
 const p=ch.pages[pageNo-1];const ready=p.beat?(p.beat.kind==='kick-letter'?'.bk-ball':'.bk-play .bk-btn,.bk-thing,.bk-box,.bk-pizza,.bk-glyph,.bk-btn.stone'):p.action?'.bk-ball':'.bk-actor';
 await until(`document.querySelectorAll('.bk-view .bk-page').length===1&&!!document.querySelector('.bk-view .bk-page:last-child ${ready.split(',').join(', .bk-view .bk-page:last-child ')}')`,40000);await sleep(1200);}
const near=(a,b,tol=0.03)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<=tol);
const results=[];
for(const pageNo of pick){
 await open(pageNo,A);
 let s=A;for(let k=0;k<5;k++){s=s===A?B:A;await size(s);await sleep(700);}
 await sleep(800);const after=await js(SNAP);
 if(shots)await writeFile(join(shots,`rotate-${player}-p${pageNo}-after-5-turns.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 await open(pageNo,s);const fresh=await js(SNAP);
 if(shots)await writeFile(join(shots,`rotate-${player}-p${pageNo}-fresh.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 const issues=[];
 if(!after)issues.push('no page after rotating');else{
  if(after.pages!==1)issues.push(`${after.pages} pages stacked`);if(after.layers!==1)issues.push(`${after.layers} scene layers`);if(after.dup.length)issues.push(`twice: ${after.dup.join(',')}`);if(after.dv)issues.push('device voice');
  for(const a of fresh.actors){const b=after.actors.find(x=>x.id===a.id);if(!b)issues.push(`${a.id} missing`);else if(!near(a.r,b.r))issues.push(`${a.id} at ${b.r} (fresh ${a.r})`);}
  if(after.actors.length!==fresh.actors.length)issues.push(`${after.actors.length} friends (fresh ${fresh.actors.length})`);
  if(after.props.length!==fresh.props.length||!after.props.every((r,i)=>near(r,fresh.props[i])))issues.push('props moved');
  if(after.balls.length!==fresh.balls.length||!after.balls.every((b,i)=>near(b.r,fresh.balls.find(x=>x.v===b.v)?.r||[])))issues.push(`balls ${JSON.stringify(after.balls.map(b=>b.r))} vs ${JSON.stringify(fresh.balls.map(b=>b.r))}`);
  if(after.goal.length!==fresh.goal.length||!after.goal.every((r,i)=>near(r,fresh.goal[i])))issues.push('goal moved');}
 results.push({page:pageNo,kind:ch.pages[pageNo-1].beat?.kind||ch.pages[pageNo-1].action?.kind||'story',ok:!issues.length,issues});
 if(!args.includes('--json'))console.log(`${issues.length?'FAIL':'ok  '} ${player} p${pageNo} (${results.at(-1).kind}) ${issues.join('; ')}`);
}
ws.close();chrome.kill();await sleep(200);await rm(profile,{recursive:true,force:true}).catch(()=>{});
const bad=results.filter(r=>!r.ok);if(args.includes('--json'))console.log(JSON.stringify({ok:!bad.length,results}));
process.exit(bad.length?1:0);
