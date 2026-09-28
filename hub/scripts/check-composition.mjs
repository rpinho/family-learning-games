#!/usr/bin/env node
// Does every page of the book read as one picture, on every screen? Opens every page of a player's chapter at phone
// portrait, phone landscape and Chromebook size and measures what is on screen:
//   - nobody overlaps anybody, and nobody overlaps a prop (a margin between boxes; nobody stands on the pizza);
//   - relative heights: Dad > Mom > the boys > the plush friends, and a ball is about knee-high to a boy;
//   - one ground line: every friend and prop that is not flying has its feet on the same line;
//   - stars and hearts stay in the sky (never over a face or a body);
//   - everybody on screen (nobody cut off at the sides);
//   - turned the other way the page reads the same (people the same size within 25%: the smaller side sets the size).
// Fails (exit 1) on any violation. Headless Chrome, muted, device voice stubbed, read-only grown-ups' preview.
// Usage: node hub/scripts/check-composition.mjs --base URL [--players diogo,francisco] [--sizes 412x915,915x412,1366x768]
//   [--pages 1,5] [--date YYYY-MM-DD] [--shots dir] [--json] [--dump]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NO_DEVICE_VOICE} from './no-device-voice.mjs';
import {PEOPLE,PROP_REL} from '../public/book-scene.mjs';
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
  actors:[...pg.querySelectorAll('.bk-actor')].map(a=>({id:a.dataset.id,pose:a.dataset.pose,fly:a.classList.contains('fly'),keeper:a.classList.contains('keeper-ready'),rider:!!a.closest('.bk-prop.train')||a.classList.contains('rider'),...box(a)})),
  props:[...pg.querySelectorAll('.bk-layer > .bk-prop')].map(p=>({id:p.dataset.id||'',train:p.classList.contains('train'),...box(p)})),
  balls:[...pg.querySelectorAll('.bk-ball:not(.used)')].map(box),goal:[...pg.querySelectorAll('.bk-goal')].map(box),
  fx:[...pg.querySelectorAll('.bk-fx:not(.burst) i')].map(box)};})()`;
async function size([W,H]){await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:W>1000?1:2,mobile:W<1000,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});}
async function open(player,ch,pageNo){await send('Page.navigate',{url:`${base}/?player=admin&r=${Date.now()}#book/${player}/p${pageNo}${arg('--date')?`/${arg('--date')}`:''}`});
 await until(`!!document.querySelector('.bk-open')`,20000);await js(`document.querySelector('.bk-open').click()`);
 const p=ch.pages[pageNo-1];const ready=p.beat?(p.beat.kind==='kick-letter'?'.bk-ball':'.bk-play .bk-btn,.bk-thing,.bk-box,.bk-pizza,.bk-glyph,.bk-btn.stone,.bk-quest'):['kick','throw'].includes(p.action?.kind)?'.bk-ball':'.bk-actor,.bk-prop,.bk-caption';
 await until(`document.querySelectorAll('.bk-view .bk-page').length===1&&!!document.querySelector('.bk-view .bk-page:last-child ${ready.split(',').join(', .bk-view .bk-page:last-child ')}')`,40000);
 await sleep(1900);}   // the friends' walk-in (1.6s) is over
