// Early-morning refresh publishes the prepared chapter before gameplay.
// later in the evening (that night's notes came at 21:40), and a chapter that fell back to the template stays a
// template until the next night. This rewrites ONLY a chapter that (a) is missing, (b) fell back to the template, or
// (c) predates a day note for that child. Everything else is left exactly as the nightly wrote it. The old files are
// copied to <player>/replaced/ first, generate.mjs publishes atomically (a failed rewrite keeps the 21:05 chapter),
// and nothing is replaced after 05:30 local time.
// Usage: node book/refresh.mjs [--dry-run] [--now ISO]
import {readFile,readdir,mkdir,copyFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {bookPaths} from './paths.mjs';

const here=dirname(fileURLToPath(import.meta.url));
export const LAST_MINUTE=5*60+30; // 05:30 local: after this the morning chapter is never touched

// Pure decision for one child: why to rewrite, or null to leave it alone.
export function needsRefresh({chapter=null,notes=[],player}){
 if(!chapter)return 'no chapter for today';
 if(chapter.meta?.review?.state==='approved')return null;
 const src=String(chapter.meta?.source||'');
 if(/^template/.test(src))return 'fell back to the template';
 const written=Date.parse(chapter.meta?.generatedAt||0);
 const fresh=notes.filter(n=>(n.child===player||n.child==='both')&&Date.parse(n.at)>written);
 if(fresh.length)return `${fresh.length} day note${fresh.length>1?'s':''} after it was written`;
 return null;
}

function localParts(now,timeZone){
 const f=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const p=Object.fromEntries(f.formatToParts(new Date(now)).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)};
}
async function readJson(f){try{return JSON.parse(await readFile(f,'utf8'));}catch{return null;}}
async function recentNotes(dir){
 let files=[];try{files=(await readdir(dir)).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(-3);}catch{return [];}
 const out=[];for(const f of files){const j=await readJson(join(dir,f));if(Array.isArray(j?.notes))out.push(...j.notes);}return out;
}

export async function refresh({now=Date.now(),dryRun=false,log=console.log,run=null}={}){
 const paths=bookPaths();
 const {date,minutes}=localParts(now,paths.timeZone);
 log(`== book refresh ${date} (${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')})`);
 if(minutes>LAST_MINUTE){log('after 05:30: the morning chapters are left alone');return {date,done:[],skipped:'too late'};}
 const profiles=await readJson(join(paths.book,'profiles.json'))||{};
 const players=Object.keys(profiles).filter(k=>!k.startsWith('_'));
 const notes=await recentNotes(join(paths.book,'daynotes'));
 const done=[];
 for(const player of players){
  const dir=join(paths.book,player),file=join(dir,`${date}.json`);
  const chapter=existsSync(file)?await readJson(file):null;
  const why=needsRefresh({chapter,notes,player});
  if(!why){log(`${player} ${date}: kept (${chapter?.meta?.source||'?'})`);continue;}
  log(`${player} ${date}: rewriting: ${why}`);
  if(dryRun){done.push({player,why,dryRun:true});continue;}
  if(chapter){const stamp=new Date(now).toISOString().replace(/[:.]/g,'-'),back=join(dir,'replaced',`${date}-${stamp}`);await mkdir(back,{recursive:true});
   for(const ext of ['.json','.md','.calm.json']){const f=join(dir,date+ext);if(existsSync(f))await copyFile(f,join(back,date+ext));}}
  const r=(run||((args)=>spawnSync(process.execPath,args,{stdio:'inherit',timeout:2400e3})))([join(here,'generate.mjs'),'--date',date,'--player',player,'--force']);
  const after=await readJson(file);
  log(`${player} ${date}: ${r?.status===0?'rewritten':'rewrite failed (the 21:05 chapter stays)'} -> ${after?.meta?.source||'?'}`);
  done.push({player,why,status:r?.status??null,source:after?.meta?.source||null});
 }
 if(done.some(d=>d.status===0)&&!dryRun){const r=(run||((args)=>spawnSync(process.execPath,args,{stdio:'inherit',timeout:900e3})))([join(here,'calm-lines.mjs'),'--render','--dates',date,'--players',done.filter(d=>d.status===0).map(d=>d.player).join(',')]);
  log(`calm lines: ${r?.status===0?'rendered':'failed (non-fatal)'}`);}
 log(`== refresh done (${done.length} rewritten)`);
 return {date,done};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
 const now=arg('--now')?Date.parse(arg('--now')):Date.now();
 refresh({now,dryRun:process.argv.includes('--dry-run')}).then(()=>process.exit(0),e=>{console.error('refresh failed:',e);process.exit(1);});
}
