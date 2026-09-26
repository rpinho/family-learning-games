#!/usr/bin/env node
// Rebuild every child's learner model from the games' saves and logs. Read-only on saves.
// Usage: node book/build-learner.mjs [--player id] [--out dir]
import {readFile,readdir,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLearner,GAMES} from './learner.mjs';
import {bookPaths,readProfiles,localDate,addDays} from './paths.mjs';

const readJSON=async(file,fallback=null)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return fallback;}};
export async function saveOf(dir,player){if(!dir)return null;return readJSON(join(dir,player+'.json'));}
// Word-break results from the last `days` days of a game's diagnostics (any of the row shapes the games use).
export async function wordBreakRows(dir,player,{days=7,now=Date.now()}={}){
 const logs=join(dir||'','logs');let names=[];try{names=await readdir(logs);}catch{return [];}
 const since=new Date(now-days*864e5).toISOString().slice(0,10);
 const out=[];
 for(const name of names.filter(n=>/^\d{4}-\d{2}-\d{2}/.test(n)&&n.endsWith('.jsonl')&&n.slice(0,10)>=since).sort()){
  let text;try{text=await readFile(join(logs,name),'utf8');}catch{continue;}
  for(const line of text.split('\n')){
   if(!line.includes('word-break')&&!line.includes('word_break'))continue;
   let r;try{r=JSON.parse(line);}catch{continue;}
   if(r.player!==player||!/word.?break/i.test(String(r.type||'')+' '+String(r.kind||'')))continue;
   let d=r.detail;if(typeof d==='string'){try{d=JSON.parse(d);}catch{continue;}}
   if(!d||typeof d!=='object'||!d.kind)continue;
   out.push({at:r.at,kind:d.kind,answer:d.answer,misses:Number(d.misses)||0,ms:Number(d.ms)||0,reason:d.reason||''});
  }
 }
 return out;
}
export async function recentChapters(bookDir,player,before){
 let names=[];try{names=await readdir(join(bookDir,player));}catch{return [];}
 const out=[];for(const n of names.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)&&n.slice(0,10)<before).sort().slice(-5)){const c=await readJSON(join(bookDir,player,n));if(c)out.push({date:c.date,title:c.title,summary:c.summary,hook:c.hook});}
 return out;
}
export async function readNotes(file){const n=await readJSON(file,null);return Array.isArray(n?.notes)?n.notes:[];}
export async function latestRecap(dir,player,upTo){
 let names=[];try{names=await readdir(dir);}catch{return null;}
 for(const n of names.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)&&n.slice(0,10)<=upTo).sort().reverse().slice(0,5)){
  const r=await readJSON(join(dir,n));if(r?.kids?.some(k=>k.player===player&&k.played))return r;
 }
 return null;
}
// Games opened from the hub on one local date (the hub's own diagnostics, read-only).
export async function hubOpens(dir,player,date,timeZone){
 if(!dir)return [];const out=[];const next=addDays(date,1);
 for(const d of [date,next]){let text='';try{text=await readFile(join(dir,'logs',d+'.jsonl'),'utf8');}catch{continue;}
  for(const line of text.split('\n')){if(!line.includes('open_game')||!line.includes(`"player":"${player}"`))continue;let r;try{r=JSON.parse(line);}catch{continue;}
   if(r.kind==='open_game'&&r.player===player&&localDate(Date.parse(r.at),timeZone)===date)out.push(String(r.detail||''));}}
 return out;
}
export async function learnerFor(player,{paths=bookPaths(),profiles=readProfiles(paths),now=Date.now(),chapterDate}={}){
 const profile=profiles[player]||{};
 const name=paths.config?.players?.find(p=>p.id===player)?.name||profile.name||player;
 const saves={};for(const g of GAMES)saves[g]=await saveOf(paths.data[g],player);
 saves.chess=paths.data.hub?await saveOf(join(paths.data.hub,'chess'),player):null;
 const wordBreaks=[];for(const g of GAMES)wordBreaks.push(...await wordBreakRows(paths.data[g],player,{now}));
 wordBreaks.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const today=localDate(now,paths.timeZone),date=chapterDate||today;
 const recap=await latestRecap(paths.recap,player,addDays(date,-1));
 const playDate=addDays(date,-1);
 return buildLearner({player,name,profile,now,saves,wordBreaks,recap,notes:await readNotes(paths.notes),chapters:await recentChapters(paths.book,player,date),opens:await hubOpens(paths.data.hub,player,playDate,paths.timeZone),playDate,timeZone:paths.timeZone});
}
export async function writeLearner(model,dir){
 await mkdir(dir,{recursive:true,mode:0o700});const file=join(dir,model.player+'.json');
 await writeFile(file+'.tmp',JSON.stringify(model,null,1),{mode:0o600});await rename(file+'.tmp',file);return file;
}
export function bookPlayers(paths,profiles){return Object.keys(profiles).filter(id=>!paths.config?.players||paths.config.players.some(p=>p.id===id));}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
 const paths=bookPaths(),profiles=readProfiles(paths),out=arg('--out')||paths.learner;
 const players=arg('--player')?[arg('--player')]:bookPlayers(paths,profiles);
 if(!players.length){console.error('No players: add book/profiles.json under the deploy root.');process.exit(1);}
 for(const p of players){const m=await learnerFor(p,{paths,profiles,chapterDate:arg('--date')||undefined});console.log(await writeLearner(m,out));}
}
