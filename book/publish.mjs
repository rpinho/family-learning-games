#!/usr/bin/env node
import {verifyQuestPublication} from './episodes/certify.mjs';
import {rename,copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles} from './paths.mjs';
import {bookPlayers} from './build-learner.mjs';
import {slot,readJSON,atomicJSON,withSlotLock,backupSlot,reviewEvent} from './review.mjs';
import {payPublished} from './adventure/ledger.mjs';
import {dayNotesDir,markUsed} from './daynotes.mjs';
export async function publishOne(player,{paths=bookPaths(),date,approve=false,auto=false,by='grown-up',revision,lockHeld=false,now=Date.now()}={}){
 const work=async()=>{
  const draft=slot(paths.book,player,date,true),live=slot(paths.book,player,date),ch=await readJSON(draft+'.json'),previous=await readJSON(live+'.json');
  if(previous?.meta?.review?.state==='approved'){await payPublished(paths.book,player,previous);return {player,date,skipped:true,state:'approved'};}
  if(!ch){if(previous?.meta?.review)return {player,date,skipped:true,state:previous.meta.review.state};throw Error('No review draft.');}
  if(revision&&ch.meta?.review?.revision!==revision)throw Object.assign(Error('The draft changed. Reload before approving.'),{status:409});
  if(!approve&&!auto&&ch.meta?.review?.state!=='approved')throw Error('This draft has not been approved.');
  if(ch.player!==player||ch.date!==date||ch.schema!=='family-book-chapter-2'||!ch.pages?.length)throw Error('Invalid review chapter.');
  await verifyQuestPublication(ch,{paths});
  const state=auto?'auto':'approved';const backup=await backupSlot(live);
  // Keep the review receipt before the commit point so retries recover a partially finished publish.
  ch.meta.review={...ch.meta.review,state,at:new Date(now).toISOString(),by:auto?'deadline':by};
  await atomicJSON(draft+'.json',ch);await atomicJSON(draft+'.receipt.json',ch);
  for(const ext of ['.md','.calm.json']){try{await copyFile(draft+ext,live+ext);}catch(e){if(e.code!=='ENOENT')throw e;}}
  await rename(draft+'.json',live+'.json'); // atomic child-visible commit point
  await payPublished(paths.book,player,ch);
  if(ch.meta.daynotes?.length)await markUsed(dayNotesDir(paths),ch.meta.daynotes,player,`${player}/${date}`,now);
  await reviewEvent(paths.book,{action:'publish',player,date,state,by:ch.meta.review.by,title:ch.title,revision:ch.meta.review.revision});
  return {player,date,state,title:ch.title,backup};
 };return lockHeld?work():withSlotLock(paths.book,player,date,work);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1],paths=bookPaths(),date=args.includes('--date')?arg('--date'):null;
 if(!date)throw Error('--date is required.');
 const players=args.includes('--player')?[arg('--player')]:bookPlayers(paths,readProfiles(paths));
 for(const player of players)console.log(await publishOne(player,{paths,date}));
}
