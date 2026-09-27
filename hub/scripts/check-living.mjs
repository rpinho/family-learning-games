#!/usr/bin/env node
// Living book check: plays a hero chapter by itself (auto mode) in a muted headless Chrome, saves a screenshot at
// every beat, optionally records the screen to MP4 (ffmpeg), and reports frame times (optionally with the CPU
// slowed down to approximate a cheap Chromebook). The browser always runs with --mute-audio.
// Usage: node hub/scripts/check-living.mjs --base http://127.0.0.1:5325 --story <id> [--size 1366x768]
//        [--shots <dir>] [--video <file.mp4>] [--cpu 4] [--scale 0.6] [--gpu] [--timeout 420]
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const base=arg('--base','http://127.0.0.1:4810'),hero=arg('--story','night-train'),[W,H]=arg('--size','1366x768').split('x').map(Number);
const shots=arg('--shots'),video=arg('--video'),cpu=Number(arg('--cpu','1')),timeout=Number(arg('--timeout','420'))*1000,label=arg('--label',`${W}x${H}`);
const chrome=arg('--chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=await mkdtemp(join(tmpdir(),'living-chrome-'));
const gpu=flag('--gpu')?['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']:['--enable-unsafe-swiftshader'];
const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--mute-audio','--autoplay-policy=no-user-gesture-required',...gpu,`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
const result={hero,label,size:`${W}x${H}`,cpuSlowdown:cpu,beats:[],errors:[],shots:[]};
let frames=[],recording=false;
try{
 let port=null;for(let i=0;i<100&&!port;i++){await sleep(100);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}}
 if(!port)throw Error('Chrome did not start');
 const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let seq=0;const waiting=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(Error(m.error.message)):ok(m.result);}
  else if(m.method==='Page.screencastFrame'){if(recording)frames.push({data:m.params.data,t:m.params.metadata.timestamp});send('Page.screencastFrameAck',{sessionId:m.params.sessionId}).catch(()=>{});}
  else if(m.method==='Runtime.exceptionThrown')result.errors.push(String(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text).slice(0,300));
  else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')result.errors.push(m.params.args.map(a=>a.value||a.description).join(' ').slice(0,300));};
 const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;waiting.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(waiting.delete(id))no(Error(method+' timed out'));},30000);});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});return r.result?.value;};
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<H});
 if(cpu>1)await send('Emulation.setCPUThrottlingRate',{rate:cpu});
 await send('Page.navigate',{url:`${base}/living/index.html?story=${hero}&auto=1&debug=1${arg('--scale')?'&scale='+arg('--scale'):''}`});
 const t0=Date.now();
 // Record from the moment the page is up (a screencast cannot start mid-navigation).
 if(video){for(let i=0;i<60;i++){const ok=await js("typeof __living==='object'").catch(()=>false);if(ok)break;await sleep(250);}recording=true;await send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:W,maxHeight:H,everyNthFrame:1});}let lastBeat='',n=0;
 while(Date.now()-t0<timeout){await sleep(400);const s=await js('JSON.stringify({beat:__living.beat,done:__living.done,stats:__living.stats})').catch(()=>null);if(!s)continue;const st=JSON.parse(s);
  if(st.beat!==lastBeat){lastBeat=st.beat;result.beats.push({at:Date.now()-t0,beat:st.beat});
   if(shots&&!/^say:/.test(st.beat)||shots&&/say:(st2|st6|mz1|found|end|d1|d2|d3|d6|d7)/.test(st.beat)){await sleep(st.beat.startsWith('say:')?1600:900);await mkdir(shots,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});const f=join(shots,`${hero}-${label}-${String(++n).padStart(2,'0')}-${st.beat.replace(/[^a-z0-9-]+/gi,'_')}.png`);await writeFile(f,Buffer.from(r.data,'base64'));result.shots.push(f);}}
  result.stats=st.stats;if(st.done||/^error|fallback/.test(st.beat))break;}
 if(video){recording=false;await send('Page.stopScreencast').catch(()=>{});}
 result.final=await js('JSON.stringify(__living)').then(JSON.parse).catch(()=>null);result.stats=result.final?.stats;
 ws.close();
}catch(e){result.errors.push(String(e.message||e));}
finally{proc.kill();await sleep(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
// Video: the screencast frames, timed as they came, into an H.264 MP4 (30 fps).
if(video&&frames.length){const dir=await mkdtemp(join(tmpdir(),'living-frames-'));const list=[];
 for(let i=0;i<frames.length;i++){const f=join(dir,`f${String(i).padStart(5,'0')}.jpg`);await writeFile(f,Buffer.from(frames[i].data,'base64'));const d=i+1<frames.length?Math.max(.001,frames[i+1].t-frames[i].t):.1;list.push(`file '${f}'\nduration ${d.toFixed(4)}`);}
 await writeFile(join(dir,'list.txt'),list.join('\n'));
 await new Promise(r=>{const ff=spawn('nice',['-n','19','taskpolicy','-b',process.env.FFMPEG||'ffmpeg','-loglevel','error','-y','-f','concat','-safe','0','-i',join(dir,'list.txt'),'-vf','fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','23',video],{stdio:'inherit'});ff.on('close',r);});
 await rm(dir,{recursive:true,force:true});result.video=video;result.videoFrames=frames.length;}
result.ok=!result.errors.length&&result.final?.done===true;
console.log(JSON.stringify(result,null,1));process.exit(result.ok?0:1);
