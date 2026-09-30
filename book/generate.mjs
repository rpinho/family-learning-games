#!/usr/bin/env node
// The Book, "generate by night, play by day": for each child, rebuild the learner model and (weekly) the
// private life context, plan the chapter's learning beats, have a language model write the illustrated
// scenes and narration, lint it (one repair pass, then the template), narrate every line in its own
// voice with local Kokoro, and publish the chapter atomically.
// Usage: node book/generate.mjs [--date YYYY-MM-DD] [--player id] [--no-llm] [--no-voice] [--force] [--life]
//   --date defaults to today before noon, tomorrow after (so a 04:30 run and an evening run agree).
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,readdir,rm} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles,readCast,localDate,addDays} from './paths.mjs';
import {learnerFor,writeLearner,bookPlayers} from './build-learner.mjs';
import {planChapter} from './plan.mjs';
import {lintChapter,safeDadLine} from './lint.mjs';
import {SYSTEM,buildPrompt,repairPrompt,parseChapter} from './prompt.mjs';
import {templateChapter} from './template.mjs';
import {assemble,speechLines,attachClips,markdown,voicesFor,CHAPTER_SCHEMA} from './assemble.mjs';
import {ensureLife} from './life.mjs';
const here=dirname(fileURLToPath(import.meta.url));

