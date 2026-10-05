#!/usr/bin/env node
import {verifyQuestPublication} from './episodes/certify.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {bookPaths,readProfiles,localDate,addDays} from './paths.mjs';
import {bookPlayers} from './build-learner.mjs';
import {slot,readJSON,atomicJSON,withSlotLock} from './review.mjs';
import {generateOne} from './generate.mjs';
import {publishOne} from './publish.mjs';
import {notify} from './notify.mjs';
import {renderCalm} from './calm-lines.mjs';
// 2026-10-02: "they only need to publish before they wake up") it is today's; run in the evening, tomorrow's.
export function deadlineDate(now=Date.now(),timeZone){const hour=Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone}).format(now));return addDays(localDate(now,timeZone),hour<12?0:1);}
export async function deadline({paths=bookPaths(),date=deadlineDate(Date.now(),paths.timeZone),players=bookPlayers(paths,readProfiles(paths)),generate=generateOne,publish=publishOne,send=notify,calm=renderCalm,hunts=()=>spawnSync(process.execPath,[fileURLToPath(new URL('./hunts.mjs',import.meta.url)),'--date',date],{stdio:'inherit',timeout:900e3}),log=console.log}={}){
 const done=[],autos=[],errors=[];
 for(const player of players){try{await withSlotLock(paths.book,player,date,async()=>{
  const live=await readJSON(slot(paths.book,player,date)+'.json');
  if(live?.meta?.review?.state){done.push({player,skipped:true,state:live.meta.review.state});if(live.meta.review.state==='auto')autos.push(live);return;}
  const ch=await readJSON(slot(paths.book,player,date,true)+'.json');
  if(ch){const r=await publish(player,{paths,date,lockHeld:true,auto:ch.meta?.review?.state!=='approved'});done.push(r);if(r.state==='auto')autos.push(await readJSON(slot(paths.book,player,date)+'.json'));}
  else {const r=await generate(player,{paths,profiles:readProfiles(paths),date,lockHeld:true,log});const c=r.chapter||await readJSON(r.file);if(!c)throw Error('No morning chapter.');await verifyQuestPublication(c,{paths});
   try{if(!c.episode)c.calm=await calm(c,{paths});}catch(e){log(`${player}: calm narration failed; ordinary narration remains`);}c.meta??={};c.meta.review={state:'auto',at:new Date().toISOString(),by:'deadline (no draft)'};await atomicJSON(slot(paths.book,player,date)+'.json',c);autos.push(c);done.push({player,state:'auto',fallback:true});}
 },{waitMs:45*60e3});}catch(e){errors.push(e);log(`${player}: deadline failed: ${e.message}`);}}
 if(autos.length)try{await send({paths,date,kind:'auto',chapters:autos});}catch(e){errors.push(e);}
 const h=await hunts();if(h?.status&&h.status!==0)errors.push(Error('Letter Hunts failed.'));
 if(errors.length)throw new AggregateError(errors,'Book deadline incomplete.');return {date,done};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];console.log(await deadline({...args.includes('--date')?{date:arg('--date')}:{},...args.includes('--player')?{players:[arg('--player')]}:{}}));}
