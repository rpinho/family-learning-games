#!/usr/bin/env node
// The Book's part of the parent recap: merged into the day's recap files (written by the family recap script) as
// kids[].book in <recap>/<date>.json and a "The Book" section in <date>.md (and latest.* when they are that date).
// Per child: the chapter (reached, finished), every beat (tries, right on the first try, a fast tap = a guess under
// 1.5 s, time), time per page, the fork choice and quest item, and the Letter Hunts (found, how many, how long).
// Read-only on the book's data; idempotent (re-running replaces the section). Runs in the nightly right after the
// recap script, so the morning recap and the Sage cross-check see it.
// Usage: node book/recap-book.mjs [--date YYYY-MM-DD]   (default: the kids' day, today after noon, else yesterday)
import {readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {bookPaths,localDate,addDays} from './paths.mjs';

const readJSON=async(f,d=null)=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return d;}};
const atomic=async(f,t)=>{await writeFile(f+'.tmp',t,{mode:0o600});await rename(f+'.tmp',f);};
const sec=ms=>Math.round((Number(ms)||0)/1000);

// One child's book day, from the progress file (and the chapter, for what each beat was).
export function bookDay(progress,chapter,date){
 const day=progress?.days?.[date];if(!day&&!chapter)return null;
 const pages=chapter?.pages||[],beatAt=i=>pages[i]?.beat||null;
 const beats=(day?.results||[]).filter(r=>r.kind).map(r=>{const b=beatAt(r.page);
  const tries=r.attempts??((r.misses||0)+1),firstTry=r.correct!=null?(r.correct&&tries===1):(r.misses||0)===0;
  return {page:r.page+1,kind:r.kind,...(b?.variant?{variant:b.variant}:{}),...(b?.id?{beat:b.id}:{}),tries,firstTry,fastTap:!!r.guess,
   ...(r.firstTapMs!=null?{firstTapSec:Math.round(r.firstTapMs/100)/10}:{}),seconds:sec(r.ms),...(r.hints?{hints:r.hints}:{}),...(r.via?{via:r.via}:{}),...(r.choice?{choice:r.choice}:{})};});
 const dwell=Object.entries(day?.dwell||{}).map(([p,ms])=>[Number(p)+1,sec(ms)]).sort((a,b)=>a[0]-b[0]);
 const hunts=(day?.hunts||[]).map(h=>({id:h.id,found:!!h.foundAt,...(h.found!=null?{count:h.found}:{}),...(h.ms!=null?{minutes:Math.round(h.ms/6e4)}:{})}));
 const fork=beats.find(b=>b.kind==='fork'),item=fork?.choice&&pages.flatMap(p=>p.beat?.kind==='fork'?p.beat.options:[]).find(o=>o.id===fork.choice)?.item;
 const scored=beats.filter(b=>b.kind!=='fork');
 return {title:chapter?.title||null,opened:!!day?.opens,reached:day?Math.min(pages.length||Infinity,(day.page||0)+1):0,pages:pages.length,finished:!!day?.finished,
  firstTryRight:`${scored.filter(b=>b.firstTry).length}/${scored.length}`,guesses:scored.filter(b=>b.fastTap).length,
  beats,pageSeconds:Object.fromEntries(dwell),minutes:Math.round((dwell.length?dwell.reduce((n,[,s])=>n+s,0):beats.reduce((n,b)=>n+b.seconds,0))/60),timeFrom:dwell.length?'pages':'beats',
  ...(item?{item:item.name}:{}),hunts};
}
export function bookMarkdown(kids){
 const md=['<!-- book -->','## The Book'];
 for(const k of kids){const b=k.book;
  if(!b||!b.opened&&!b.hunts.length){md.push(`- **${k.name}:** not opened.`);continue;}
  md.push(`- **${k.name}:** "${b.title||'chapter'}", page ${b.reached} of ${b.pages}${b.finished?' (finished)':''}, about ${b.minutes} min${b.timeFrom==='beats'?' on the games':''}; right on the first try ${b.firstTryRight}${b.guesses?`, ${b.guesses} fast tap${b.guesses>1?'s':''} (under 1.5 s: guesses)`:''}${b.item?`; chose ${b.item}`:''}.`);
  const hard=b.beats.filter(x=>!x.firstTry&&x.kind!=='fork');
  if(hard.length)md.push(`  - Needed more tries: ${hard.map(x=>`${x.variant||x.kind} (${x.tries} tries${x.hints?', hint':''})`).join(', ')}`);
  if(b.hunts.length)md.push(`  - Letter Hunts: ${b.hunts.map(h=>`${h.id} ${h.found?`found${h.count!=null?` ${h.count}`:''}${h.minutes!=null?` in ${h.minutes} min`:''}`:'not finished'}`).join('; ')}`);
 }
 md.push('<!-- /book -->');return md.join('\n');
}
export async function mergeRecap({paths=bookPaths(),date,recapDir=paths.recap}={}){
 const file=join(recapDir,date+'.json'),r=await readJSON(file);if(!r)return {date,merged:false,reason:'no recap for that date'};
 for(const k of r.kids||[]){const prog=paths.data.hub?await readJSON(join(paths.data.hub,'book-progress',k.player+'.json'),null):null,ch=await readJSON(join(paths.book,k.player,date+'.json'),null);k.book=bookDay(prog,ch,date);}
 await atomic(file,JSON.stringify(r,null,1));
 const section=bookMarkdown(r.kids||[]),mdFile=join(recapDir,date+'.md');let md=await readFile(mdFile,'utf8').catch(()=>'');
 md=md.replace(/\n?<!-- book -->[\s\S]*?<!-- \/book -->\n?/,'\n').trimEnd()+'\n\n'+section+'\n';await atomic(mdFile,md);
 const latest=await readJSON(join(recapDir,'latest.json'));if(latest?.date===date){await atomic(join(recapDir,'latest.json'),JSON.stringify(r,null,1));await atomic(join(recapDir,'latest.md'),md);}
 return {date,merged:true,kids:(r.kids||[]).map(k=>({player:k.player,opened:!!k.book?.opened,beats:k.book?.beats.length||0,hunts:k.book?.hunts.length||0}))};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const args=process.argv.slice(2),i=args.indexOf('--date'),paths=bookPaths(),now=Date.now();
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(now));
 const date=i>=0?args[i+1]:(hour<12?addDays(localDate(now,paths.timeZone),-1):localDate(now,paths.timeZone));
 try{console.log(JSON.stringify(await mergeRecap({paths,date})));}catch(e){console.error('book recap failed:',e.message);process.exit(1);}
}
