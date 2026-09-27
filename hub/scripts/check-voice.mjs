#!/usr/bin/env node
// Voice check: "does each line sound exactly once?" Plays a child's book chapter (grown-ups' preview, nothing
// saved) or a living-book story end to end in a muted headless Chrome with phone emulation, and instruments every
// sound source: HTMLMediaElement.play() (with the clip), speechSynthesis.speak() (with the text) and Web Audio
// buffer starts. It records a mixdown of the voice (the page's audio elements through a MediaStreamDestination and
// a MediaRecorder) and can transcribe it with the local recogniser, to hear what a child would hear.
// Rules checked: a line never has two sources (a clip and the device voice, or two clips) at once; the same clip
// never plays twice within 4 s; a repeat only comes after the configured silence (IDLE_REPEAT_MS) and only for a
// prompt; no play() is refused.
// Usage: node hub/scripts/check-voice.mjs --base http://127.0.0.1:5325 (--player <id> | --story <id>)
//        [--size 412x915] [--dpr 2.6] [--mix out.webm] [--transcribe] [--label phone] [--timeout 600]
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const base=arg('--base','http://127.0.0.1:4810'),player=arg('--player'),storyId=arg('--story'),[W,H]=arg('--size','412x915').split('x').map(Number),dpr=Number(arg('--dpr','2.6'));
const mixOut=arg('--mix'),label=arg('--label',`${W}x${H}`),timeout=Number(arg('--timeout','600'))*1000;
const chrome=arg('--chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const INSTRUMENT=`(()=>{const log=[];globalThis.__sources=log;const now=()=>Math.round(performance.now());const hooked=new WeakSet();
 function capture(el){const m=globalThis.__mix;if(!m||hooked.has(el))return;hooked.add(el);try{const s=m.ctx.createMediaElementSource(el);s.connect(m.dest);s.connect(m.ctx.destination);}catch(e){log.push({kind:'cap-err',err:String(e).slice(0,80)});}}
 globalThis.__startMix=()=>{if(globalThis.__mix)return;try{const ctx=new AudioContext(),dest=ctx.createMediaStreamDestination(),rec=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[];void ctx.resume();rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.start(1000);globalThis.__mix={ctx,dest,rec,chunks,t0:now()};}catch(e){log.push({kind:'mix-err',err:String(e).slice(0,80)});}};
 addEventListener('pointerdown',()=>globalThis.__startMix(),{capture:true,once:true});
 for(const ty of ['click','pointerdown','touchend'])addEventListener(ty,e=>{const t=e.target;log.push({kind:ty,t:now(),trusted:e.isTrusted,el:String(t&&(t.className||t.tagName)).slice(0,30)});},{capture:true});addEventListener('click',()=>globalThis.__startMix(),{capture:true,once:true});
 globalThis.__stopMix=async()=>{const m=globalThis.__mix;if(!m)return null;await new Promise(r=>{m.rec.onstop=r;m.rec.stop();});const b=new Blob(m.chunks,{type:'audio/webm'});const u=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return {b64:btoa(s),t0:m.t0};};
 const play=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(){const el=this.__id??=(globalThis.__elN=(globalThis.__elN||0)+1);const e={kind:'audio',el,src:String(this.getAttribute('src')||this.src||this.currentSrc||'').split('/').pop(),t:now()};log.push(e);capture(this);
  e.by=String(new Error().stack||'').split(String.fromCharCode(10)).slice(2,12).map(x=>x.trim().replace('at ','').split('/').slice(-1)[0].slice(0,40)).join(' < ');
  // The line ends when this element finishes, is paused, or starts another line.
  if(this.__cur&&!this.__cur.end)this.__cur.end=now(),this.__cur.cut=1;this.__cur=e;
  const onEnd=ev=>{if(this.__cur===e&&!e.end){e.end=now();if(ev.type==='pause')e.paused=1;}};this.addEventListener('ended',onEnd,{once:true});this.addEventListener('pause',onEnd,{once:true});
  const p=play.call(this);Promise.resolve(p).then(()=>{e.ok=1;},er=>{e.err=String(er&&er.name);});return p;};
 // The device voice is never allowed to make a sound in a check (--mute-audio does not silence it on macOS: the OS
 // speech service plays out loud). It is stubbed before any page script runs, and every call is a failure.
 try{const ss=globalThis.speechSynthesis;if(ss){ss.speak=u=>{log.push({kind:'tts',text:String(u?.text||'').slice(0,120),t:now()});try{u?.onend?.(new Event('end'));}catch{}};ss.cancel=()=>{};}
  globalThis.SpeechSynthesisUtterance=globalThis.SpeechSynthesisUtterance||function(t){this.text=t;};}catch{}
 const st=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&!this.loop&&this.buffer.duration>.4)log.push({kind:'webaudio',dur:+this.buffer.duration.toFixed(2),t:now()});return st.apply(this,a);};
 const md=navigator.mediaDevices;if(md?.getUserMedia){const g=md.getUserMedia.bind(md);md.getUserMedia=c=>{log.push({kind:'getUserMedia',t:now(),activation:!!navigator.userActivation?.isActive});return g(c);};}
})();`;
// The rules, on the instrumented log. lines: {clip -> {text, prompt}} when known.
export function analyse(log,{idleMs=6500,prompts=new Set()}={}){
 const issues=[],audio=log.filter(e=>e.kind==='audio'&&e.src),tts=log.filter(e=>e.kind==='tts');
 for(let i=0;i<audio.length;i++)for(let j=i+1;j<audio.length;j++){const a=audio[i],b=audio[j];if(b.t-a.t>idleMs+500)break;
  if(a.src===b.src&&b.t-a.t<4000)issues.push({rule:'same clip twice within 4 s',src:a.src,at:[a.t,b.t]});
  else if(a.src===b.src&&!prompts.has(a.src))issues.push({rule:'non-prompt line repeated',src:a.src,at:[a.t,b.t]});
  if(a.el!==b.el&&a.end&&b.t<a.end-150)issues.push({rule:'two audio sources at once',src:[a.src,b.src],at:[a.t,b.t]});}
 for(const t of tts)issues.push({rule:'the device voice was used (never allowed)',text:t.text,at:t.t});
 const refused=audio.filter(a=>a.err&&a.err!=='AbortError');for(const r of refused)issues.push({rule:'play() refused',src:r.src,err:r.err});
 return issues;
}
async function main(){
 const profile=await mkdtemp(join(tmpdir(),'voice-check-'));
 const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--autoplay-policy=document-user-activation-required','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader',`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
 const result={what:player?`book:${player}`:`living:${storyId}`,label,size:`${W}x${H}`,dpr,issues:[],errors:[]};
 try{
  let port=null;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
  if(!port)throw Error('Chrome did not start');
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  let seq=0;const waiting=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}
   else if(m.method==='Runtime.exceptionThrown')result.errors.push(String(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text).slice(0,200));};
  const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(method+' timed out'));},30000);});
  const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'eval failed');return r.result.value;};
  const until=async(e,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){if(await js(e).catch(()=>false))return true;await sleep(150);}return false;};
  const tapAt=async(x,y)=>{await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await sleep(60);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  const tap=async sel=>{const r=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!r)return false;await tapAt(r.x,r.y);return true;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:INSTRUMENT});
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:dpr,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const t0=Date.now();
  if(player){
   const ch=(await(await fetch(`${base}/api/book/preview?player=${encodeURIComponent(player)}`)).json()).chapter;if(!ch)throw Error('no chapter');
   result.lines=0;const prompts=new Set();const walk=(v,k='')=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(x=>walk(x,k));if(v.clip){result.lines++;if(/spoken|ask|readIt|listen|say|trace|prompt|tap/i.test(k))prompts.add(v.clip);}for(const [kk,x] of Object.entries(v))walk(x,kk);};walk(ch);
   for(const k of Object.keys(ch.ui||{}))if(ch.ui[k]?.clip)prompts.add(ch.ui[k].clip);
   await send('Page.navigate',{url:`${base}/?player=admin#book/${player}`});
   if(!await until(`!!document.querySelector('.bk-open')`,20000))throw Error('the book did not open');
   await tap('.bk-open');
   const click=sel=>js(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(b){b.click();return true}return false})()`);
   const nowPage=()=>js(`[...document.querySelectorAll('.bk-dots i')].findIndex(i=>i.classList.contains('now'))`);
   for(let i=0;i<ch.pages.length&&Date.now()-t0<timeout;i++){const p=ch.pages[i];try{
    if(!await until(`[...document.querySelectorAll('.bk-dots i')].findIndex(i=>i.classList.contains('now'))===${i}`,60000)){result.errors.push(`page ${i+1} never came`);break;}
    const b=p.beat,ans=v=>`.bk-play [data-v="${String(v).replace(/"/g,'\\"')}"]`;
    const tapUntilNext=async sel=>{for(let k=0;k<8;k++){if(await nowPage()!==i)return;await tap(sel);if(await until(`[...document.querySelectorAll('.bk-dots i')].findIndex(x=>x.classList.contains('now'))!==${i}||!!document.querySelector('.bk-card')`,9000))break;}if(await js(`!!document.querySelector('.bk-card')`))await tap('.bk-card [data-a="tap"]');};
    if(p.action){if(p.action.kind==='drive'){await until(`!!document.querySelector('.bk-btn.go')`,90000);await tap('.bk-btn.go');}else{await until(`!!document.querySelector('.bk-ball')`,90000);await sleep(300);await js(`(()=>{const b=document.querySelector('.bk-ball');const r=b.getBoundingClientRect(),o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1};b.dispatchEvent(new PointerEvent('pointerdown',o));b.dispatchEvent(new PointerEvent('pointerup',{...o,clientY:o.clientY-120,clientX:o.clientX+40}));})()`);}}
    if(p.magic){await until(`!!document.querySelector('.bk-magic')`,90000);await sleep(400);await tapUntilNext('.bk-magic');}
    if(b){
     if(b.kind==='teach-letter'){await until(`!!document.querySelector('.bk-glyph')`,90000);if(await until(`!!document.querySelector('.bk-trace')`,25000)){for(let k=0;k<3;k++){await tap('.bk-trace');await sleep(150);}}await sleep(1500);await tapUntilNext('.bk-glyph');}
     if(b.kind==='order'){await until(`document.querySelectorAll('.bk-play .bk-btn.ball').length>=5`,90000);for(let k=1;k<=5;k++){await tap(`.bk-play [data-v="${k}"]`);await sleep(700);}}
     if(b.kind==='stones'){await until(`document.querySelectorAll('.bk-btn.stone').length>0`,90000);for(let k=0;k<b.need;k++){await js(`(()=>{const s=[...document.querySelectorAll('.bk-btn.stone')].find(x=>x.textContent===${JSON.stringify(b.letter)}&&!x.classList.contains('lit'));s&&s.click()})()`);await sleep(700);}}
     if(b.kind==='count'){await until(`document.querySelectorAll('.bk-thing').length===${b.n}`,90000);for(let k=0;k<b.n;k++){await js(`(()=>{const t=[...document.querySelectorAll('.bk-thing')].find(x=>!x.dataset.n);t&&t.click()})()`);await sleep(900);}await until(`!!document.querySelector('${ans(b.answer)}')`,60000);await tap(ans(b.answer));}
     if(b.kind==='kick-letter'){await until(`document.querySelectorAll('.bk-ball').length>=${b.balls.length}`,90000);await sleep(300);await js(`(()=>{const b=[...document.querySelectorAll('.bk-ball')].find(x=>x.dataset.v===${JSON.stringify(b.letter)})||document.querySelector('.bk-ball');if(!b)return;const r=b.getBoundingClientRect(),o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1};b.dispatchEvent(new PointerEvent('pointerdown',o));b.dispatchEvent(new PointerEvent('pointerup',{...o,clientY:o.clientY-120}));})()`);}
     if(b.kind==='signs'){await until(`!!document.querySelector('${ans(b.target)}')`,90000);await tap(ans(b.target));}
     if(b.kind==='spell'){await until(`document.querySelectorAll('.bk-play .bk-btn.word').length>0`,90000);for(const w of b.answer){await js(`(()=>{const t=[...document.querySelectorAll('.bk-play .bk-btn.word')].find(x=>x.textContent===${JSON.stringify(w)}&&!x.classList.contains('used'));t&&t.click()})()`);await sleep(250);}}
     if(b.kind==='share'){await until(`!!document.querySelector('.bk-pizza')`,90000);for(let k=0;k<Math.ceil(b.total/b.groups);k++){await click('.bk-pizza');await sleep(120);}await until(`!!document.querySelector('${ans(b.answer)}')`,60000);await tap(ans(b.answer));}
     if(b.kind==='score'){await until(`!!document.querySelector('${ans(b.answer)}')`,90000);await tap(ans(b.answer));}
     if(b.kind==='no'){await until(`!!document.querySelector('.bk-btn.no')`,90000);await tap('.bk-btn.no');await until(`!!document.querySelector('${ans(b.right)}')`,90000);await tap(ans(b.right));}
    }
    }catch(e){result.errors.push(`page ${i+1}: ${String(e.message).slice(0,160)}`);}
   }
   await until(`!!document.querySelector('.bk-quest')`,40000);result.ended=await js(`!!document.querySelector('.bk-quest')`);
   result.issues=analyse(await js('__sources'),{prompts});
  }else{
   await send('Page.navigate',{url:`${base}/living/index.html?story=${encodeURIComponent(storyId)}&auto=1`});
   if(!await until(`typeof __living==='object'&&__living.beat!=='loading'`,30000))throw Error('the living book did not load');
   // AUTO starts by itself; a trusted tap first so sound is allowed, like a child's first tap.
   await tap('#begin');
   while(Date.now()-t0<timeout){await sleep(1000);const s=await js(`JSON.stringify({b:__living.beat,d:__living.done})`).then(JSON.parse).catch(()=>null);if(s&&(s.d||/^error|fallback/.test(s.b)))break;}
   result.final=await js('__living.beat');result.ended=await js('__living.done');
   const lines=await js('__living.voice');result.lines=lines.length;result.missingClips=[...new Set(lines.filter(l=>!l.clip).map(l=>l.key))];
   const prompts=new Set(lines.filter(l=>/^ui|Say$|^st5|^pk2/.test(l.key)).map(l=>l.clip));
   result.issues=analyse(await js('__sources'),{prompts});
  }
  const log=await js('__sources');result.sources={audio:log.filter(e=>e.kind==='audio').length,tts:log.filter(e=>e.kind==='tts').length,webaudio:log.filter(e=>e.kind==='webaudio').length,getUserMedia:log.filter(e=>e.kind==='getUserMedia')};
  result.log=log.filter(e=>e.kind!=='webaudio').slice(0,400);
  if(mixOut){const m=await js('__stopMix()').catch(()=>null);if(m&&m.b64.length>200){await writeFile(mixOut,Buffer.from(m.b64,'base64'));result.mix=mixOut;}}
  ws.close();
 }catch(e){result.errors.push(String(e.message||e));}
 finally{proc.kill();await sleep(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
 // Hear it: headless Chrome with --mute-audio does not render sound, so the mixdown is rebuilt from the play log:
 // every clip in the order it started, cut where the next line started when the page cut it (a real device plays
 // exactly this), then transcribed with the local recogniser.
 if(flag('--transcribe')&&result.log?.length){const dir=await mkdtemp(join(tmpdir(),'voice-seq-'));const plays=result.log.filter(e=>e.kind==='audio'&&e.src&&!e.err);const list=[];
  try{for(const [i,e] of plays.entries()){const f=join(dir,`c${String(i).padStart(4,'0')}.wav`);const r=await fetch(`${base}/book-voice/${e.src}`);if(!r.ok)continue;await writeFile(f,Buffer.from(await r.arrayBuffer()));list.push(`file '${f}'`);}
   await writeFile(join(dir,'list.txt'),list.join('\n'));result.mix=(mixOut||join(dir,'seq')).replace(/\.\w+$/,'')+'-sequence.wav';
   execFileSync('nice',['-n','19','taskpolicy','-b',process.env.FFMPEG||'ffmpeg','-loglevel','error','-y','-f','concat','-safe','0','-i',join(dir,'list.txt'),'-ac','1','-ar','16000',result.mix]);}catch(e){result.errors.push('sequence: '+String(e.message).slice(0,160));}}
 if(result.mix&&flag('--transcribe')){const wav=result.mix.endsWith('.wav')?result.mix:result.mix.replace(/\.\w+$/,'')+'.wav';try{if(wav!==result.mix)execFileSync('nice',['-n','19','taskpolicy','-b',process.env.FFMPEG||'ffmpeg','-loglevel','error','-y','-i',result.mix,'-ac','1','-ar','16000',wav]);
  const py=(process.env.FAMILY_LISTEN_PYTHON||join(homedir(),'.local/share/whisper-env/bin/python'));
  const out=execFileSync('nice',['-n','19','taskpolicy','-b',py,'-c',`import sys,json\nfrom faster_whisper import WhisperModel\nm=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4)\nsegs,_=m.transcribe(sys.argv[1],language='en',beam_size=1,condition_on_previous_text=False,vad_filter=True)\nprint(json.dumps([[round(s.start,1),round(s.end,1),s.text.strip()] for s in segs]))`,wav],{encoding:'utf8',env:{...process.env,HF_HUB_OFFLINE:'1'},maxBuffer:1<<24});
  result.heard=JSON.parse(out.trim().split('\n').at(-1));
  // Heard twice: the same phrase (4+ words) in two segments less than 6 s apart.
  const norm=s=>s.toLowerCase().replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();result.heardTwice=[];
  for(let i=1;i<result.heard.length;i++){const a=norm(result.heard[i-1][2]),b=norm(result.heard[i][2]);if(a.split(' ').length>=4&&a===b&&result.heard[i][0]-result.heard[i-1][1]<6)result.heardTwice.push(result.heard[i]);}
 }catch(e){result.errors.push('transcribe: '+String(e.message).slice(0,200));}}
 result.ok=!result.errors.length&&!result.issues.length&&result.ended===true&&!(result.heardTwice||[]).length;
 console.log(JSON.stringify(result,null,1));process.exit(result.ok?0:1);
}
if(import.meta.url===`file://${process.argv[1]}`)await main();
