#!/usr/bin/env node
// Narration gate: every line a child can hear must have its own clip (made by the household's voice engine), and
// the clip file must exist. Checks the living-book stories and every chapter from today on, in one book folder.
// The deploy tooling runs it before a hub release goes to staging or live; a missing clip refuses the release
// and names each line (the device's robotic voice is never a fallback).
// Usage: node hub/scripts/check-clips.mjs --book <dir> [--today YYYY-MM-DD] [--json]
import {readFile,readdir,access} from 'node:fs/promises';
import {join} from 'node:path';
import {resolveVoices} from '../../book/paths.mjs';
import {setRookVoice} from '../../book/assemble.mjs';
import {clipName} from '../book-service.mjs';
const args=process.argv.slice(2),arg=(k,d=null)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
export async function missingClips(book,{today=new Date().toISOString().slice(0,10)}={}){
 const missing=[],exists=async f=>{try{await access(join(book,'voice',f));return true;}catch{return false;}};
 let f=null;try{f=JSON.parse(await readFile(join(book,'living','stories.json'),'utf8'));}catch{}
 let named={};try{named=JSON.parse(await readFile(join(book,'cast.json'),'utf8')).voices||{};}catch{}
 for(const [id,s] of Object.entries(f?.stories||{})){const voices=resolveVoices(s.voices,named);for(const [key,[who,text]] of Object.entries(s.lines||{})){if(!text)continue;
  const v=voices[who]||voices.narrator;const clip=v&&f.clips?.[`${v.voice}|${v.speed}|${text}`];
  if(!clip)missing.push({where:`living:${id}`,key,text});else if(!await exists(clip))missing.push({where:`living:${id}`,key,text,file:clip});}}
 let players=[];try{players=(await readdir(book,{withFileTypes:true})).filter(d=>d.isDirectory()&&!['voice','art','cast','living'].includes(d.name)).map(d=>d.name);}catch{}
 for(const p of players){let files=[];try{files=(await readdir(join(book,p))).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)&&x.slice(0,10)>=today);}catch{}
  for(const file of files){let ch;try{ch=JSON.parse(await readFile(join(book,p,file),'utf8'));}catch{continue;}
   for(const l of setRookVoice(ch,named.rook||'am_michael'))l.clip=clipName(l);
   const lines=[];const walk=(v,path)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach((x,i)=>walk(x,`${path}[${i}]`));if(typeof v.text==='string'&&v.voice)lines.push([path,v]);for(const [k,x] of Object.entries(v))if(x&&typeof x==='object')walk(x,`${path}.${k}`);};
   for(const k of ['cover','pages','ui','quest'])walk(ch[k],k);
   for(const [path,l] of lines){if(!l.text.trim())continue;if(!l.clip)missing.push({where:`${p}/${file}`,key:path,text:l.text});else if(!await exists(l.clip))missing.push({where:`${p}/${file}`,key:path,text:l.text,file:l.clip});}}}
 return missing;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const book=arg('--book');if(!book){console.error('usage: check-clips.mjs --book <dir>');process.exit(2);}
 const m=await missingClips(book,{today:arg('--today')||undefined});
 if(args.includes('--json'))console.log(JSON.stringify({ok:!m.length,missing:m}));
 else if(m.length)console.error(`${m.length} line(s) without a voice clip:\n`+m.slice(0,40).map(x=>`  ${x.where} ${x.key}: "${x.text.slice(0,70)}"${x.file?` (file ${x.file} missing)`:''}`).join('\n'));
 else console.log('every line has its clip');
 process.exit(m.length?1:0);
}