const hit=(a,b,m=0)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;
const boy=id=>id==='diogo'||id==='francisco'||id==='hero';
function judge(s,p){
 const issues=[],M=Math.max(4,Math.min(s.W,s.H)*0.012);
 if(!s)return ['no page'];
 const ground=s.actors.filter(a=>!a.fly&&!a.keeper&&!a.rider);
 const bodies=s.actors.filter(a=>!a.rider),props=s.props.filter(x=>!x.train);
 // overlap: people with people, people with props (a margin between), people with the play balls (not the keeper and his goal)
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)if(hit(bodies[i],bodies[j],M*0.5))issues.push(`overlap ${bodies[i].id}/${bodies[j].id}`);
 for(const a of bodies)for(const x of props)if(hit(a,x,M*0.5))issues.push(`overlap ${a.id}/${x.id||'prop'}`);
 for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++)if(hit(props[i],props[j]))issues.push(`overlap ${props[i].id}/${props[j].id}`);
 for(const tr of s.props.filter(x=>x.train)){for(const x of props)if(hit(tr,x))issues.push(`${x.id||'prop'} in front of the train`);for(const a of bodies)if(hit(tr,a))issues.push(`${a.id} in front of the train`);}
 for(const a of bodies.filter(a=>!a.keeper)){for(const b of s.balls)if(hit(a,b))issues.push(`${a.id} over a ball`);for(const g of s.goal)if(hit(a,g))issues.push(`${a.id} in the goal`);}
 // relative heights (the keeper keeps his height too, unless the goal is smaller)
 const sized=bodies.filter(a=>!a.keeper),hOf=id=>sized.find(a=>a.id===id)?.h,order=[['dad','mom'],['mom','diogo'],['mom','francisco'],['dad','diogo'],['francisco','diogo']];
 for(const [a,b] of order)if(hOf(a)&&hOf(b)&&!(hOf(a)>hOf(b)))issues.push(`${a} (${Math.round(hOf(a))}px) not taller than ${b} (${Math.round(hOf(b))}px)`);
 const people=sized.filter(a=>a.id in PEOPLE),toys=sized.filter(a=>!(a.id in PEOPLE));
 const shortest=people.filter(a=>a.id!=='hero').reduce((m,a)=>Math.min(m,a.h),Infinity);
 for(const toy of toys)if(Number.isFinite(shortest)&&toy.h>=shortest)issues.push(`${toy.id} (${Math.round(toy.h)}px) as tall as a person (${Math.round(shortest)}px)`);
 const units=people.map(a=>a.h/PEOPLE[a.id]),U=units.length?units.reduce((x,y)=>x+y)/units.length:null;
 if(units.length>1&&Math.max(...units)/Math.min(...units)>1.06)issues.push(`people not on one scale (${units.map(Math.round).join(',')})`);
 if(U)for(const x of props)if(PROP_REL[x.id]){const r=x.h/U/PROP_REL[x.id];if(r<0.6||r>1.5)issues.push(`${x.id} ${Math.round(x.h)}px (expected about ${Math.round(PROP_REL[x.id]*U)}px)`);}
 // one ground line
 const feet=[...ground,...props].map(a=>a.y+a.h);if(feet.length>1&&Math.max(...feet)-Math.min(...feet)>s.H*0.015)issues.push(`feet on ${[...new Set(feet.map(Math.round))].join('/')}px`);
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
   await open(player,ch,n);const s=await js(SNAP);const issues=s?judge(s,p):['no page'];
   const tag=`${player}-p${String(n).padStart(2,'0')}-${W}x${H}`;
   if(shots)await writeFile(join(shots,`${tag}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
   const people=(s?.actors||[]).filter(a=>a.id in PEOPLE&&!a.keeper&&!a.rider),unit=people.length?people.reduce((x,a)=>x+a.h/PEOPLE[a.id],0)/people.length:null;
   results.push({player,page:n,size:`${W}x${H}`,kind:p.beat?.kind||p.action?.kind||"story",unit,issues,...(args.includes("--dump")?{snap:s}:{})});if(issues.length)fails++;
   if(!args.includes('--json'))console.log(`${issues.length?'FAIL':'ok  '} ${tag} (${results.at(-1).kind}) ${issues.join('; ')}`);}}
 // turned the other way the page reads the same (portrait vs landscape phone)
 const [P,L]=sizes.slice(0,2).map(([W,H])=>`${W}x${H}`);
 for(const n of pages){const a=results.find(r=>r.player===player&&r.page===n&&r.size===P),b=results.find(r=>r.player===player&&r.page===n&&r.size===L);
  if(a?.unit&&b?.unit){const r=a.unit/b.unit;if(r<0.75||r>1.33){const msg=`portrait ${Math.round(a.unit)}px vs landscape ${Math.round(b.unit)}px people`;a.issues.push(msg);fails++;if(!args.includes('--json'))console.log(`FAIL ${player}-p${n} turned: ${msg}`);}}}
}
if(args.includes('--json'))console.log(JSON.stringify(results,null,1));
else console.log(`${results.length-results.filter(r=>r.issues.length).length}/${results.length} pages composed cleanly`);
if(shots)await writeFile(join(shots,'results.json'),JSON.stringify(results,null,1));
ws.close();chrome.kill();process.exit(fails?1:0);
