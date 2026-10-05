#!/usr/bin/env node
// Compile each child's unified learner model (learner-profile.mjs, schema family-learner-2) from the games' logs
// (read only, the same evidence as the hub's home nudge, with item tags), the Book's beat results and hunts, the
// Book's working model (<learner>/<player>.json) and the grown-ups' skills focus (<root>/skills-focus/<player>.json).
// Writes <learner>/<player>-learner.json (0600) atomically. Fail-soft: on any error the last good model is kept and
// returned; nothing here ever blocks a chapter.
// Usage: node book/learner-compile.mjs [--player id] [--out dir] [--now ISO]
import {readFile,readdir,writeFile,rename,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {skillEvidence} from '../hub/skill-evidence.mjs';
import {firstPageResults} from '../hub/first-page-results.mjs';
import {compileProfile,bookEvidence,THRESHOLDS,PROFILE_SCHEMA} from './learner-profile.mjs';
import {bookPaths,readProfiles} from './paths.mjs';

const DAY=864e5;
const readJSON=async(f,d=null)=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return d;}};
export const SOURCES=['letter-quest','word-arcade','number-park','maze-garden','three-in-a-row','hub'];
export const profileFile=(dir,player)=>join(dir,player+'-learner.json');
export const focusDir=(paths,env=process.env)=>String(env.FAMILY_SKILLS||join(paths.root,'skills-focus')).replace(/^~(?=\/|$)/,homedir());

// Skill evidence (with item tags) from every game's log files of the last `days` days, for the given players.
// Big tracing rows (strokes) are skipped before parsing; a Letter Quest profile reset drops that account's older rows.
export async function readEvidence(paths,players,{now=Date.now(),days=THRESHOLDS.history}={}){
 const out=[],resets=new Map(),since=new Date(now-(days+1)*DAY).toISOString().slice(0,10);
 const marks=players.map(p=>`"player":"${p}"`);
 for(const source of SOURCES){
  const dir=paths.data[source];if(!dir)continue;
  let names=[];try{names=(await readdir(join(dir,'logs'))).filter(n=>/^\d{4}-\d{2}-\d{2}(?:-\d+)?\.jsonl$/.test(n)&&n.slice(0,10)>=since).sort();}catch{continue;}
  for(const name of names){
   const lines=createInterface({input:createReadStream(join(dir,'logs',name)),crlfDelay:Infinity});
   for await(const line of lines){
    if(!marks.some(m=>line.includes(m))||line.includes('"type":"trace"'))continue;
    let row;try{row=JSON.parse(line);}catch{continue;}
    if(!players.includes(row.player))continue;
    const at=Date.parse(row.at);if(!Number.isFinite(at)||at>now)continue;
    if(source==='letter-quest'&&row.type==='profile_reset_completed'){const k=row.player;resets.set(k,Math.max(resets.get(k)||0,at));continue;}
    for(const e of skillEvidence(source,row,at)||[])out.push({...e,player:row.player,source,at});
   }
  }
 }
 return out.filter(e=>e.source!=='letter-quest'||e.at>=(resets.get(e.player)||0));
}
// The Book's own results: progress (per day, per page) with that day's chapter, as tagged evidence.
export async function readBook(paths,player){
 const progress=paths.data.hub?await readJSON(join(paths.data.hub,'book-progress',player+'.json')):null;
 const logged={};
 if(progress?.days&&paths.data.hub){
  let names=[];try{names=(await readdir(join(paths.data.hub,'logs'))).filter(n=>/^\d{4}-\d{2}-\d{2}(?:-\d+)?\.jsonl$/.test(n)).sort();}catch{}
  for(const name of names){
   const lines=createInterface({input:createReadStream(join(paths.data.hub,'logs',name)),crlfDelay:Infinity});
   for await(const line of lines){
    if(!line.includes('"type":"book"')||!line.includes('"action":"result"'))continue;
    let r;try{r=JSON.parse(line);}catch{continue;}
    if(r.player===player&&progress.days[r.date]) (logged[r.date]??=[]).push(r);
   }
  }
  for(const [date,day]of Object.entries(progress.days))day.results=firstPageResults(day.results,logged[date]);
 }
 const chapters={};for(const date of Object.keys(progress?.days||{})){const c=await readJSON(join(paths.book,player,date+'.json'));if(c)chapters[date]=c;}
 return {progress,collection:progress?.collection||{},evidence:bookEvidence({progress,chapters,player})};
}
let memo=null;
// The models for players, compiled from one read of the logs (cached for this process and `now`).
export async function compileLearners(players,{paths=bookPaths(),now=Date.now(),bookModels={},env=process.env}={}){
 if(!memo||memo.now!==now||memo.key!==JSON.stringify([players,paths.data,paths.book]))memo={now,key:JSON.stringify([players,paths.data,paths.book]),evidence:await readEvidence(paths,players,{now})};
 const out={};
 for(const player of players){
  const book=await readBook(paths,player);
  const bookModel=bookModels[player]||await readJSON(join(paths.learner,player+'.json'));
  const focus=await readJSON(join(focusDir(paths,env),player+'.json'));
  const files={bookModel:`${player}.json`,life:await readJSON(join(paths.learner,player+'-life.json'))?`${player}-life.json`:null,sage:await readJSON(join(paths.learner,player+'-sage.json'))?`${player}-sage.json`:null};
  out[player]=compileProfile({player,now,cutoff:now,evidence:[...memo.evidence.filter(e=>e.player===player),...book.evidence],bookModel,focus,collection:book.collection,files});
 }
 return out;
}
export async function writeProfile(model,dir){
 await mkdir(dir,{recursive:true,mode:0o700});const file=profileFile(dir,model.player),tmp=file+'.tmp-'+process.pid;
 await writeFile(tmp,JSON.stringify(model,null,1),{mode:0o600});await rename(tmp,file);return file;
}
// For the nightly: compile and write one child's model; on failure keep (and return) the last good one, or null.
export async function learnerProfileFor(player,{paths=bookPaths(),now=Date.now(),bookModel=null,players=[player],log=()=>{},compile=compileLearners,dir=paths.learner,persist=true}={}){
 try{
  const all=await compile(players.includes(player)?players:[...players,player],{paths,now,bookModels:bookModel?{[player]:bookModel}:{}});
  const m=all[player];if(!m||m.schema!==PROFILE_SCHEMA)throw Error('no model');
  if(persist)await writeProfile(m,dir);return m;
 }catch(e){
  const last=await readJSON(profileFile(dir,player));
  log(`${player}: learner model not rebuilt (${String(e?.message||e).slice(0,160)}); ${last?.schema===PROFILE_SCHEMA?'keeping the last good one from '+last.builtAt:'no model today'}`);
  return last?.schema===PROFILE_SCHEMA?{...last,stale:true}:null;
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
 const paths=bookPaths(),profiles=readProfiles(paths),out=arg('--out')||paths.learner,now=arg('--now')?Date.parse(arg('--now')):Date.now();
 const players=arg('--player')?[arg('--player')]:Object.keys(profiles).filter(id=>!id.startsWith('_')&&(!paths.config?.players||profiles[id]?.onboarding||paths.config.players.some(p=>p.id===id)));
 if(!players.length){console.error('No players: add book/profiles.json under the deploy root.');process.exit(1);}
 const t0=Date.now(),all=await compileLearners(players,{paths,now});
 for(const p of players)console.log(await writeProfile(all[p],out));
 console.error(`compiled ${players.length} in ${Date.now()-t0} ms`);
}
