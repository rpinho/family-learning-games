#!/usr/bin/env node
// Does every page of the book read as one picture, on every screen? Opens every page of a player's chapter at phone
// portrait, phone landscape and Chromebook size and measures what is on screen:
//   - nobody overlaps anybody in the same row, and nobody overlaps a prop (a margin between; nobody stands on the
//     pizza); a back-row friend may stand behind a child, but nobody hides his face (half of it or more);
//   - the game's buttons, board and things never cover anybody;
//   - relative heights: Dad > Mom > the boys > the plush friends, Dad about 1.35x Diogo, a ball knee-high to a boy;
//   - big enough: Diogo (else the youngest boy) at least 18% of a tall screen's height, 28% of a wide one's;
//   - one ground line (and one back-row line): every friend and prop that is not flying has its feet on it;
//   - stars and hearts stay in the sky (never over a face or a body);
//   - everybody on screen (nobody cut off at the sides).
// Fails (exit 1) on any violation. Headless Chrome, muted, device voice stubbed, read-only grown-ups' preview.
// Usage: node hub/scripts/check-composition.mjs --base URL [--players diogo,francisco] [--sizes 412x915,915x412,1366x768]
//   [--pages 1,5] [--date YYYY-MM-DD] [--shots dir] [--json] [--dump]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';
import {PEOPLE,PROP_REL,BACK_SCALE} from '../public/book-scene.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const base=arg('--base','http://127.0.0.1:5325'),players=arg('--players','diogo,francisco').split(','),shots=arg('--shots');
const sizes=arg('--sizes','412x915,915x412,1366x768').split(',').map(s=>s.split('x').map(Number));
const only=arg('--pages')?arg('--pages').split(',').map(Number):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(shots)await mkdir(shots,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'compose-'));
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--mute-audio','--no-first-run','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
let port;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
const t=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let seq=0;const w=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){w.get(m.id)(m);w.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const id=++seq;w.set(id,r);ws.send(JSON.stringify({id,method,params}));});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');await send('Runtime.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:NO_DEVICE_VOICE});
const until=async(e,ms=30000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await js(e).catch(()=>false))return true;await sleep(150);}return false;};
// What is on screen, in pixels (layout boxes, not the bob/sway animation).
const SNAP=`(()=>{const R=document.querySelector('.bk').getBoundingClientRect(),pg=document.querySelector('.bk-view .bk-page:last-child');if(!pg)return null;
 const box=e=>{let x=0,y=0,n=e;while(n&&n!==pg){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent;}return {x,y,w:e.offsetWidth,h:e.offsetHeight};};
 const train=!!pg.querySelector('.bk-prop.train');
 return {W:R.width,H:R.height,train,
  actors:[...pg.querySelectorAll('.bk-actor')].map(a=>({id:a.dataset.id,pose:a.dataset.pose,fly:a.classList.contains('fly'),keeper:a.classList.contains('keeper-ready'),rider:!!a.closest('.bk-prop.train')||a.classList.contains('rider'),depth:Number(a.dataset.depth||0),...box(a)})),
  props:[...pg.querySelectorAll('.bk-layer > .bk-prop')].map(p=>({id:p.dataset.id||'',train:p.classList.contains('train'),...box(p)})),
  balls:[...pg.querySelectorAll('.bk-ball:not(.used)')].map(box),goal:[...pg.querySelectorAll('.bk-goal')].map(box),
  fx:[...pg.querySelectorAll('.bk-fx:not(.burst) i')].map(box),
  ui:[...pg.querySelectorAll('.bk-play > *, .bk-board, .bk-slots, .bk-thing')].filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>{const r=e.getBoundingClientRect(),P=pg.getBoundingClientRect();return {cls:e.className.split(' ')[0],x:Math.round(r.left-P.left),y:Math.round(r.top-P.top),w:Math.round(r.width),h:Math.round(r.height)};})};})()`;
