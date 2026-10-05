import {readFile,writeFile,mkdir,rename,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createWorldModel} from './public/world-model.mjs';
export function worldStore({bookDir,players,definitions={}}){
 const dir=join(bookDir,'world');let queue=Promise.resolve();
 const file=(player,preview)=>{if(!players.includes(player)||!/^\w{1,24}$/.test(player))throw Object.assign(Error('Choose a player.'),{status:400});if(typeof preview==='string'&&!/^[a-z0-9-]{1,90}$/.test(preview))throw Error('Invalid preview');return join(dir,player+(preview==='published'?'.published':typeof preview==='string'&&preview.startsWith('future-')?'.preview-'+preview.slice(7):typeof preview==='string'?'.review-'+preview:preview?'.preview':'')+'.json');};
 // Copy the old preview verbatim once. It remains a private backup; a canonical save always wins.
 async function migrate(player){
  const target=file(player,false);
  try{await readFile(target);return;}catch(e){if(e.code!=='ENOENT')throw e;}
  let bytes;try{bytes=await readFile(file(player,true));}catch(e){if(e.code==='ENOENT')return;throw e;}
  const tmp=target+'.migrate-'+randomUUID();
  try{await writeFile(tmp,bytes,{mode:0o600});try{await link(tmp,target);}catch(e){if(e.code!=='EEXIST')throw e;}}finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 async function read(player,preview,definition=definitions[player]){
  const {freshWorld,upgradeWorld,ROOMS,GATES}=createWorldModel(definition);
  const resume=s=>{
   const state=upgradeWorld(s);
   // Enter a newly published daily region while retaining all prior carried discoveries.
   if(preview==='published'&&state.activeEpisode!==definition.episode.id)return {...state,activeEpisode:definition.episode.id,room:definition.startRoom,position:{x:.33,y:.97},visited:[...new Set([...state.visited,definition.startRoom])]};
   return state;
  };
  if(preview===false)await migrate(player);
  try{
   const s=JSON.parse(await readFile(file(player,preview),'utf8'));
   if(![1,2,3].includes(s.schema)||(!definition?.episode&&!ROOMS[s.room])||!Array.isArray(s.solved)||(!definition?.episode&&s.solved.some(k=>!GATES[k]))||!Array.isArray(s.items))throw Error('Invalid world save.');
   return resume(s);
  }catch(e){if(e.code==='ENOENT'){if(preview==='published')return resume(await read(player,false,definition));return freshWorld();}throw e;}
 }

 return {read:async(...args)=>{await queue.catch(()=>{});return read(...args);},
  act(player,preview,b,definition=definitions[player]){const task=queue.catch(()=>{}).then(async()=>{const f=file(player,preview),s=await read(player,preview,definition);if(b.revision!==s.revision)throw Object.assign(Error('Your world changed. Reload to continue.'),{status:409});const result=createWorldModel(definition).worldAction(s,b);if(result.correct===false&&!definition?.episode)return result;await mkdir(dir,{recursive:true,mode:0o700});const tmp=f+'.tmp';await writeFile(tmp,JSON.stringify(result.state)+'\n',{mode:0o600});await rename(tmp,f);return result;});queue=task;return task;}
 };
}
