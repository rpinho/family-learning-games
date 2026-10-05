#!/usr/bin/env node
// Browser play-through for Letter Slalom. Opens Word Arcade in a headless Chrome (own profile, muted audio,
// the real autoplay rule), taps once, starts the slalom and skis it with real pointer or touch drags: the finger
// goes where the right gate is, except the gates listed in --miss. Checks that every gate's question is heard
// before the skier reaches it, that a missed gate names the answer, that the recap and the word break follow,
// and that the finish screen appears. Records the frame times the game measured and saves screenshots and a
// short recording (needs ffmpeg).
//        [--mobile] [--miss 2] [--shots <dir>] [--label tablet] [--record] [--cpu 4] [--quality medium]
//        [--ride ski|board] [--track letters|words (tap the start screen's choice)] [--card (open from a Word Arcade card; default: the hub's ?play=slalom deep link)] [--boost 1,4 (hold Up after those rows' questions)]
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterGate,familyWords} from '../lib/slalom.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const base=arg('--base','http://127.0.0.1:5319'),player=arg('--player','admin'),[W,H]=arg('--size','1280x800').split('x').map(Number),mobile=flag('--mobile');
const shots=arg('--shots'),label=arg('--label',`${W}x${H}`),miss=new Set((arg('--miss','')||'').split(',').filter(Boolean).map(Number)),record=flag('--record'),cpu=Number(arg('--cpu','1')),quality=arg('--quality'),ride=arg('--ride','ski'),track=arg('--track'),deep=!flag('--card'),boostRows=new Set((arg('--boost','')||'').split(',').filter(Boolean).map(Number));
const chrome=arg('--chrome',process.env.CHROME||(process.env.HOME+'/.local/share/family-games/bin/test-chrome'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=await mkdtemp(join(tmpdir(),'slalom-check-chrome-'));
const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--autoplay-policy=document-user-activation-required','--mute-audio',`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
let port=null;for(let i=0;i<150&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
if(!port){proc.kill();throw Error('Chrome did not start');}
const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let seq=0;const waiting=new Map(),frames=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}
 else if(m.method==='Page.screencastFrame'){frames.push({data:m.params.data,t:m.params.metadata.timestamp});void send('Page.screencastFrameAck',{sessionId:m.params.sessionId}).catch(()=>{});}};
const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(`${method} timed out`));},30000);});
const js=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'eval failed');return r.result.value;};
const until=async(expr,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(await js(expr))return true;}catch{}await sleep(120);}return false;};
setTimeout(()=>{console.log(JSON.stringify({player,label,ok:false,errors:['overall timeout']}));proc.kill();process.exit(1);},6*60000).unref();
const result={player,label,size:`${W}x${H}`,mobile,cpuThrottle:cpu,gates:[],errors:[],audio:{}};
const shot=async name=>{if(!shots)return;await mkdir(shots,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(shots,`${player}-${label}-${name}.png`),Buffer.from(r.data,'base64'));};
// Real input: touch on --mobile, otherwise the mouse.
async function pointer(type,x,y){
 if(mobile)await send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd'}[type],touchPoints:type==='up'?[]:[{x,y,id:1}]});
 else await send('Input.dispatchMouseEvent',{type:{down:'mousePressed',move:'mouseMoved',up:'mouseReleased'}[type],x,y,button:'left',buttons:type==='up'?0:1,clickCount:1});
}
async function tap(sel){const r=await js(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!r)throw Error('missing '+sel);await pointer('down',r.x,r.y);await pointer('up',r.x,r.y);if(mobile)await js(`document.querySelector(${JSON.stringify(sel)})?.click()`);}
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:mobile?2:1,mobile});
 if(mobile)await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 if(cpu>1)await send('Emulation.setCPUThrottlingRate',{rate:cpu});
 // Record every media play() with its clip, time and outcome.
 // The device voice must never be heard (and --mute-audio does not silence it on macOS): replace it before any page
 // script runs, and count every attempt so the check fails if anything tries.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__deviceVoice=[];(()=>{const s={speak(u){window.__deviceVoice.push(String(u&&u.text||''));},cancel(){},pause(){},resume(){},getVoices(){return [];},speaking:false,pending:false,paused:false,addEventListener(){},removeEventListener(){},onvoiceschanged:null};try{Object.defineProperty(window,'speechSynthesis',{value:s,configurable:false});}catch{}})();`});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__audio=[];const _play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const e={src:this.src||this.currentSrc,at:performance.now()};window.__audio.push(e);if(!this.__endHook){this.__endHook=true;this.addEventListener('ended',()=>{const last=[...window.__audio].reverse().find(x=>x.el===this&&!x.end);if(last)last.end=performance.now();});}e.el=this;const p=_play.call(this);Promise.resolve(p).then(()=>{e.ok=true;},x=>{e.err=x&&x.name;});return p;};`});
 await send('Page.navigate',{url:`${base}/?player=${player}${deep?'&play=slalom':''}${quality?`&slalomQuality=${quality}`:''}`});
 if(!await until(deep?`!!document.querySelector('.slalom-ride')`:`!!document.querySelector('section.lobby')`,30000))throw Error(deep?'deep link did not open the slalom start screen':'lobby did not load');
 result.deep=deep;if(deep)result.deepNoLobby=await js(`!document.querySelector('section.lobby')`);
 const manifest=await js(`fetch('/voice/manifest.json').then(r=>r.json())`),textOf=Object.fromEntries(Object.entries(manifest.clips).map(([t,c])=>[c,t]));
 // Control: sound is refused before the first tap.
 const probe=Object.values(manifest.clips)[0];result.audio.beforeTap=await js(`(async()=>{try{await new Audio(${JSON.stringify(probe)}).play();return 'played'}catch(e){return e.name}finally{window.__audio.length=0;}})()`);
 if(!deep){await tap('section.lobby h1');
  const card=`.live-game-card.game-slalom`;if(!await until(`!!document.querySelector('${card}')`,5000))throw Error('no Letter Slalom card');
  await shot('0-lobby');await tap(card);}
 if(!await until(`!!document.querySelector('.slalom-ride')`,5000))throw Error('no ski/snowboard start screen');await shot('1-start');
 result.toggle=await js(`!!document.querySelector('.slalom-modes')`);result.wordsStar=await js(`!!document.querySelector('.slalom-ready')`);
 if(track){if(!result.toggle)throw Error('no letters/words choice on the start screen');await tap(`.slalom-modes .slalom-mode:nth-child(${track==='words'?2:1})`);await sleep(300);await shot('1-start-'+track);}
 const rideIndex=ride==='board'?2:1;await tap(`.slalom-rides .slalom-ride:nth-child(${rideIndex})`);
 if(!await until(`!!window.__slalom`,30000))throw Error('3D scene did not start: '+(await js(`document.querySelector('.slalom-flat')?.textContent||''`)));
 const t0=Date.now();
 if(record)await send('Page.startScreencast',{format:'jpeg',quality:70,maxWidth:Math.min(W,960),maxHeight:Math.min(H,960),everyNthFrame:2});
 const profileNow=async()=>(await(await fetch(`${base}/api/${player}`)).json()).profile;
 let prof=await profileNow();let gates=prof.session.gates;const planned=gates;result.track=prof.session.track;result.family=prof.session.family||null;result.targets=prof.session.targets||null;result.easy=!!prof.session.easy;
 // words: the warm-up (today's words, each sounded out) comes before the rider moves
 if(result.track==='words'){if(await until(`!!document.querySelector('.slalom-warmup')`,15000)){await until(`!!document.querySelector('.slalom-warm-word.now')`,8000);await sleep(1400);await shot('1b-warmup');const w0=Date.now();await until(`!document.querySelector('.slalom-warmup')`,40000);result.warmupSeenSec=+((Date.now()-w0)/1000+2).toFixed(1);}else result.errors.push('no warm-up before a words run');}
 let adapt={support:false,missRun:0};
 let down=false,lastGate=-1;
 while(Date.now()-t0<150000){
  const st=await js('__slalom.state()');if(st.finished)break;
  const i=st.next;if(i>=gates.length){if(lastGate>=0&&result.gates[lastGate]&&!result.gates[lastGate].passedAt)result.gates[lastGate].passedAt=Date.now()-t0;await sleep(200);continue;}
  if(i!==lastGate){
   if(lastGate>=0){result.gates[lastGate].passedAt=Date.now()-t0;const a=afterGate(gates,lastGate,!miss.has(lastGate),adapt);gates=a.gates;adapt={support:a.support,missRun:a.missRun};if(a.started)result.supportFrom=lastGate+1;if(result.gates[lastGate].boostDown&&!mobile)await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});}
   lastGate=i;const cur=await js(`window.__slalom&&document.querySelector('.slalom-prompt')?.textContent||''`);
   result.gates[i]={gate:i,kind:gates[i].kind,answer:gates[i].answer,options:gates[i].options,prompt:gates[i].prompt,support:!!gates[i].support,hud:cur,miss:miss.has(i)};
   if(gates[i].support&&!result.supportShot){result.supportShot=true;await sleep(1200);await shot(`2-support-gate${i}`);}
   if([0,4].includes(i)){await sleep(1500);await shot(`2-gate${i}`);}
  }
  // eased gates may have changed the options: the scene's live lanes and the client's gate list
  const g=gates[i],lanes=st.lanes[i];
  const want=miss.has(i)?g.options.findIndex(o=>o!==g.answer):g.options.indexOf(g.answer);
  // go faster: touch runs drag the steering finger up (the rider's go-faster gesture); mouse runs hold Up
  const gi=result.gates[i],x=await js(`__slalom.uToScreenX(${lanes[want]})`),y=Math.round(H*0.72)-(mobile&&gi.boostDown?70:0);
  if(!down){await pointer('down',x,y);down=true;}else await pointer('move',x,y);
  if(boostRows.has(i)&&!gi.boostDown){if(!mobile)await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38});gi.boostDown=true;gi.boostBy=mobile?'drag-up':'key';gi.boostAt=st.canBoost?'after-question':'during-question';}
  if(gi.boostDown){gi.vMax=Math.max(gi.vMax||0,st.v);if(!st.canBoost)gi.vWhilePrompt=Math.max(gi.vWhilePrompt||0,st.v);}
  if(st.hint&&!gi.hintSeen){gi.hintSeen=true;await shot(`hint-gate${i}`);}
  if(st.gateD[i]-st.d<3&&i===3){await shot('3-through-gate');}
  await sleep(250);
 }
 if(down)await pointer('up',0,0);
 result.runSeconds=+((Date.now()-t0)/1000).toFixed(1);
 result.stats=await js('__slalom?.stats()');result.friendsAtFinishLine=await js('__slalom?.friendCount?.()');
 if(flag('--bench'))result.bench=await js(`(()=>{const out=[];for(const t of ['high','medium','low'])out.push(__slalom.bench(90,t));return out;})()`);
 await sleep(1200);await shot('4-finish-line');
 if(!await until(`!!document.querySelector('.slalom-recap')`,15000))result.errors.push('no recap');
 result.friendsShown=await js('__slalom?.friendCount?.()');
 result.friendsListed=(await(await fetch(`${base}/api/${player}/companions`)).json()).friends?.length??0;
 await until(`!!document.querySelector('.slalom-recap .now')`,8000);await sleep(result.track==='words'?1500:0);await shot('5-recap');result.recapCards=await js(`[...document.querySelectorAll('.slalom-recap .slalom-warm-word b,.slalom-recap .slalom-card')].map(e=>e.getAttribute('aria-label')||e.textContent)`);
 // the shared word break: tap choices until it is solved (always passable)
 if(await until(`!!document.querySelector('dialog.wb[open]')`,60000)){
  result.wordBreak=await js(`document.querySelector('dialog.wb').dataset.kind`);result.wordBreakChoices=await js(`[...document.querySelectorAll('dialog.wb .wb-choice')].map(b=>b.textContent.trim())`);await sleep(800);await shot('6-word-break');
  for(let k=0;k<30;k++){if(!await js(`!!document.querySelector('dialog.wb[open]')&&!document.querySelector('dialog.wb .wb-done')`))break;
   await js(`(()=>{const c=[...document.querySelectorAll('dialog.wb .wb-choice:not(.used)')];const glow=c.find(b=>b.classList.contains('glow'));(glow||c[${k}%c.length])?.click();})()`);await sleep(700);}
 }else result.errors.push('no word break');
 if(!await until(`!!document.querySelector('section.slalom-finish')`,20000))result.errors.push('no finish screen');
 await sleep(600);await shot('7-finish');
 if(record){await send('Page.stopScreencast');}
 prof=await profileNow();result.complete=prof.session.phase==='complete';result.ride=prof.session.ride;result.savedRide=prof.slalom?.ride;result.results=prof.session.results.map(r=>({answer:r.q.answer,chose:r.answer,correct:r.answer===r.q.answer,hinted:!!r.hinted,unaided:r.independent}));
 // audio: which lines played (and when), refused plays
 const audio=await js('window.__audio');const said=audio.filter(a=>a.ok).map(a=>({text:textOf[new URL(a.src).pathname]||a.src,at:Math.round(a.at)})).filter((a,k,all)=>!(k&&all[k-1].text===a.text&&a.at-all[k-1].at<1500));
 result.audio.plays=said.length;result.audio.refused=audio.filter(a=>a.err&&a.err!=='AbortError').length;
 const saidText=said.map(a=>a.text);
 if(result.track==='words'){const tl=await js(`window.__audio.filter(a=>a.ok).map(a=>({src:new URL(a.src).pathname,at:a.at,end:a.end||null}))`),a0=tl.find(a=>textOf[a.src]==="Let's meet today's words."),a1=tl.find(a=>textOf[a.src]==="Ready? Let's ski!");result.warmupSec=a0&&a1?+(((a1.end||a1.at)-a0.at)/1000).toFixed(1):null;
  const fin=saidText.findIndex(t=>/lovely run/.test(t));result.recapSoundOuts=fin<0?[]:saidText.slice(fin+1).filter(t=>t.startsWith('Sound out')).map(t=>t.slice(10,-1));
  result.missedWords=[...new Set(result.gates.filter(g=>g&&g.miss).map(g=>g.answer))];result.wordBreakInFamily=!!result.family&&(result.wordBreakChoices||[]).some(w=>familyWords(result.family).includes(w));}
 for(const g of result.gates){if(!g)continue;g.promptHeard=saidText.includes(g.prompt);const full=gates[g.gate];if(g.miss)g.correctionHeard=saidText.includes(full.correction);}
 // measured gaps after each gate: feedback clip, next question, time to the next row (all browser clock)
 const timeline=await js(`window.__audio.filter(a=>a.ok).map(a=>({src:new URL(a.src).pathname,at:a.at,end:a.end||null}))`),passes=await js('__slalom?.passes?.()||[]');
 result.gaps=[];for(let k=0;k+1<passes.length;k++){const p0=passes[k].at,p1=passes[k+1].at,after=timeline.filter(a=>a.at>=p0-50&&a.at<p1);const fb=after[0],q=after.find(a=>(textOf[a.src]||'')===gates[k+1].prompt);
  if(fb&&q)result.gaps.push({gate:k,feedback:textOf[fb.src],feedbackSec:+(((fb.end??q.at)-fb.at)/1000).toFixed(2),prompt:textOf[q.src],promptSec:q.end?+((q.end-q.at)/1000).toFixed(2):null,feedbackStartsAfterPass:+((fb.at-p0)/1000).toFixed(2),toRowSec:+((p1-p0)/1000).toFixed(2),speedAtPass:passes[k].v,leftAfterPromptSec:q.end?+((p1-q.end)/1000).toFixed(2):null,overlap:!!(fb.end&&q.at<fb.end-20)});}
 result.audio.recap=saidText.filter(t=>/lovely run/.test(t)).length;result.audio.deviceVoice=await js('window.__deviceVoice');result.audio.lines=saidText;
 result.teachingOk=result.track!=='words'||(result.warmupSec>=13&&result.warmupSec<=21&&JSON.stringify(result.recapSoundOuts)===JSON.stringify(result.missedWords)&&result.wordBreakInFamily&&(!result.supportFrom||result.gates.slice(result.supportFrom).every(g=>g.options.length===2&&g.prompt.startsWith('Sound out'))));
 result.ok=result.teachingOk&&(result.friendsShown?.loaded??0)===result.friendsListed&&result.gaps.length>=6&&result.gaps.every(g=>!g.overlap&&g.leftAfterPromptSec>=1.5&&g.feedbackSec<=0.3*g.toRowSec)&&result.ride===ride&&(!deep||result.deepNoLobby)&&result.gates.filter(g=>g.boostDown).every(g=>g.vMax>9.5&&(g.vWhilePrompt===undefined||g.vWhilePrompt<9))&&result.audio.deviceVoice.length===0&&result.audio.beforeTap==='NotAllowedError'&&result.complete&&result.gates.length===gates.length&&result.gates.every(g=>g.promptHeard&&(!g.miss||g.correctionHeard))&&result.audio.refused===0&&result.audio.recap>=1&&!!result.wordBreak&&!result.errors.length;
 if(record&&frames.length&&shots){const dir=await mkdtemp(join(tmpdir(),'slalom-frames-'));const t1=frames[0].t;let list='';
  for(let k=0;k<frames.length;k++){const f=join(dir,`f${String(k).padStart(5,'0')}.jpg`);await writeFile(f,Buffer.from(frames[k].data,'base64'));const dur=k+1<frames.length?frames[k+1].t-frames[k].t:0.1;list+=`file '${f}'\nduration ${Math.max(0.01,dur).toFixed(3)}\n`;}
  await writeFile(join(dir,'list.txt'),list);const out=join(shots,`${player}-${label}-run.mp4`);
  const r=spawnSync('nice',['-n','19','taskpolicy','-b','ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',join(dir,'list.txt'),'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30','-pix_fmt','yuv420p','-c:v','libx264','-crf','26',out]);
  result.recording=r.status===0?out:'ffmpeg failed: '+String(r.stderr).slice(0,200);result.recordingFrames=frames.length;void t1;await rm(dir,{recursive:true,force:true});}
}catch(e){result.errors.push(String(e.message||e));result.ok=false;try{await shot('error');}catch{}}
finally{try{ws.close();}catch{}proc.kill();await rm(profile,{recursive:true,force:true}).catch(()=>{});}
console.log(JSON.stringify(result));
