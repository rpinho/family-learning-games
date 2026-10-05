import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {episodeDefinition} from './public/world-episode.mjs';
export async function worldEpisodes(bookDir,player,{date,review=false,base}={}){
 if(!/^\w{1,24}$/.test(player)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const dir=join(bookDir,player),history=[];let files=[];try{files=await readdir(dir);}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const f of files.sort())if(/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<=date){const ch=JSON.parse(await readFile(join(dir,f),'utf8'));if(ch.episode&&ch.player===player&&ch.date===f.slice(0,10))history.push(ch.episode);}
 let current=history.at(-1);
 if(review){try{const ch=JSON.parse(await readFile(join(dir,'review',date+'.json'),'utf8'));current=ch.episode;}catch(e){if(e.code!=='ENOENT')throw e;}if(!current||current.date!==date)return null;}
 if(!current)return null;return {definition:episodeDefinition(current,base,history),episode:current,episodes:[...history.filter(e=>e.id!==current.id),current]};
}
