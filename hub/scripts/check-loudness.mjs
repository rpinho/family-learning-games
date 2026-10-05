#!/usr/bin/env node
// Loudness gate: every narration clip a child can hear, fetched from a running hub exactly as the Book and the Letter
// Hunts ask for it, must be within LOUDNESS.tolerance LU of LOUDNESS.target (hub/voice-level.mjs), whoever speaks.
// Checks the chapters from --since on (default today; --all for every chapter), every hunt and the living stories,
// and prints each speaker's loudness (median, min, max). Exit 1 on any clip off target.
// Usage: node hub/scripts/check-loudness.mjs --base http://127.0.0.1:<hub port> --book <dir> [--since YYYY-MM-DD|--all]
//        [--ext webm,wav] [--json]
//        node hub/scripts/check-loudness.mjs --book <dir> --list [--all]   (the clips only, as JSON: check-voice-sets.py)
import {readFile,readdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setCharacterVoices,setHuntVoices} from '../../book/assemble.mjs';
import {resolveVoices} from '../../book/paths.mjs';
import {clipName} from '../book-service.mjs';
import {LOUDNESS,loudness} from '../voice-level.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const readJSON=async f=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return null;}};
// Every clip a child can hear: {file, voice, where}.
export async function heardClips(book,{since=null}={}){
 const out=new Map(),add=(l,where)=>{if(!String(l.text||'').trim()||!l.voice)return;const file=clipName(l);if(!out.has(file))out.set(file,{file,voice:l.voice,speed:l.speed,text:l.text,where});};
 const walk=(v,where)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(x=>walk(x,where));if(typeof v.text==='string'&&v.voice)add(v,where);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,where);};
 const cast=await readJSON(join(book,'cast.json'))||{};
 const living=await readJSON(join(book,'living','stories.json'));
 for(const [id,s] of Object.entries(living?.stories||{})){const voices=resolveVoices(s.voices,cast.voices||{});
  for(const [who,text] of Object.values(s.lines||{})){const v=voices[who]||voices.narrator,file=v&&living.clips?.[`${v.voice}|${v.speed}|${text}`];
   if(file&&!out.has(file))out.set(file,{file,voice:v.voice,speed:v.speed,text,where:'living:'+id});}}
 let players=[];try{players=(await readdir(book,{withFileTypes:true})).filter(d=>d.isDirectory()&&!['voice','voice-aac','art','cast','living'].includes(d.name)&&!d.name.startsWith('voice-')).map(d=>d.name);}catch{}
 for(const p of players){let files=[];try{files=(await readdir(join(book,p))).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)&&(!since||x.slice(0,10)>=since));}catch{}
  for(const f of files){const ch=await readJSON(join(book,p,f));if(!ch?.pages)continue;setCharacterVoices(ch,cast);for(const k of ['cover','pages','ui','quest','keysLine'])walk(ch[k],`${p}/${f}`);}}
 const hunts=await readJSON(join(book,'hunts.json'));
 for(const [p,cfg] of Object.entries(hunts?.players||{})){setHuntVoices(cfg,cast);walk(cfg,'hunts/'+p);}
 return [...out.values()];}
if(import.meta.url===`file://${process.argv[1]}`){
 const base=arg('--base'),book=arg('--book');
 if(book&&args.includes('--list')){process.stdout.write(JSON.stringify(await heardClips(book,{since:args.includes('--all')?null:arg('--since',new Date().toISOString().slice(0,10))}))+'\n');}
 else{
 if(!base||!book){console.error('usage: check-loudness.mjs --base URL --book <dir> [--since YYYY-MM-DD|--all]');process.exit(2);}
 const since=args.includes('--all')?null:arg('--since',new Date().toISOString().slice(0,10)),exts=arg('--ext','webm').split(',');
 const clips=await heardClips(book,{since}),tmp=await mkdtemp(join(tmpdir(),'check-loudness-')),rev=LOUDNESS.rev,bad=[],per={};
 try{for(const c of clips)for(const ext of exts){
   const r=await fetch(`${base}/book-voice/${c.file.slice(0,-4)}.${ext}?r=${rev}`);if(!r.ok){bad.push({...c,ext,why:'HTTP '+r.status});continue;}
   const f=join(tmp,c.file.slice(0,-4)+'.'+ext);await writeFile(f,Buffer.from(await r.arrayBuffer()));const m=await loudness(f);
   if(!m){bad.push({...c,ext,why:'silent'});continue;}
   (per[c.voice]??=[]).push(m.lufs);
   if(Math.abs(m.lufs-LOUDNESS.target)>LOUDNESS.tolerance)bad.push({...c,ext,lufs:m.lufs,why:`${m.lufs.toFixed(1)} LUFS (target ${LOUDNESS.target} ± ${LOUDNESS.tolerance})`});}}
 finally{await rm(tmp,{recursive:true,force:true});}
 const summary=Object.fromEntries(Object.entries(per).map(([v,a])=>{a.sort((x,y)=>x-y);return [v,{n:a.length,median:+a[a.length>>1].toFixed(1),min:+a[0].toFixed(1),max:+a.at(-1).toFixed(1)}];}));
 if(args.includes('--json'))console.log(JSON.stringify({target:LOUDNESS.target,tolerance:LOUDNESS.tolerance,clips:clips.length,summary,bad}));
 else{for(const [v,s] of Object.entries(summary))console.log(`${v.padEnd(44)} n=${String(s.n).padStart(3)}  median ${s.median}  min ${s.min}  max ${s.max} LUFS`);
  for(const b of bad)console.log('FAIL',b.file,b.ext,b.where,b.why);
  console.log(bad.length?`${bad.length} clips off target`:`loudness ok: ${clips.length} clips within ${LOUDNESS.tolerance} LU of ${LOUDNESS.target} LUFS`);}
 process.exitCode=bad.length?1:0;}}