async function size([W,H]){await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:W>1000?1:2,mobile:W<1000,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});}
async function open(player,ch,pageNo){await send('Page.navigate',{url:`${base}/?player=admin&r=${Date.now()}#book/${player}/p${pageNo}${arg('--date')?`/${arg('--date')}`:''}`});
 await until(`!!document.querySelector('.bk-open')`,20000);await js(`document.querySelector('.bk-open').click()`);
 const p=ch.pages[pageNo-1];const ready=p.beat?(p.beat.kind==='kick-letter'?'.bk-ball':'.bk-play .bk-btn,.bk-thing,.bk-box,.bk-pizza,.bk-glyph,.bk-btn.stone,.bk-quest'):['kick','throw'].includes(p.action?.kind)?'.bk-ball':'.bk-actor,.bk-prop,.bk-caption';
 await until(`document.querySelectorAll('.bk-view .bk-page').length===1&&!!document.querySelector('.bk-view .bk-page:last-child ${ready.split(',').join(', .bk-view .bk-page:last-child ')}')`,40000);
 await sleep(2600);}   // the friends' walk-in (1.6s) is over, and their step aside from the game's buttons
const hit=(a,b,m=0)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;

function judge(s,p){
 if(!s)return ['no page'];
 const issues=[],M=Math.max(4,Math.min(s.W,s.H)*0.012),tall=s.H>s.W*1.05;
 const bodies=s.actors.filter(a=>!a.rider),props=s.props.filter(x=>!x.train);
 const scale=a=>a.depth?BACK_SCALE:1,head=a=>({x:a.x+a.w*0.2,y:a.y,w:a.w*0.6,h:a.h*0.3});
 const area=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)),hidden=(bk,fr)=>{const h=head(bk);return area(h,fr)>0.5*h.w*h.h;};
 // overlap: in the same row nobody overlaps anybody (a margin between); a grown-up in the back row may stand behind a
 // child, but nobody in front covers his face (the top 30% of him); props are never overlapped
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j];
  if(a.depth===b.depth){if(hit(a,b,M*0.5))issues.push(`overlap ${a.id}/${b.id}`);}
  else{const [bk,fr]=a.depth?[a,b]:[b,a];if(hidden(bk,fr))issues.push(`${fr.id} covers ${bk.id}'s face`);}}
 for(const a of bodies)for(const x of props)if(a.depth?hidden(a,x):hit(a,x,M*0.5))issues.push(`overlap ${a.id}/${x.id||'prop'}`);
 for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++)if(hit(props[i],props[j]))issues.push(`overlap ${props[i].id}/${props[j].id}`);
 for(const tr of s.props.filter(x=>x.train)){for(const x of props)if(hit(tr,x))issues.push(`${x.id||'prop'} in front of the train`);for(const a of bodies)if(hit(tr,a))issues.push(`${a.id} in front of the train`);}
 for(const a of bodies.filter(a=>!a.keeper)){for(const b of s.balls)if(hit(a,b))issues.push(`${a.id} over a ball`);for(const g of s.goal)if(hit(a,g))issues.push(`${a.id} in the goal`);}
 // the game's buttons, board and things never cover anybody
 for(const u of s.ui)for(const a of bodies)if(hit(u,a))issues.push(`${u.cls} covers ${a.id}`);
 // relative heights (true sizes: a back-row grown-up is drawn a little smaller); the keeper may be smaller (his goal)
 const sized=bodies.filter(a=>!a.keeper),hOf=id=>{const a=sized.find(a=>a.id===id);return a&&a.h/scale(a);},order=[['dad','mom'],['mom','diogo'],['mom','francisco'],['dad','diogo'],['francisco','diogo']];
 for(const [a,b] of order)if(hOf(a)&&hOf(b)&&!(hOf(a)>hOf(b)))issues.push(`${a} (${Math.round(hOf(a))}px) not taller than ${b} (${Math.round(hOf(b))}px)`);
 if(hOf('dad')&&hOf('diogo')){const r=hOf('dad')/hOf('diogo');if(r<1.25||r>1.45)issues.push(`Dad ${r.toFixed(2)}x Diogo (about 1.35x)`);}
 const people=sized.filter(a=>a.id in PEOPLE),toys=sized.filter(a=>!(a.id in PEOPLE));
 const shortest=people.filter(a=>a.id!=='hero').reduce((m,a)=>Math.min(m,a.h/scale(a)),Infinity);
 for(const toy of toys)if(Number.isFinite(shortest)&&toy.h>=shortest)issues.push(`${toy.id} (${Math.round(toy.h)}px) as tall as a person (${Math.round(shortest)}px)`);
 const units=people.map(a=>a.h/scale(a)/PEOPLE[a.id]),U=units.length?units.reduce((x,y)=>x+y)/units.length:null;
 if(units.length>1&&Math.max(...units)/Math.min(...units)>1.06)issues.push(`people not on one scale (${units.map(Math.round).join(',')})`);
 if(U)for(const x of props)if(PROP_REL[x.id]){const r=x.h/U/PROP_REL[x.id];if(r<0.6||r>1.5)issues.push(`${x.id} ${Math.round(x.h)}px (expected about ${Math.round(PROP_REL[x.id]*U)}px)`);}
 // big enough: Diogo (else the youngest boy on the page) at least 18% of a tall screen's height, 28% of a wide one's
 const kid=sized.find(a=>a.id==='diogo')||sized.find(a=>a.id==='francisco');
 if(kid){const min=tall?0.18:0.28,f=kid.h/scale(kid)/s.H;if(f<min-0.005)issues.push(`${kid.id} ${Math.round(f*100)}% of the height (at least ${min*100}%)`);}
 // one ground line (front row) and one back line
 for(const d of [0,1]){const feet=[...bodies.filter(a=>!a.fly&&!a.keeper&&a.depth===d),...(d?[]:props)].map(a=>a.y+a.h);if(feet.length>1&&Math.max(...feet)-Math.min(...feet)>s.H*0.015)issues.push(`feet on ${[...new Set(feet.map(Math.round))].join('/')}px`);}
 // on screen
 for(const a of [...bodies,...props])if(a.x<-2||a.x+a.w>s.W+2)issues.push(`${a.id||'prop'} cut off`);
 // effects in the sky
 for(const f of s.fx)for(const a of bodies)if(hit(f,a)){issues.push(`a star over ${a.id}`);break;}
 return [...new Set(issues)];}
