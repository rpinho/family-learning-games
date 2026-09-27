#!/usr/bin/env node
// Listening check: synthetic child-like utterances (Kokoro, pitch and formants raised, room noise) through the
// local recogniser and the child-tolerant matcher. Reports how often a right answer is accepted, how often a wrong
// one is (false accepts), and the recognition time. Synthetic voices are not children: treat the numbers as a floor
// check, not a measurement on real children.
// Usage: node hub/scripts/check-listen.mjs --voice-python <py with kokoro_onnx> --models <kokoro dir>
//        --listen-python <py with faster_whisper> [--model small] [--no-prompt] [--base http://127.0.0.1:5325]
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide,promptFor,rankFor} from '../listen/match.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;},flag=k=>args.includes(k);
const WORDS=[['bed','bird'],['mat','man'],['bat','ball'],['cat','can'],['dog','dot'],['sun','sum'],['pig','pin'],['hat','has'],['red','rest'],['fish','fit'],['ship','sit'],['frog','from'],['tree','trip'],['jump','just'],['stop','spot'],['look','book'],['moon','moose'],['book','boot'],['train','trail'],['star','stay'],['duck','dump'],['map','mad'],['pen','pet'],['box','bus']];
const LETTERS=[['l','[[lll]]','Loona','[[mmm]]'],['m','[[mmm]]','moon','[[sss]]'],['s','[[sss]]','Sparkle','[[lll]]'],['b','[[bə]]','ball','[[mmm]]'],['d','[[də]]','Dad','[[sss]]'],['p','[[pə]]','pizza','[[lll]]'],['n','[[nnn]]','nest','[[sss]]'],['t','[[tə]]','train','[[mmm]]']];
const VOICES=[['af_heart',1.3,20],['af_sky',1.3,20],['af_bella',1.3,20],['bf_emma',1.3,20],['am_puck',1.45,20],['af_nicole',1.3,10]];
const items=[];
for(const [v,shift,snr] of VOICES){const tag=`${v}-${snr}`;
 for(const [w,wrong] of WORDS){items.push({id:`${tag}-w-${w}`,text:w,voice:v,shift,snr,target:{kind:'word',word:w},expect:true,group:'reader: right word'});
  items.push({id:`${tag}-x-${w}`,text:wrong,voice:v,shift,snr,target:{kind:'word',word:w},expect:false,group:'reader: wrong word'});}
 for(const [l,sound,word,wrong] of LETTERS){const t={kind:'letter',letter:l.toUpperCase(),names:[l==='l'?'Loona':'']};
  items.push({id:`${tag}-ls-${l}`,text:sound,voice:v,shift,snr,target:t,expect:true,group:'letter: its sound'});
  items.push({id:`${tag}-ln-${l}`,text:l.toUpperCase()+'.',voice:v,shift,snr,target:t,expect:true,group:'letter: its name'});
  items.push({id:`${tag}-lw-${l}`,text:word,voice:v,shift,snr,target:t,expect:true,group:'letter: a word or name with it'});
  items.push({id:`${tag}-lx-${l}`,text:wrong,voice:v,shift,snr,target:t,expect:false,group:'letter: another sound'});}}
const dir=arg('--dir')||await mkdtemp(join(tmpdir(),'listen-check-'));
const synth=flag('--skip-synth')?{status:0}:spawnSync(arg('--voice-python'),[join(here,'..','listen','synth.py'),await (async()=>{const f=join(dir,'req.json');await writeFile(f,JSON.stringify({models:arg('--models'),out:dir,items}));return f;})()],{encoding:'utf8'});
if(synth.status!==0){console.error(synth.stderr);process.exit(1);}
const usePrompt=!flag('--no-prompt');let ask;
if(arg('--base')){
 // Through the hub's endpoint (what the page does), grown-up preview mode so the transcript comes back.
 ask=async(pcm,target)=>{const t=Date.now();const r=await fetch(`${arg('--base')}/api/listen?player=${arg('--player','admin')}&preview=1&target=${encodeURIComponent(JSON.stringify(target))}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:pcm});const j=await r.json();return {text:j.heard??'',ms:j.ms,rt:Date.now()-t,match:j.match};};
}else{
 const w=spawn(arg('--listen-python'),[join(here,'..','listen','worker.py'),'--model',arg('--model','small')],{stdio:['pipe','pipe','inherit']});
 let buf='',waiters=[];w.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);waiters.shift()?.(JSON.parse(l));}});
 const next=()=>new Promise(r=>waiters.push(r));const ready=await next();console.error('worker',JSON.stringify(ready));
 let id=0;ask=async(pcm,target)=>{const t=Date.now(),p=next();w.stdin.write(JSON.stringify({id:++id,pcm:pcm.toString('base64'),prompt:usePrompt?promptFor(target):'',...(flag('--no-rank')?{}:{rank:rankFor(target)})})+'\n');const r=await p;return {...r,rt:Date.now()-t};};
 process.on('exit',()=>w.kill());
}
const groups={},lat=[],rts=[],misses=[];
for(const it of items){const pcm=await readFile(join(dir,it.id+'.pcm'));const r=await ask(pcm,it.target);const m=r.match??decide(r,it.target).match;
 const g=groups[it.group]??={n:0,accepted:0,expect:it.expect};g.n++;if(m)g.accepted++;if(m!==it.expect)misses.push(`${it.id}: said "${it.text}" heard "${r.text}" -> ${m}`);
 if(r.ms!=null)lat.push(r.ms);rts.push(r.rt);}
const pct=(a,b)=>(100*a/b).toFixed(1)+'%',q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const out={model:arg('--model','small'),prompt:usePrompt,rank:!flag('--no-rank'),via:arg('--base')?'hub':'worker',utterances:items.length,
 groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,`${g.expect?'accepted':'FALSE-accepted'} ${g.accepted}/${g.n} (${pct(g.accepted,g.n)})`])),
 decodeMs:{p50:q(lat,.5),p90:q(lat,.9),max:Math.max(...lat)},roundTripMs:{p50:q(rts,.5),p90:q(rts,.9),max:Math.max(...rts)},misses:flag('--verbose')?misses:misses.length};
console.log(JSON.stringify(out,null,1));
if(!arg('--dir'))await rm(dir,{recursive:true,force:true});
process.exit(0);
