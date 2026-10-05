#!/usr/bin/env node
// Generate portable, synthetic fixtures. Art and voice caches remain outside tracked files.
import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {bookPaths} from '../paths.mjs';import {readLibrary,askModel} from '../generate.mjs';import {writeEpisode} from './generate.mjs';
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];if(!args.includes('--out'))throw Error('--out is required; never writes household chapters.');const out=resolve(value('--out'));await mkdir(out,{recursive:true});const library=readLibrary(bookPaths());
 for(const [player,level,file]of [['explorer','reader','castle-episode.json'],['beginner','early','little-world-episode.json']]){const date=args.includes('--date')?value('--date'):'2026-10-05',plan={player,name:level==='reader'?'Knight':'Explorer',level,date,cast:[{id:'bo',name:'Bo',voice:'am_puck'},{id:'robo',name:'Robo',voice:'af_nova'}],grownups:[{id:'dad',name:'Dad'},{id:'mom',name:level==='early'?'Grown-up':'Mom'}],learnerFocus:[],memory:{lastHook:{hook:'A tiny path inside the lantern leads somewhere new.'}},scenario:{id:'lantern-trail',place:level==='reader'?'castle-gate':'garden'}};
  const learning={level,taughtLetters:['M','O'],focus:[]};const r=await writeEpisode(plan,{library,learning,ask:args.includes('--model')?askModel:async()=>null,log:console.log});await writeFile(join(out,file),JSON.stringify(r.episode,null,2)+'\n');console.log(file,r.source,JSON.stringify(r.checks));}
}
