#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles,localDate,addDays} from './paths.mjs';
import {bookPlayers} from './build-learner.mjs';
import {generateOne} from './generate.mjs';
import {slot,readJSON} from './review.mjs';
import {notify} from './notify.mjs';
// Only NEW drafts are emailed: a scheduled run that finds today's drafts already written (and maybe under review)
// leaves them alone and sends nothing (2026-10-02: the 11:30 job would have re-sent the 08:51 email).
export async function draft({paths=bookPaths(),date=addDays(localDate(Date.now(),paths.timeZone),1),players=bookPlayers(paths,readProfiles(paths)),send=notify,generate=generateOne,log=console.log}={}){
 const chapters=[],errors=[];for(const player of players){try{const r=await generate(player,{paths,profiles:readProfiles(paths),date,review:true,log});const ch=await readJSON(slot(paths.book,player,date,true)+'.json');if(ch&&!r?.skipped)chapters.push(ch);}catch(e){errors.push(e);log(`${player}: ${e.message}`);}}
 if(chapters.length)await send({paths,date,kind:'draft',chapters});if(errors.length)throw new AggregateError(errors,'Some drafts failed.');return {date,chapters};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];await draft({...args.includes('--date')?{date:arg('--date')}:{},...args.includes('--player')?{players:[arg('--player')]}:{}});}
