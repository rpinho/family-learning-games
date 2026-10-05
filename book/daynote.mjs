#!/usr/bin/env node
// Day notes from a terminal (e.g. a Claude session told about the day in chat): the same private store the hub's
// grown-ups page writes (book/daynotes.mjs). Tonight's chapter can weave it in.
//   node book/daynote.mjs add --child <player|both> [--from dad|mom|claude] [--memory] "what happened"
//   node book/daynote.mjs list [--days 3] [--json]
//   node book/daynote.mjs remove <id>
// --memory: just for the Book's memory; never told in a chapter.
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles,localDate,addDays} from './paths.mjs';
import {dayNotesDir,addNote,listNotes,removeNote,EXPIRE_DAYS} from './daynotes.mjs';

export function childrenOf(paths,profiles){
 const fromConfig=(paths.config?.players||[]).map(p=>p.id).filter(id=>id!=='admin');
 return fromConfig.length?fromConfig:Object.keys(profiles).filter(k=>!k.startsWith('_'));}
export function parseArgs(argv){const out={cmd:argv[0],flags:{},rest:[]};
 for(let i=1;i<argv.length;i++){const a=argv[i];if(a==='--memory'||a==='--json')out.flags[a.slice(2)]=true;else if(a.startsWith('--'))out.flags[a.slice(2)]=argv[++i];else out.rest.push(a);}
 return out;}
const status=(n,player)=>n.memory?'memory only':Object.keys(n.used||{}).length?'used: '+Object.entries(n.used).map(([p,u])=>`${p} ${u.chapter.split('/')[1]}`).join(', '):'waiting';
export async function main(argv,{env=process.env,now=Date.now(),print=console.log}={}){
 const paths=bookPaths(env),profiles=readProfiles(paths),dir=dayNotesDir(paths,env),children=childrenOf(paths,profiles),{cmd,flags,rest}=parseArgs(argv);
 if(cmd==='add'){const n=await addNote(dir,{child:flags.child||'both',text:rest.join(' '),from:flags.from||'claude',memory:!!flags.memory,now,timeZone:paths.timeZone,children});
  print(`saved ${n.id} (${n.child}${n.memory?', memory only':''}): ${n.text}`);return 0;}
 if(cmd==='list'){const days=Math.max(0,Number(flags.days??EXPIRE_DAYS)),today=localDate(now,paths.timeZone);
  const notes=await listNotes(dir,{from:addDays(today,-days),to:today});
  if(flags.json)print(JSON.stringify(notes,null,1));else if(!notes.length)print('no day notes');
  else for(const n of notes)print(`${n.id}  ${n.date}  ${n.child.padEnd(10)} ${n.from.padEnd(6)} [${status(n)}]  ${n.text}`);
  return 0;}
 if(cmd==='remove'){const ok=await removeNote(dir,rest[0]);print(ok?`removed ${rest[0]}`:`no note ${rest[0]}`);return ok?0:1;}
 print('usage: daynote.mjs add --child <'+[...children,'both'].join('|')+'> [--from dad|mom|claude] [--memory] "text" | list [--days N] [--json] | remove <id>');return 2;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{process.exit(await main(process.argv.slice(2)));}catch(e){console.error(e.message);process.exit(1);}
}