function run(cmd,args,{input='',env=process.env,timeoutMs=240000,cwd=tmpdir()}={}){
 return new Promise(resolve=>{
  let out='',err='',done=false,inputError=false;const child=spawn(cmd,args,{env,cwd,stdio:['pipe','pipe','pipe']});
  const timer=setTimeout(()=>{if(!done){try{child.kill('SIGTERM');}catch{}setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},3000);}},timeoutMs);
  child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err=(err+b).slice(-4000));
  child.on('error',e=>{done=true;clearTimeout(timer);resolve({code:-1,out,err:String(e.message)});});
  // A worker can refuse the job before reading its input. Report that failure through the
  // normal fallback/preservation path, rather than letting the pipe error crash generation.
  child.stdin.on('error',e=>{inputError=true;err=(err+'\n'+e.message).slice(-4000);});
  child.on('close',code=>{done=true;clearTimeout(timer);resolve({code:code===0&&inputError?-1:code,out,err});});
  child.stdin.end(input);
 });
}
// One model turn. Claude Opus 5.5 first; Codex (GPT-6 Sol) if Claude is unavailable.
export const DEFAULT_MODELS={claude:'claude-opus-5-5',codex:'gpt-6-sol'};
export async function askModel(prompt,{env=process.env,log=()=>{},system=SYSTEM}={}){
 const claudeModel=env.BOOK_CLAUDE_MODEL||DEFAULT_MODELS.claude,codexModel=env.BOOK_CODEX_MODEL||DEFAULT_MODELS.codex;
 const order=(env.BOOK_BACKEND||'claude,codex').split(',').map(s=>s.trim()).filter(Boolean);
 for(const backend of order){
  if(backend==='claude'){
   const e={...env};delete e.CLAUDECODE;delete e.CLAUDE_CODE_ENTRYPOINT;
   if(env.BOOK_CLAUDE_TOKEN_FILE&&existsSync(env.BOOK_CLAUDE_TOKEN_FILE))e.CLAUDE_CODE_OAUTH_TOKEN=readFileSync(env.BOOK_CLAUDE_TOKEN_FILE,'utf8').trim();
   const r=await run(env.BOOK_CLAUDE_BIN||'claude',['-p','--safe-mode','--model',claudeModel,'--tools','','--no-session-persistence','--system-prompt',system,'--output-format','json'],{input:prompt,env:e});
   let j=null;try{j=JSON.parse(r.out);}catch{}
   if(r.code===0&&j&&!j.is_error&&j.result)return {text:j.result,source:`claude:${claudeModel}`};
   log(`claude unavailable (${r.code}): ${(j?.result||r.err||r.out).slice(0,200)}`);
  }else if(backend==='codex'){
   const e={...env};delete e.OPENAI_BASE_URL;delete e.OPENAI_API_KEY;
   const last=join(tmpdir(),`book-codex-${process.pid}-${Date.now()}.txt`);
   const r=await run(env.BOOK_CODEX_BIN||'codex',['exec','--ignore-user-config','--skip-git-repo-check','-m',codexModel,'--sandbox','read-only','--color','never','-o',last,'-'],{input:system+'\n\n'+prompt,env:e});
   let text='';try{text=await readFile(last,'utf8');}catch{}await rm(last,{force:true});
   if(r.code===0&&text.trim())return {text,source:`codex:${codexModel}`};
   log(`codex unavailable (${r.code}): ${r.err.slice(-200)}`);
  }else if(backend==='none')break;
 }
 return null;
}
// Write, lint, repair once, else template. Returns {story, source, lint}.
export async function writeStory(plan,{extra=[],allow=[],dadLines=[],ask=askModel,log=()=>{},library,actors,speakers}={}){
 const opts={extra,allow,actors,speakers,dadId:plan.actorIds?.dad};
 const first=await ask(buildPrompt(plan,{dadLines,library,actors,speakers}),{log});
 if(first){
  let story=parseChapter(first.text),issues=story?lintChapter(story,plan,opts):['reply was not JSON'];
  if(!story)log(`reply was not JSON (${plan.player}): ${String(first.text).slice(0,240).replace(/\s+/g,' ')}`);
  if(!issues.length)return {story,source:first.source,lint:[]};
  log(`lint (${plan.player}): ${issues.join(' | ')}`);
  const second=await ask(story?repairPrompt(story,issues):buildPrompt(plan,{dadLines,library,actors,speakers}),{log});
  if(second){const s2=parseChapter(second.text),i2=s2?lintChapter(s2,plan,opts):['reply was not JSON'];
   if(!i2.length)return {story:s2,source:second.source+' (repaired)',lint:issues};
   log(`lint after repair (${plan.player}): ${i2.join(' | ')}`);issues=i2;}
  return {story:templateChapter(plan,library),source:'template (model chapter failed lint)',lint:issues};
 }
 return {story:templateChapter(plan,library),source:'template (no model reachable)',lint:[]};
}
// lines: [{text, voice, speed}]. Returns {made, clips: {"voice|speed|text": file}}.
export async function narrate(lines,{paths,env=process.env}){
 const req=join(tmpdir(),`book-voice-${process.pid}-${Date.now()}.json`);
 await writeFile(req,JSON.stringify({lines,out:paths.voice,models:paths.voiceModels}));
 try{const r=await run(paths.python,[join(here,'narrate.py'),req],{env:{...env,BOOK_VOICE_THREADS:env.BOOK_VOICE_THREADS||'2'},timeoutMs:15*60000});
  if(r.code!==0)throw Error(r.err.slice(-600)||'narration failed');
  const j=JSON.parse(r.out.trim().split('\n').at(-1));return {made:j.made,clips:j.clips};}
 finally{await rm(req,{force:true});}
}
async function chapterNumber(dir,date){let n=[];try{n=(await readdir(dir)).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<date);}catch{}return n.length+1;}
// The picture library: the household's own (private, next to its chapters) or the generic one shipped here.
export function readLibrary(paths){
 for(const f of [join(paths.book,'art','lib','library.json'),join(here,'..','hub','public','book-art','library.json')]){try{const l=JSON.parse(readFileSync(f,'utf8'));if(l.backgrounds&&l.actors)return {...l,private:!f.startsWith(join(here,'..'))};}catch{}}
 throw Error('no picture library');
}
// Who can be drawn: the hero, Dad, his brother, and today's friends (by the library's actor ids).
export function actorIdsFor(plan,library){
 const has=id=>!!library.actors[id];
 const hero=has(plan.player)?plan.player:'hero',dad=has('dad')?'dad':'grown-up';
 const sib=plan.sibling&&has(plan.sibling.toLowerCase())?plan.sibling.toLowerCase():null;
 const friends=(plan.cast||[]).map(c=>c.id).filter(has);
 return {hero,dad,sibling:sib,all:[hero,dad,...(sib?[sib]:[]),...friends].filter(has)};
}
// What he has collected in the book so far (letter keys, words he read), from the hub's progress file.
export async function readCollection(paths,player){try{const p=JSON.parse(await readFile(join(paths.data.hub,'book-progress',player+'.json'),'utf8'));return {keys:p.collection?.keys||[],words:p.collection?.words||[]};}catch{return {keys:[],words:[]};}}
export async function generateOne(player,{paths,profiles,date,noLLM=false,noVoice=false,force=false,life:forceLife=false,now=Date.now(),log=console.log,ask=askModel}){
 const dir=join(paths.book,player),file=join(dir,date+'.json');
 if(existsSync(file)&&!force){let schema=null;try{schema=JSON.parse(readFileSync(file,'utf8')).schema;}catch{}
  if(schema===CHAPTER_SCHEMA){log(`${player} ${date}: chapter exists (use --force to replace)`);return {file,skipped:true};}
  log(`${player} ${date}: replacing a chapter in an older format`);}
 const profile=profiles[player]||{},extra=[...(profiles._lint?.extra||[]),...(profile.lintExtra||[])];
 const model=await learnerFor(player,{paths,profiles,now,chapterDate:date});
 await writeLearner(model,paths.learner);
 const cast=readCast(paths),allow=cast?.allowNames||[];
 const life=await ensureLife(player,{paths,profile:{...profile,name:model.name},extra,allow,ask:noLLM?null:ask,log,now,force:forceLife}).catch(e=>{log(`${player}: life context failed (${e.message})`);return null;});
 const collection=await readCollection(paths,player);
 const plan=planChapter(model,{date,profile,cast,collection,life});
 const library=readLibrary(paths);
 const ids=actorIdsFor(plan,library);plan.actorIds=ids;
 const speakers=['narrator','dad',...plan.cast.map(c=>c.id)];
 plan.dadLines=plan.dadLines.map(t=>safeDadLine(t,{extra,allow})).filter(Boolean);
 const {story,source,lint}=noLLM?{story:templateChapter(plan,library),source:'template (--no-llm)',lint:[]}:await writeStory(plan,{extra,allow,dadLines:plan.dadLines,ask,log:m=>log(m),library,actors:ids.all,speakers});
 const voices=voicesFor(plan,{narrator:profile.voice});
 const ch=assemble(story,plan,{number:await chapterNumber(dir,date),source,lint,dadLines:plan.dadLines,library,actors:ids.all,voices});
 if(!noVoice){try{const n=await narrate(speechLines(ch),{paths});attachClips(ch,n.clips);log(`${player} ${date}: ${n.made} new clips`);}
  catch(e){log(`${player} ${date}: narration failed, device speech will be used (${String(e.message).slice(0,200)})`);}}
 // Publish: write into a staging folder, then rename each file into place (clips already exist).
 const stage=join(paths.book,'.staging',`${player}-${date}-${process.pid}`);await mkdir(stage,{recursive:true,mode:0o700});await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(join(stage,date+'.md'),markdown(ch),{mode:0o600});
 await writeFile(join(stage,date+'.json'),JSON.stringify(ch,null,1),{mode:0o600});
 for(const ext of ['md','json'])await rename(join(stage,`${date}.${ext}`),join(dir,`${date}.${ext}`));
 await rm(stage,{recursive:true,force:true});
 log(`${player} ${date}: "${ch.title}" (${source})${lint.length?' first-draft lint issues (fixed or replaced): '+lint.join(' | '):''}${ch.meta.sceneNotes.length?' scene notes: '+ch.meta.sceneNotes.join('; '):''}`);
 return {file,chapter:ch,source,lint};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;},flag=k=>args.includes(k);
 const paths=bookPaths(),profiles=readProfiles(paths),now=Date.now();
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date(now)));
 const date=arg('--date')||(hour<12?localDate(now,paths.timeZone):addDays(localDate(now,paths.timeZone),1));
 const players=arg('--player')?[arg('--player')]:bookPlayers(paths,profiles);
 let failed=0;
 for(const p of players){try{await generateOne(p,{paths,profiles,date,noLLM:flag('--no-llm'),noVoice:flag('--no-voice'),force:flag('--force'),life:flag('--life'),now});}
  catch(e){failed++;console.error(`${p}: ${e.stack||e}`);}}
 process.exit(failed?1:0);
}
