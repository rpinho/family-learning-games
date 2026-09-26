#!/usr/bin/env node
// The Book, "generate by night, play by day": for each child, rebuild the learner model, plan
// tomorrow's chapter, have a language model write it, lint it (one repair pass, then the template),
// narrate it with local Kokoro, and publish chapter + printable bedtime page atomically.
// Usage: node book/generate.mjs [--date YYYY-MM-DD] [--player id] [--no-llm] [--no-voice] [--force] [--out-copy dir]
//   --date defaults to today before noon, tomorrow after (so a 04:30 run and an evening run agree).
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,readdir,rm,copyFile} from 'node:fs/promises';
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
import {assemble,speechLines,markdown,bedtimeHTML} from './assemble.mjs';
const here=dirname(fileURLToPath(import.meta.url));

function run(cmd,args,{input='',env=process.env,timeoutMs=240000,cwd=tmpdir()}={}){
 return new Promise(resolve=>{
  let out='',err='',done=false;const child=spawn(cmd,args,{env,cwd,stdio:['pipe','pipe','pipe']});
  const timer=setTimeout(()=>{if(!done){try{child.kill('SIGTERM');}catch{}setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},3000);}},timeoutMs);
  child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err=(err+b).slice(-4000));
  child.on('error',e=>{done=true;clearTimeout(timer);resolve({code:-1,out,err:String(e.message)});});
  child.on('close',code=>{done=true;clearTimeout(timer);resolve({code,out,err});});
  child.stdin.end(input);
 });
}
// One model turn. Claude Sonnet first (never Haiku); the Codex cheap tier if Claude is unavailable.
export async function askModel(prompt,{env=process.env,log=()=>{}}={}){
 const claudeModel=env.BOOK_CLAUDE_MODEL||'claude-sonnet-5',codexModel=env.BOOK_CODEX_MODEL||'gpt-6-luna';
 const order=(env.BOOK_BACKEND||'claude,codex').split(',').map(s=>s.trim()).filter(Boolean);
 for(const backend of order){
  if(backend==='claude'){
   const e={...env};delete e.CLAUDECODE;delete e.CLAUDE_CODE_ENTRYPOINT;
   if(env.BOOK_CLAUDE_TOKEN_FILE&&existsSync(env.BOOK_CLAUDE_TOKEN_FILE))e.CLAUDE_CODE_OAUTH_TOKEN=readFileSync(env.BOOK_CLAUDE_TOKEN_FILE,'utf8').trim();
   const r=await run(env.BOOK_CLAUDE_BIN||'claude',['-p','--safe-mode','--model',claudeModel,'--tools','','--no-session-persistence','--system-prompt',SYSTEM,'--output-format','json'],{input:prompt,env:e});
   let j=null;try{j=JSON.parse(r.out);}catch{}
   if(r.code===0&&j&&!j.is_error&&j.result)return {text:j.result,source:`claude:${claudeModel}`};
   log(`claude unavailable (${r.code}): ${(j?.result||r.err||r.out).slice(0,200)}`);
  }else if(backend==='codex'){
   const e={...env};delete e.OPENAI_BASE_URL;delete e.OPENAI_API_KEY;
   const last=join(tmpdir(),`book-codex-${process.pid}-${Date.now()}.txt`);
   const r=await run(env.BOOK_CODEX_BIN||'codex',['exec','--ignore-user-config','--skip-git-repo-check','-m',codexModel,'--sandbox','read-only','--color','never','-o',last,'-'],{input:SYSTEM+'\n\n'+prompt,env:e});
   let text='';try{text=await readFile(last,'utf8');}catch{}await rm(last,{force:true});
   if(r.code===0&&text.trim())return {text,source:`codex:${codexModel}`};
   log(`codex unavailable (${r.code}): ${r.err.slice(-200)}`);
  }else if(backend==='none')break;
 }
 return null;
}
// Write, lint, repair once, else template. Returns {story, source, lint}.
export async function writeStory(plan,{extra=[],allow=[],dadLines=[],ask=askModel,log=()=>{}}={}){
 const first=await ask(buildPrompt(plan,{dadLines}),{log});
 if(first){
  let story=parseChapter(first.text),issues=story?lintChapter(story,plan,{extra,allow}):['reply was not JSON'];
  if(!story)log(`reply was not JSON (${plan.player}): ${String(first.text).slice(0,240).replace(/\s+/g,' ')}`);
  if(!issues.length)return {story,source:first.source,lint:[]};
  log(`lint (${plan.player}): ${issues.join(' | ')}`);
  const second=await ask(story?repairPrompt(story,issues):buildPrompt(plan,{dadLines}),{log});
  if(second){const s2=parseChapter(second.text),i2=s2?lintChapter(s2,plan,{extra,allow}):['reply was not JSON'];
   if(!i2.length)return {story:s2,source:second.source+' (repaired)',lint:issues};
   log(`lint after repair (${plan.player}): ${i2.join(' | ')}`);issues=i2;}
  return {story:templateChapter(plan),source:'template (model chapter failed lint)',lint:issues};
 }
 return {story:templateChapter(plan),source:'template (no model reachable)',lint:[]};
}
export async function narrate(lines,{paths,voice='af_heart',speed=0.95,env=process.env}){
 const req=join(tmpdir(),`book-voice-${process.pid}-${Date.now()}.json`);
 await writeFile(req,JSON.stringify({lines,voice,speed,out:paths.voice,models:paths.voiceModels}));
 try{const r=await run(paths.python,[join(here,'narrate.py'),req],{env:{...env,BOOK_VOICE_THREADS:env.BOOK_VOICE_THREADS||'2'},timeoutMs:15*60000});
  if(r.code!==0)throw Error(r.err.slice(-600)||'narration failed');
  const j=JSON.parse(r.out.trim().split('\n').at(-1));return {voice:j.voice,speed:j.speed,made:j.made,clips:j.clips};}
 finally{await rm(req,{force:true});}
}
export function recapLines(md,name){
 const lines=String(md||'').split('\n'),start=lines.findIndex(l=>l.trim()===`## ${name}`);if(start<0)return [];
 const out=[];for(const l of lines.slice(start+1)){if(l.startsWith('## '))break;const t=l.replace(/^\s*-\s*/,'').replace(/\*\*/g,'').trim();if(t&&!/^Worth a look/.test(t))out.push(t);}
 return out.slice(0,8);
}
async function chapterNumber(dir,date){let n=[];try{n=(await readdir(dir)).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<date);}catch{}return n.length+1;}
export async function generateOne(player,{paths,profiles,date,noLLM=false,noVoice=false,force=false,now=Date.now(),log=console.log,ask=askModel}){
 const dir=join(paths.book,player),file=join(dir,date+'.json');
 if(existsSync(file)&&!force){log(`${player} ${date}: chapter exists (use --force to replace)`);return {file,skipped:true};}
 const profile=profiles[player]||{},extra=[...(profiles._lint?.extra||[]),...(profile.lintExtra||[])];
 const model=await learnerFor(player,{paths,profiles,now,chapterDate:date});
 await writeLearner(model,paths.learner);
 const cast=readCast(paths),allow=cast?.allowNames||[];
 const plan=planChapter(model,{date,profile,cast});
 const dadLines=plan.dadLines.map(t=>safeDadLine(t,{extra,allow})).filter(Boolean);
 plan.dadLines=dadLines;
 const {story,source,lint}=noLLM?{story:templateChapter(plan),source:'template (--no-llm)',lint:[]}:await writeStory(plan,{extra,allow,dadLines,ask,log:m=>log(m)});
 const portraits=new Set(),portraitData={};
 for(const c of plan.cast||[]){try{const b=await readFile(join(paths.portraits,`${c.id}.jpg`));portraits.add(c.id);portraitData[c.id]='data:image/jpeg;base64,'+b.toString('base64');}catch{}}
 const ch=assemble(story,plan,{number:await chapterNumber(dir,date),source,lint,dadLines,portraits});
 if(!noVoice){try{const v=profile.voice||{};const n=await narrate(speechLines(ch),{paths,voice:v.voice,speed:v.speed});ch.voice={name:n.voice,speed:n.speed,clips:n.clips};log(`${player} ${date}: ${n.made} new clips`);}
  catch(e){log(`${player} ${date}: narration failed, device speech will be used (${String(e.message).slice(0,200)})`);}}
 let did=[];try{did=recapLines(await readFile(join(paths.recap,addDays(date,-1)+'.md'),'utf8'),model.name).filter(l=>l!=='No play.');}catch{}
 did.push(...(model.recent.play||[]));
 // Publish: write into a staging folder, then rename each file into place (clips already exist).
 const stage=join(paths.book,'.staging',`${player}-${date}-${process.pid}`);await mkdir(stage,{recursive:true,mode:0o700});await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(join(stage,date+'.md'),markdown(ch,{did}),{mode:0o600});
 await writeFile(join(stage,date+'.html'),bedtimeHTML(ch,{did,dadLines,portraitData}),{mode:0o600});
 await writeFile(join(stage,date+'.json'),JSON.stringify(ch,null,1),{mode:0o600});
 for(const ext of ['md','html','json'])await rename(join(stage,`${date}.${ext}`),join(dir,`${date}.${ext}`));
 await rm(stage,{recursive:true,force:true});
 log(`${player} ${date}: "${ch.title}" (${source})${lint.length?' first-draft lint issues (fixed or replaced): '+lint.join(' | '):''}`);
 return {file,chapter:ch,source,lint};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;},flag=k=>args.includes(k);
 const paths=bookPaths(),profiles=readProfiles(paths),now=Date.now();
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date(now)));
 const date=arg('--date')||(hour<12?localDate(now,paths.timeZone):addDays(localDate(now,paths.timeZone),1));
 const players=arg('--player')?[arg('--player')]:bookPlayers(paths,profiles);
 let failed=0;
 for(const p of players){try{const r=await generateOne(p,{paths,profiles,date,noLLM:flag('--no-llm'),noVoice:flag('--no-voice'),force:flag('--force'),now});
  if(arg('--out-copy')&&r.chapter){await mkdir(arg('--out-copy'),{recursive:true});await copyFile(join(paths.book,p,date+'.html'),join(arg('--out-copy'),`Bedtime Chapter - ${r.chapter.name} - ${date}.html`));}}
  catch(e){failed++;console.error(`${p}: ${e.stack||e}`);}}
 process.exit(failed?1:0);
}
