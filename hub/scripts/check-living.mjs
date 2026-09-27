#!/usr/bin/env node
// Living book check: plays a hero chapter in a muted headless Chrome with device emulation (touch, a phone's pixel
// ratio, a fake microphone), tapping like a child: real touch events on the buttons, a wrong answer first, the talk
// button until it counts, hold-to-steer through the maze. At every checkpoint it measures and screenshots:
// - characters: each character the shot keeps must be >= 90% visible (its own pixels on screen, not hidden by the
//   screen edge, the letterbox, another character, scenery or a button);
// - readables: every word or letter he must read is flat text with a cap height >= 12% of the short screen side
//   and contrast >= 4.5:1 against its own badge, fully on screen;
// - targets: every button is at least 56 px in both directions;
// and it confirms the browser's microphone is asked for on the first tap of a talk button (getUserMedia inside the
// tap), that letting go of the steering stops him at once, and that the companions stay close in the maze.
// Also reports frame times. The browser always runs with --mute-audio.
// Usage: node hub/scripts/check-living.mjs --base http://127.0.0.1:5325 --story <id>
//        [--sizes 412x915m,915x412m,1366x768] [--dpr 2.6] [--shots <dir>] [--timeout 900] [--gpu] [--auto] [--from maze]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {INSTRUMENT} from './check-voice.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const base=arg('--base','http://127.0.0.1:4810'),hero=arg('--story','night-train'),shots=arg('--shots'),timeout=Number(arg('--timeout','900'))*1000,dpr=Number(arg('--dpr','2.6'));
const sizes=String(arg('--sizes','412x915m,915x412m,1366x768')).split(',').map(s=>{const m=s.match(/^(\d+)x(\d+)(m?)$/);const W=+m[1],H=+m[2];return {W,H,mobile:!!m[3],label:m[3]?(H>W?'phone-portrait':'phone-landscape'):'chromebook'};});
const chrome=arg('--chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const RULES={charShare:.9,readRatio:.12,contrast:4.5,target:56};
async function run(size){
 const {W,H,mobile,label}=size;
 const profile=await mkdtemp(join(tmpdir(),'living-chrome-'));
 const gpu=flag('--gpu')?['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader'];
 const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--mute-audio','--autoplay-policy=document-user-activation-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',...gpu,`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
 const R={story:hero,label,size:`${W}x${H}`,dpr:mobile?dpr:1,checkpoints:[],beats:[],errors:[],failures:[],shots:[],mic:null,steer:{holds:0,stoppedOnRelease:0,maxLag:0}};
 try{
  let port=null;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
  if(!port)throw Error('Chrome did not start');
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  let seq=0;const waiting=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}
   else if(m.method==='Runtime.exceptionThrown')R.errors.push(String(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text).slice(0,300));
   else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')R.errors.push(m.params.args.map(a=>a.value||a.description).join(' ').slice(0,300));};
  const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(method+' timed out'));},60000);});
  const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description?.slice(0,200)||'eval failed');return r.result?.value;};
  const touch=async(type,x,y)=>send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  const tapAt=async(x,y)=>{await touch('touchStart',x,y);await sleep(70);await touch('touchEnd',x,y);};
  const center=sel=>js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`);
  const tap=async sel=>{const c=await center(sel);if(!c)return false;await tapAt(c.x,c.y);return true;};
  const shot=async name=>{if(!shots)return;await mkdir(shots,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});const f=join(shots,`${hero}-${label}-${String(R.shots.length+1).padStart(2,'0')}-${name.replace(/[^a-z0-9-]+/gi,'_')}.png`);await writeFile(f,Buffer.from(r.data,'base64'));R.shots.push(f);};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:INSTRUMENT});
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:mobile?dpr:1,mobile,screenOrientation:mobile?{type:H>W?'portraitPrimary':'landscapePrimary',angle:H>W?0:90}:undefined});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await send('Page.navigate',{url:`${base}/living/index.html?story=${encodeURIComponent(hero)}&debug=1&${flag('--auto')?'auto=1':'drive=1&check=1'}${arg('--from')?'&from='+arg('--from'):''}`});
  const t0=Date.now();
  for(let i=0;i<120;i++){const ok=await js(`typeof __living==='object'&&__living.beat!=='loading'`).catch(()=>false);if(ok)break;await sleep(250);}
  await sleep(600);await shot('title');
  if(!flag('--auto'))await tap('#begin');
  let lastBeat='',lastCp=null,lastExpect=null,choseWrong=false,micTapped=false;const measuredSay=new Set();
  const S=()=>js(`JSON.stringify({beat:__living.beat,done:__living.done,cp:__living.checkpoint,ack:__living.ack,expect:__living.expect&&{kind:__living.expect.kind,answer:__living.expect.answer??null,selector:__living.expect.selector||null,id:__living.expect.id||null},stats:__living.stats})`).then(JSON.parse);
  while(Date.now()-t0<timeout){
   const s=await S().catch(()=>null);if(!s){await sleep(300);continue;}
   if(s.beat!==lastBeat){lastBeat=s.beat;R.beats.push({at:Date.now()-t0,beat:s.beat});}
   if(s.done||/^error|fallback/.test(s.beat)){R.stats=s.stats;break;}
   // A checkpoint: let the shot settle, measure, screenshot, then let the story go on.
   if(s.cp&&s.cp.id!==lastCp){lastCp=s.cp.id;await sleep(900);const m=await js('JSON.stringify(__living.measure())').then(JSON.parse).catch(e=>({error:String(e.message)}));
    R.checkpoints.push({id:s.cp.id,...m});await shot(s.cp.id);await js(`__living.ack=${JSON.stringify(s.cp.id)}`);continue;}
   const e=s.expect;
   if(e&&e.kind==='choose'){
    // Every option must be a big target.
    const opts=await js(`[...document.querySelectorAll('#ui .lv-opt')].map(b=>{const r=b.getBoundingClientRect();return {v:b.dataset.v,x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})`);
    if(!opts.length){await sleep(200);continue;}
    await sleep(700);const mo=await js('JSON.stringify(__living.measure())').then(JSON.parse).catch(()=>null);if(mo)R.checkpoints.push({id:`${e.id||'choose'}-options`,...mo});
    await shot(`${e.id||'choose'}-options`);
    const wrong=opts.find(o=>o.v!==String(e.answer)),right=opts.find(o=>o.v===String(e.answer));
    if(!choseWrong&&wrong){choseWrong=true;await tapAt(wrong.x,wrong.y);await sleep(4500);}
    const again=await js(`[...document.querySelectorAll('#ui .lv-opt')].find(b=>b.dataset.v===${JSON.stringify(String(e.answer))})?.getBoundingClientRect().toJSON()`);
    if(again)await tapAt(again.x+again.width/2,again.y+again.height/2);
    for(let k=0;k<60;k++){const x=await S().catch(()=>null);if(!x||x.expect?.kind!=='choose'||x.expect?.id!==e.id)break;await sleep(250);}
    continue;}
   if(e&&e.kind==='say'){
    const before=await js(`__sources.filter(x=>x.kind==='getUserMedia').length`);
    const c=await center(e.selector);if(!c){await sleep(250);continue;}
    if(!measuredSay.has(e.selector+e.id)){measuredSay.add(e.selector+e.id);const mo=await js('JSON.stringify(__living.measure())').then(JSON.parse).catch(()=>null);if(mo)R.checkpoints.push({id:'say-'+(e.id||'word'),...mo});}
    const tapT=await js('Math.round(performance.now())');await tapAt(c.x,c.y);
    if(!micTapped){micTapped=true;await sleep(1500);const g=await js(`__sources.filter(x=>x.kind==='getUserMedia')`);const first=g[before];
     R.mic={askedOnFirstTap:!!first&&first.t-tapT<1200,msAfterTap:first?first.t-tapT:null,userActivation:first?.activation??null,micUsable:await js(`!!document.querySelector('#ui .lv-mic-badge')&&document.querySelector('#ui .lv-mic-badge').textContent==='🎤'`).catch(()=>null)};
     await shot('mic-first-tap');}
    // Wait for this attempt (listening, the recogniser, "so close") before tapping again.
    for(let k=0;k<60;k++){await sleep(300);const x=await S().catch(()=>null);if(!x||x.expect?.kind!=='say')break;const busy=await js(`!!document.querySelector('#ui .listening,#ui .thinking')`).catch(()=>false);if(!busy&&k>14)break;}
    if(await js(`!!document.querySelector('.lv-card')`).catch(()=>false)){await shot('mic-card');await tap('.lv-card [data-a="tap"]');}
    continue;}
   if(e&&e.kind==='no'){await sleep(1200);await shot('no-button');await tap('#no');await sleep(600);continue;}
   if(e&&e.kind==='aim'){await sleep(800);await tapAt(W*.62,H*.42);await sleep(600);continue;}
   if(e&&e.kind==='steer'){
    const h=await js('__living.steerHint&&__living.steerHint()').catch(()=>null);if(!h){await sleep(200);continue;}
    if(h.noShown){await sleep(500);await shot('maze-fork');await tap('#no');await sleep(800);continue;}
    const x=Math.max(8,Math.min(W-8,h.hero.x+h.dir.x*110)),y=Math.max(8,Math.min(H-8,h.hero.y+h.dir.y*110));
    await touch('touchStart',x,y);await sleep(420);await touch('touchEnd',x,y);R.steer.holds++;
    await sleep(120);const after=await js('__living.steerHint()').catch(()=>null);if(after&&!after.moving)R.steer.stoppedOnRelease++;
    // The friends: never far behind him (measured once they have had a moment to catch up).
    await sleep(500);const later=await js('__living.steerHint()').catch(()=>null);if(later)R.steer.maxLag=Math.max(R.steer.maxLag,later.lag);
    if(R.steer.holds%12===0)await shot('maze-steer');
    continue;}
   await sleep(250);
  }
  R.minutes=+((Date.now()-t0)/60000).toFixed(1);R.final=await js('JSON.stringify({beat:__living.beat,done:__living.done,telemetry:__living.telemetry.map(b=>({beat:b.beat,attempts:b.attempts,misses:b.misses,firstTapMs:b.firstTapMs,correct:b.correct,guess:b.guess,via:b.via})),stats:__living.stats,voice:__living.voice.length,missingClips:[...new Set(__living.voice.filter(v=>!v.clip).map(v=>v.key))]})').then(JSON.parse).catch(()=>null);
  R.gum=await js(`__sources.filter(x=>x.kind==='getUserMedia')`).catch(()=>[]);R.deviceVoice=await js(`__sources.filter(x=>x.kind==='tts').map(x=>x.text)`).catch(()=>['(unknown)']);
  ws.close();
 }catch(e){R.errors.push(String(e.message||e));}
 finally{proc.kill();await sleep(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
 // ---- the rules ----
 for(const c of R.checkpoints){for(const ch of c.chars||[])if(ch.share<RULES.charShare)R.failures.push(`${c.id}: ${ch.id} only ${(ch.share*100).toFixed(0)}% visible (on screen ${(ch.onScreen*100).toFixed(0)}%, under buttons ${(ch.hiddenByUI*100).toFixed(0)}%)`);
  for(const r of c.readables||[]){if(r.ratio<RULES.readRatio)R.failures.push(`${c.id}: "${r.text}" is ${(r.ratio*100).toFixed(1)}% of the short side (needs ${RULES.readRatio*100}%)`);if(r.contrast<RULES.contrast)R.failures.push(`${c.id}: "${r.text}" contrast ${r.contrast}:1`);if(!r.onScreen)R.failures.push(`${c.id}: "${r.text}" is off screen`);}
  for(const t of c.targets||[])if(Math.min(t.w,t.h)<RULES.target)R.failures.push(`${c.id}: button ${t.cls} is ${t.w}x${t.h} px`);}
 if(!flag('--auto')){if(!R.mic&&!arg('--from'))R.failures.push('no talk button was tapped');else if(R.mic&&!R.mic.askedOnFirstTap)R.failures.push('the microphone was not asked for on the first talk-button tap');
  if(R.steer.holds&&R.steer.stoppedOnRelease<R.steer.holds*.9)R.failures.push(`he kept walking after letting go (${R.steer.stoppedOnRelease}/${R.steer.holds} stopped)`);
  if(R.steer.maxLag>2.6)R.failures.push(`a friend fell ${R.steer.maxLag} m behind in the maze`);}
 if(R.deviceVoice?.length)R.failures.push('the device voice was used: '+R.deviceVoice.join(' | '));
 if(R.final?.missingClips?.length)R.failures.push('lines without a voice clip: '+R.final.missingClips.join(', '));
 R.ok=!R.errors.length&&!R.failures.length&&R.final?.done===true;
 return R;
}
const results=[];for(const s of sizes)results.push(await run(s));
const out={ok:results.every(r=>r.ok),results};console.log(JSON.stringify(out,null,1));process.exit(out.ok?0:1);