const results=[];let fails=0;
for(const player of players){
 const date=arg('--date');const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}${date?`&date=${date}`:''}`)).json()).chapter;if(!ch){console.log(`${player}: no chapter`);continue;}
 const pages=only||ch.pages.map((_,i)=>i+1);
 for(const [W,H] of sizes){await size([W,H]);
  for(const n of pages){const p=ch.pages[n-1];if(!p)continue;
   // measured once the picture is still (the game's buttons may come after the words, and the friends glide aside)
   await open(player,ch,n);let s=await js(SNAP);for(let k=0;k<8;k++){await sleep(700);const s2=await js(SNAP);if(JSON.stringify(s2?.actors)===JSON.stringify(s?.actors)&&JSON.stringify(s2?.ui)===JSON.stringify(s?.ui)){s=s2;break;}s=s2;}const issues=s?judge(s,p):['no page'];
   const tag=`${player}-p${String(n).padStart(2,'0')}-${W}x${H}`;
   if(shots)await writeFile(join(shots,`${tag}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
   const people=(s?.actors||[]).filter(a=>a.id in PEOPLE&&!a.keeper&&!a.rider),unit=people.length?people.reduce((x,a)=>x+a.h/PEOPLE[a.id],0)/people.length:null;
   results.push({player,page:n,size:`${W}x${H}`,kind:p.beat?.kind||p.action?.kind||"story",unit,issues,...(args.includes("--dump")?{snap:s}:{})});if(issues.length)fails++;
   if(!args.includes('--json'))console.log(`${issues.length?'FAIL':'ok  '} ${tag} (${results.at(-1).kind}) ${issues.join('; ')}`);}}
}
if(args.includes('--json'))console.log(JSON.stringify(results,null,1));
else console.log(`${results.length-results.filter(r=>r.issues.length).length}/${results.length} pages composed cleanly`);
if(shots)await writeFile(join(shots,'results.json'),JSON.stringify(results,null,1));
ws.close();chrome.kill();process.exit(fails?1:0);
