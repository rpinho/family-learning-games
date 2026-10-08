#!/usr/bin/env node
// The Book, "generate by night, play by day": for each child, rebuild the learner model and (weekly) the
// private life context, plan the chapter's learning beats, have a language model write the illustrated
// scenes and narration, lint it (one repair pass, then the template), narrate every line in its own
// voice with local Kokoro, and publish the chapter atomically.
// Usage: node book/generate.mjs [--date YYYY-MM-DD] [--player id] [--no-llm] [--no-voice] [--force] [--life]
//   --date defaults to today before noon, tomorrow after (so an evening run, 21:05 after bedtime, and a morning run agree).
import {writeEpisode,episodeLearning,episodeChapter} from './episodes/generate.mjs';
import {certifyEpisode} from './episodes/certify.mjs';
import {randomUUID} from 'node:crypto';
import {withSlotLock,slot,readJSON,backupSlot,reviewEvent} from './review.mjs';
import {renderCalm} from './calm-lines.mjs';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,readdir,rm} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {bookPaths,readProfiles,readCast,localDate,addDays,soundSource} from './paths.mjs';
import {learnerFor,writeLearner,bookPlayers} from './build-learner.mjs';
import {planChapter,COUNT_THINGS} from './plan.mjs';
import {learnerProfileFor} from './learner-compile.mjs'; // learner model
import {focusModel,applyLearnerPlan} from './learner-plan.mjs'; // learner model
import {drawnBeats} from './quest-beats.mjs';
import {lintChapter,safeDadLine,repeatedWords,softFix} from './lint.mjs';
import {storyMemory,memoryUse} from './memory.mjs';
import {chooseScenario,recentOf,avoidBgsFor,scenarioBeats} from './scenarios.mjs';
import {SYSTEM,buildPrompt,repairPrompt,parseChapter} from './prompt.mjs';
import {templateChapter} from './template.mjs';
import {assemble,speechLines,attachClips,markdown,voicesFor,CHAPTER_SCHEMA} from './assemble.mjs';
import {rawNames} from '../hub/public/pronounce.mjs';
import {applyBackgroundLayouts} from '../hub/public/book-painted-layout.mjs';
import {ensureLife} from './life.mjs';
import {kitIssues,paths as adventurePaths,usesFlag,changesStory,lineText} from './adventure/graph.mjs';
import {adventurePlan,integratedBrief,parseAdventure,lintAdventure,collapse,assembleAdventure,pathStory,softFixAdventure} from './adventure/integrate.mjs';
import {readLedger,payoff,payoffUse,payPublished} from './adventure/ledger.mjs';
import {dayNotesDir,dayNotesFor,woven,markUsed,withDayNotes} from './daynotes.mjs'; // day notes: the parent's day becomes the chapter
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
// Write, lint, then up to MAX_REPAIRS repairs, each from the BEST version so far; else template. Returns {story, source, lint}.
// only small misses (a word said twice, 241 s of 230, Rook unnamed); the single repair dropped the Volcano path
// puzzle, and the old loop then judged only that worse version. Now every attempt is kept, the next repair starts
// from the one with the fewest serious problems, the repair prompt says to keep every beat, and at the end a version
// whose only misses are a few words or seconds over the limit is kept (never one that repeats words or drops a beat).
export const MAX_REPAIRS=3;
const STYLE=/said twice in a row|say every word once/;
// A missing, doubled or out-of-order beat loses the lesson itself and is the hardest thing for a repair to restore;
// it outweighs any wording problem (10-02: draft = a repeat + 241 s + Rook unnamed = 14, repair without its puzzle = 30).
const BEAT=/^beat \S+ .*must (appear|come after)/;
export function issueWeight(i){const t=String(i).replace(/^path \w+: /,'');return BEAT.test(t)?30:nearLimit(t)?1:STYLE.test(t)||SOFT_VARIETY.test(t)?3:10;}
export function writeStoryScore(issues){return issues.reduce((n,i)=>n+issueWeight(i),0);}
export async function writeStory(plan,{extra=[],allow=[],dadLines=[],ask=askModel,log=()=>{},library,actors,speakers,others=[]}={}){
 const opts={extra,allow,actors,speakers,others,library,dadId:plan.actorIds?.[plan.lead?.id||'dad']||plan.lead?.id||plan.actorIds?.dad,dadName:plan.lead?.name||'Dad'};
 const first=await ask(buildPrompt(plan,{dadLines,library,actors,speakers}),{log});
 if(!first)return {story:templateChapter(plan,library),source:'template (no model reachable)',lint:[]};
 const firstLint=[];const cands=[];
 // (soft style rules repaired in code first: a good chapter is never thrown away for them)
 const consider=(reply,tag)=>{const story=reply?parseChapter(reply.text):null;
  if(!story){if(reply)log(`reply was not JSON (${plan.player}): ${String(reply.text).slice(0,240).replace(/\s+/g,' ')}`);return null;}
  const raw=lintChapter(story,plan,opts),fixed=raw.length?softFix(story,plan):story,fl=raw.length?lintChapter(fixed,plan,opts):[];
  const c=fl.length<raw.length||!fl.length?{story:fixed,issues:fl,source:reply.source+tag+(raw.length?(tag?', style fixed':' (style fixed)'):'')}:{story,issues:raw,source:reply.source+tag};
  if(!firstLint.length&&raw.length)firstLint.push(...raw);
  cands.push(c);return c;};
 const best=()=>cands.slice().sort((a,b)=>writeStoryScore(a.issues)-writeStoryScore(b.issues))[0];
 let c=consider(first,'');
 if(c&&!c.issues.length)return {story:c.story,source:c.source,lint:firstLint};
 if(c)log(`lint (${plan.player}): ${c.issues.join(' | ')}`);
 const tags=[' (repaired)',' (repaired twice)',' (repaired three times)'];
 for(let n=0;n<MAX_REPAIRS;n++){
  const b=best();
  const reply=await ask(b?repairPrompt(b.story,b.issues):buildPrompt(plan,{dadLines,library,actors,speakers}),{log});
  if(!reply)break;
  c=consider(reply,tags[n]);
  if(c&&!c.issues.length)return {story:c.story,source:c.source,lint:firstLint.length?firstLint:[]};
  if(c)log(`lint after repair ${n+1} (${plan.player}): ${c.issues.join(' | ')}`);
 }
 const b=best();
 // a few words or seconds over after every repair (202 of 200, 236 s of 230): keep the chapter, not the template
 if(b&&b.issues.length&&b.issues.every(nearLimit))return {story:b.story,source:b.source+' (a few words over)',lint:[...firstLint,...b.issues]};
 if(b&&b.issues.length&&b.issues.every(i=>nearLimit(i)||SOFT_VARIETY.test(i)))return {story:b.story,source:b.source+' (variety noted)',lint:[...firstLint,...b.issues]};
 return {story:templateChapter(plan,library),source:'template (model chapter failed lint)',lint:b?b.issues:(firstLint.length?firstLint:['reply was not JSON'])};
}
// Same best-of policy, now measured across all routes. A rejected graph is never published.
// Writes only the missing if:"<flag>" lines for the gate/ending, using the same usesFlag/changesStory rules as the lint.
export async function repairFlagPayoffs(story,issues,{ask,log=()=>{}}={}){
 const need=[];for(const i of issues){const m=String(i).match(/^node (gate|ending): flag "(.+?)" needs an if:"(.+?)" line/);if(m)need.push({node:m[1],label:m[2],id:m[3]});}
 if(!need.length||!story?.nodes)return null;
 const text=node=>(story.nodes[node]?.pages||[]).map((p,i)=>`page ${i+1}: `+(p.say||[]).map(l=>lineText(l)).join(' ')).join('\n');
 const prompt=`A children's adventure needs a few short alternate Dad lines. Only ONE of them plays, depending on what the child picked earlier.\n`+
  need.map(n=>`- "${n.id}" (node ${n.node}): he carries "${n.label}". The story there:\n${text(n.node)}\nWrite ONE Dad line, 5-10 words, in which the ${n.label.toLowerCase()} itself DOES something that changes what happens there (it ties, opens, lights, rings, points, shows, holds, frees, guides...). It must contain the word "${(n.label.toLowerCase().match(/[a-z]{3,}/g)||[]).at(-1)}". Not praise, not "you kept it".`).join('\n')+
  `\nReply ONLY JSON: {"<node>:<flag id>":"line", ...} with keys exactly: ${need.map(n=>`"${n.node}:${n.id}"`).join(', ')}.`;
 for(let attempt=0;attempt<3;attempt++){
  const r=await ask(prompt,{log});if(!r)return null;let lines;try{lines=JSON.parse(String(r.text).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{continue;}
  const s=structuredClone(story);let ok=true;
  for(const n of need){const t=String(lines?.[`${n.node}:${n.id}`]||'').trim(),pages0=s.nodes[n.node]?.pages||[],pg0=n.node==='gate'?pages0[0]:pages0.at(-1),last=(pg0?.say||[]).filter(l=>!l?.if).at(-1),lastWho=Array.isArray(last)?last[0]:last?.who,line={who:lastWho==='dad'?'narrator':'dad',text:t,if:n.id};
   if(!t||t.split(/\s+/).length>12||!usesFlag(line,{label:n.label})||!changesStory(line)){ok=false;log(`flag repair: rejected "${t}" for ${n.id}`);break;}
   const pages=s.nodes[n.node]?.pages||[];if(!pages.length){ok=false;break;}
   const page=n.node==='gate'?pages[0]:pages[pages.length-1];page.say=[...(page.say||[]),line];}
  if(ok)return s;}
 return null;}
const SOFT_VARIETY=/occurs twice in a chapter: use its story touch only once|was used in the last three chapters: leave it out today/;
export async function writeAdventure(plan,{sk,kit,ask=askModel,log=()=>{},...opts}={}){
 const brief=integratedBrief(plan,sk,kit,opts),cands=[],firstLint=[];
 const lintOpts={...opts,dadId:plan.actorIds?.dad||'dad',dadName:plan.lead?.name||'Dad'};
 for(let attempt=0;attempt<=MAX_REPAIRS;attempt++){
  const best=cands.slice().sort((a,b)=>writeStoryScore(a.issues)-writeStoryScore(b.issues))[0];
  const prompt=attempt&&best?brief+'\nREPAIR ONLY THESE ISSUES. Preserve every planned beat and node.\n'+best.issues.join('\n')+'\nBEST DRAFT:\n'+JSON.stringify(best.story):brief;
  const r=await ask(prompt,{log});if(!r)break;let story=parseAdventure(r.text);if(!story){log('adventure reply was not JSON');continue;}
  let issues;try{issues=lintAdventure(story,sk,kit,plan,lintOpts);}catch(e){issues=['invalid node data: '+e.message];}
  if(!firstLint.length)firstLint.push(...issues);let styleFixed=false;try{const fixed=softFixAdventure(story,plan),fl=lintAdventure(fixed,sk,kit,plan,lintOpts);if(writeStoryScore(fl)<writeStoryScore(issues)){story=fixed;issues=fl;styleFixed=true;}}catch{}const c={story,issues,source:r.source+(attempt?' (adventure repaired '+attempt+')':' (adventure)')+(styleFixed?' (style fixed)':'')};cands.push(c);
  if(!issues.length)return {...c,lint:firstLint};log(`adventure lint: ${issues.join(' | ')}`);
 }
 // A missing flag payoff is the one rule the full-story repairs keep missing (2026-10-03: both boys' 10-04 drafts failed
 // all repairs on "node ending: flag X needs an if line"). Ask for just those lines, check them with the same rules, slot them in.
 {const b=cands.slice().sort((a,b)=>writeStoryScore(a.issues)-writeStoryScore(b.issues))[0];
  if(b){const fixed=await repairFlagPayoffs(b.story,b.issues,{ask,log});
   if(fixed){let issues;try{issues=lintAdventure(fixed,sk,kit,plan,lintOpts);}catch(e){issues=['invalid node data: '+e.message];}
    const c={story:fixed,issues,source:b.source+' (flag lines repaired)'};cands.push(c);if(!issues.length)return {...c,lint:firstLint};log(`adventure lint after flag repair: ${issues.join(' | ')}`);}}}
 const best=cands.slice().sort((a,b)=>writeStoryScore(a.issues)-writeStoryScore(b.issues))[0];
 if(best&&best.issues.every(i=>nearLimit(i.replace(/^path \w+: /,''))))return {story:best.story,source:best.source+' (a few words over)',lint:best.issues};
 // Variety preferences (a seed touched twice, a seed from the last three chapters) never cost a whole adventure: after
 // every repair on a "number-magic" seed and would have fallen back to a flattened template).
 if(best&&best.issues.every(i=>{const t=i.replace(/^path \w+: /,'');return nearLimit(t)||SOFT_VARIETY.test(t);}))return {story:best.story,source:best.source+' (variety noted)',lint:best.issues};
 // Try the first complete, safe linear path before the deterministic one-world fallback.
 for(const c of cands){try{const story=collapse(c.story,sk),path=adventurePaths(sk)[0],nodes=path.nodes.map(id=>sk.nodes.find(n=>n.id===id));
   const linearPlan={...plan,scenario:null,beats:plan.beats.map(b=>({...b,at:kit.places.find(p=>p.id===nodes.find(n=>n.beats.includes(b.id))?.place)?.bg}))};
   if(!lintChapter(story,linearPlan,lintOpts).length)return {story,source:'adventure collapsed (model graph failed lint)',lint:best?.issues||[]};
  }catch{}}
 const ids=plan.actorIds,actors=ids.all.slice(0,5),nodes=adventurePaths(sk)[0].nodes.map(id=>sk.nodes.find(n=>n.id===id)).filter(n=>!n.choice),pages=[],storyPages=[];
 const names=(plan.cast||[]).map(c=>c.name).join(', ');
 const words=[`${plan.name} and Dad set out. ${names} come too. A map shows the way.`,
  'They stop to look around. One small clue will help them find the next part of the map.',
  'The path brings them together again. Dad holds the map steady. Your ideas help everyone go on.',
  `${plan.name} folds the map with care. Today brought a new way forward. Tomorrow there is more to find.`];
 nodes.forEach((n,i)=>{const scene=kit.places.find(x=>x.id===n.place).bg,prev=nodes[i-1],edge=prev&&prev.place!==n.place?kit.edges.find(([a,b])=>a===prev.place&&b===n.place||b===prev.place&&a===n.place):null;
  const say=words[i].split(/(?<=[.!?])\s+/).map(t=>['narrator',t]);if(edge)say.unshift(['dad','They go '+edge[2]+'.']);
  const p={scene,actors,say,...(edge?{travel:{from:prev.place,to:n.place,text:edge[2]}}:{})};pages.push(p);storyPages.push(p);
  for(const [j,id] of n.beats.entries())pages.push({scene,actors,beat:id,say:[['narrator',(i===0?['A clue waits here. Take your time.','A second clue. Look at each part.']:i===1?['Look closely. This clue opens the way.','Another clue sits by the path.']:['One more clue. You can work it out.','Here is a new part to solve.','The last clue needs a careful look.'])[j%3]]]});
 });
 for(const [i,w] of (plan.magic||[]).entries()){const p=storyPages[i%storyPages.length];p.magic={word:w,object:'the map',after:[['dad',['A new path appears.','The gate opens softly.','The map gains a new mark.','Tomorrow has another place to find.'][i%4]]]};}
 const safe={title:`${plan.name} and the New Path`,summary:`${plan.name} followed the map with Dad and friends.`,hook:'The map has a new place to find.',pages};
 return {story:safe,source:'template (adventure collapsed)',lint:best?.issues||['no model adventure']};
}
// A length issue that is only a little over its limit (at most 5%, or 3 words on a page). Kept after two trims.
export function nearLimit(issue){const t=String(issue);let m;
 if((m=t.match(/^narration has (\d+) words, needs \d+-(\d+)$/)))return +m[1]<=Math.ceil(+m[2]*1.05);
 if((m=t.match(/^everything said adds up to (\d+) words .*\(max (\d+)\)/)))return +m[1]<=Math.ceil(+m[2]*1.05);
 if((m=t.match(/^the chapter would run about (\d+) s \(max (\d+) s\)/)))return +m[1]<=Math.ceil(+m[2]*1.05);
 if((m=t.match(/^page \d+ has (\d+) spoken words \(max (\d+)\)$/)))return +m[1]<=+m[2]+3;
 return false;}
// lines: [{text, voice, speed}]. Returns {made, clips: {"voice|speed|text": file}}.
export async function narrate(lines,{paths,env=process.env}){
 const req=join(tmpdir(),`book-voice-${process.pid}-${Date.now()}.json`);
 await writeFile(req,JSON.stringify({lines,out:paths.voice,models:paths.voiceModels,...soundSource(paths)}));
 try{let r;for(let attempt=0;attempt<3;attempt++){r=await run(paths.python,[join(here,'narrate.py'),req],{env:{...env,BOOK_VOICE_THREADS:attempt?'1':env.BOOK_VOICE_THREADS||'2'},timeoutMs:15*60000});if(r.code===0||r.timedOut||!(r.signal==='SIGABRT'||r.code===134))break;}
  if(r.code!==0)throw Error(r.err.slice(-600)||'narration failed');
  const j=JSON.parse(r.out.trim().split('\n').at(-1));return {made:j.made,clips:j.clips};}
 finally{await rm(req,{force:true});}
}
async function chapterNumber(dir,date){const n=new Set();for(const folder of [dir,join(dir,'review')]){try{for(const f of await readdir(folder))if(/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<date)n.add(f);}catch{}}return n.size+1;}
// The picture library: the household's own (private, next to its chapters) or the generic one shipped here.
export function mergeLibraryAdditions(base,additions={}){return Object.fromEntries(['backgrounds','actors','props'].map(k=>[k,{...additions[k],...base[k]}]));}
export function readLibrary(paths){
 let additions={};try{additions=JSON.parse(readFileSync(join(here,'..','hub','book-art-additions.json'),'utf8'));}catch{}
 let layouts={};try{layouts=JSON.parse(readFileSync(join(here,'..','hub','book-art-layouts.json'),'utf8'));}catch{}
 for(const f of [join(paths.book,'art','lib','library.json'),join(here,'..','hub','public','book-art','library.json')]){
  try{const l=JSON.parse(readFileSync(f,'utf8'));if(!l.backgrounds||!l.actors)continue;
   const merged=mergeLibraryAdditions(l,additions);
   return applyBackgroundLayouts({...l,...merged,private:!f.startsWith(join(here,'..'))},layouts);
  }catch{}
 }
 throw Error('no picture library');
}
// Who can be drawn: the hero, Dad, his brother, and today's friends (by the library's actor ids).
export function actorIdsFor(plan,library){
 const has=id=>!!library.actors[id];
 const hero=has(plan.player)?plan.player:'hero',dad=has('dad')?'dad':'grown-up';
 const sib=plan.sibling&&has(plan.sibling.toLowerCase())?plan.sibling.toLowerCase():null;
 const friends=(plan.cast||[]).map(c=>c.id).filter(has);
 // Every grown-up with a picture (Dad, Mom) can be in the scene; each is reachable by its own id.
 const grown=Object.fromEntries((plan.grownups||[]).filter(g=>g.id!=='dad'&&has(g.id)).map(g=>[g.id,g.id]));
 return {hero,dad,...grown,sibling:sib,all:[hero,dad,...(plan.scenario?.paintedScene&&plan.level==='early'&&has('mom')?['mom']:[]),...Object.values(grown),...(sib?[sib]:[]),...friends].filter(has)};
}
// What he has collected in the book so far (letter keys, words he read, quest items), from the hub's progress file.
// (the items were missing: a quest fork could offer only things already in his spellbook)
// What the last three chapters leaned on (places and foods), so today's can vary it (2026-09-28: pizza everywhere).
const FOODS=['pizza','pancake','waffle','cookie','cake','ice cream','sandwich','nugget','fries','apple','banana','picnic'];
// His previous chapters (up to n, oldest first), for the no-repeat rules.
export async function previousChapters(dir,date,n=8,{includeReview=false}={}){
 const dates=new Map();for(const folder of includeReview?[dir,join(dir,'review')]:[dir]){let files=[];try{files=await readdir(folder);}catch{}for(const f of files)if(/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<date&&!dates.has(f))dates.set(f,join(folder,f));}
 const out=[];for(const [f,file] of [...dates].sort(([a],[b])=>a.localeCompare(b)).slice(-n)){try{out.push(JSON.parse(await readFile(file,'utf8')));}catch{}}return out;
}
export async function recentSettings(dir,date){
 let files=[];try{files=(await readdir(dir)).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<date).sort().slice(-3);}catch{return [];}
 const bgs=new Map(),foods=new Map();
 for(const f of files){let c;try{c=JSON.parse(await readFile(join(dir,f),'utf8'));}catch{continue;}
  for(const p of c.pages||[]){if(p.scene?.bg)bgs.set(p.scene.bg,(bgs.get(p.scene.bg)||0)+1);}
  const text=JSON.stringify(c.pages||[]).toLowerCase();for(const w of FOODS){const n=(text.match(new RegExp(`\\b${w}`,'g'))||[]).length;if(n)foods.set(w,(foods.get(w)||0)+n);}}
 const out=[];const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>k);
 if(bgs.size)out.push(`places: ${top(bgs).slice(0,6).join(', ')}`);
 if(foods.size)out.push(`foods and snacks: ${top(foods).slice(0,4).join(', ')} (pick a different treat, or none)`);
 return out;
}
export async function readCollection(paths,player){try{const p=JSON.parse(await readFile(join(paths.data.hub,'book-progress',player+'.json'),'utf8'));return {keys:p.collection?.keys||[],words:p.collection?.words||[],items:p.collection?.items||[]};}catch{return {keys:[],words:[],items:[]};}}
async function generateChapter(player,{paths,profiles,date,review=false,reviewNote="",noLLM=false,noVoice=false,force=false,life:forceLife=false,now=Date.now(),log=console.log,ask=askModel}){
 const dir=review?join(paths.book,player,'review'):join(paths.book,player),file=slot(paths.book,player,date,review)+'.json';
 if(existsSync(file)&&!force){let schema=null;try{schema=JSON.parse(readFileSync(file,'utf8')).schema;}catch{}
  if(schema===CHAPTER_SCHEMA&&JSON.parse(readFileSync(file,'utf8')).episode){if(!review)await payPublished(paths.book,player,JSON.parse(readFileSync(file,'utf8')));log(`${player} ${date}: chapter exists (use --force to replace)`);return {file,skipped:true};}
  log(`${player} ${date}: replacing a chapter in an older format`);}
 const savedProfile=profiles[player]||{},profile={...savedProfile,adventure:null},extra=[...(profiles._lint?.extra||[]),...(profile.lintExtra||[])];
 const model=await learnerFor(player,{paths,profiles,now,chapterDate:date});
 if(!review)await writeLearner(model,paths.learner);
 const cast=readCast(paths),allow=[...(cast?.allowNames||[]),...(profile.nameSpelling||cast?.children?.[player]?.nameSpelling||[])];
 const life=await ensureLife(player,{paths,profile:{...profile,name:model.name},extra,allow,ask:noLLM?null:ask,log,now,force:forceLife,persist:!review}).catch(e=>{log(`${player}: life context failed (${e.message})`);return null;});
 const collection=await readCollection(paths,player);
 // The held items from the World are also story context; reading them never upgrades a save on disk.
 const worldSave=await readJSON(join(paths.book,'world',player+'.json'))||await readJSON(join(paths.book,'world',player+'.preview.json'));
 if(worldSave)collection.world={room:worldSave.room,items:worldSave.items||[],visited:worldSave.visited||[],solved:worldSave.solved||[]};
 // --- learner model (learner-compile.mjs): what he missed or is ready for today steers the chapter; fail-soft ---
 const learner=await learnerProfileFor(player,{paths,now,bookModel:model,players:bookPlayers(paths,profiles),persist:!review,log:m=>log(m)}).catch(()=>null);
 let planModel=model;try{planModel=focusModel(model,learner);}catch(e){log(`${player} ${date}: learner focus skipped (${e.message})`);}
 const previous=await previousChapters(join(paths.book,player),date,30,{includeReview:review});
 const plan=planChapter(planModel,{date,profile,cast,collection,life,previous});
 plan.nameSpelling=profile.nameSpelling||cast?.children?.[player]?.nameSpelling||[];
 plan.recent=await recentSettings(join(paths.book,player),date);
 const library=readLibrary(paths);
 try{for(const n of applyLearnerPlan(plan,learner,{library}))log(`${player} ${date}: ${n}`);}catch(e){plan.learnerFocus=[];log(`${player} ${date}: learner plan skipped (${e.message})`);}
 if(plan.learnerFocus?.length)log(`${player} ${date}: practises ${plan.learnerFocus.map(f=>`${f.item} (${f.beat} ${f.kind} ${f.value})`).join(', ')}`);
 // --- end learner model ---
 // (nothing drawn as a placeholder: a game's things are library pictures, or the game is swapped)
 for(const n of drawnBeats(plan,library,{countThings:COUNT_THINGS}))log(`${player} ${date}: ${n}`);
 // A new place and a new real-life scenario every chapter: nothing from his last three chapters' backgrounds.
 {const prev=await previousChapters(join(paths.book,player),date,8),recent=recentOf(prev);
  plan.avoidScenarios=recent.slice(-6).map(r=>r.scenario).filter(Boolean);plan.scenario=chooseScenario(player,recent,library,{date});plan.avoidBgs=avoidBgsFor(recent,plan.scenario?.place);
  if(plan.scenario)log(`${player} ${date}: scenario ${plan.scenario.id} at ${plan.scenario.place}; not using ${plan.avoidBgs.join(', ')||'(none)'}`);
  for(const n of scenarioBeats(plan,library))log(`${player} ${date}: ${n}`);}
 // ---- story memory (book/memory.mjs): pick up the last hook, remember one older moment. Never fatal; BOOK_MEMORY=0 turns it off.
 if(process.env.BOOK_MEMORY!=='0'){try{plan.memory=storyMemory(await previousChapters(join(paths.book,player),date,30,{includeReview:review}),{date});
  if(plan.memory.lastHook||plan.memory.callback)log(`${player} ${date}: memory${plan.memory.lastHook?' hook from '+plan.memory.lastHook.date:''}${plan.memory.callback?' callback to '+plan.memory.callback.date+' "'+plan.memory.callback.title+'"':''}`);}
  catch(e){plan.memory=null;log(`${player} ${date}: memory skipped (${e.message})`);}}
 const ids=actorIdsFor(plan,library);plan.actorIds=ids;
 // ---- day notes (book/daynotes.mjs): a grown-up's note about his day becomes the chapter's real-life thread.
 // Sensitive notes arrive only as an allegory seed; their words (and a note's other names/brands) are forbidden here.
 if(!noLLM){const dn=await dayNotesFor(player,{dir:dayNotesDir(paths),date,name:model.name,age:profile.age,extra,allow,grownups:cast?.grownups||[],known:[profile.sibling,...(cast?.cast||[]).map(c=>c.name),...Object.values(cast?.letterWords||{})].filter(Boolean),ask,log}).catch(e=>{log(`${player} ${date}: day notes unavailable (${e.message})`);return null;});
  if(dn){plan.daynotes=dn;extra.push(...dn.forbid);if(dn.thread||dn.moment)log(`${player} ${date}: day note ${dn.thread?'thread '+dn.thread.id:''}${dn.moment?' moment '+dn.moment.id+' ('+dn.moment.kind+')':''}`);}}
 // ---- end day notes
 plan.dadLines=plan.dadLines.map(t=>safeDadLine(t,{extra,allow})).filter(Boolean);
 const writerAsk=reviewNote?((prompt,opts)=>ask(prompt+'\n\nGROWN-UP REVIEW — apply this requested change while retaining all safety and learning requirements:\n'+reviewNote,opts)):ask;
 plan.voice=profile.voice;
 const number=await chapterNumber(join(paths.book,player),date),learning=episodeLearning(plan,planModel,learner||{});
 let certified=null;
 const validate=async episode=>{const candidate=episodeChapter(episode,plan,{library,cast:cast||{},number});const result=await certifyEpisode(candidate,{paths,library,narrate,noVoice});if(!result.issues.length)certified=candidate;return result;};
 const {episode,source,lint=[]}=await writeEpisode(plan,{library,learning,extra,allow,ask:noLLM?async()=>null:writerAsk,log,validate});
 const ch=certified||episodeChapter(episode,plan,{library,cast:cast||{},number,source});ch.meta.source=source;
 if(plan.learnerFocus?.length)ch.meta.learnerFocus=plan.learnerFocus.map(f=>({item:f.item,beat:f.beat,kind:f.kind,value:f.value})); // learner model (what this chapter practises)
 if(plan.scenario||plan.scenarioSource)ch.meta.scenario=plan.scenario?.id||plan.scenarioSource;
 if(plan.memory&&(plan.memory.lastHook||plan.memory.callback)){const use=memoryUse(ch,plan.memory);ch.meta.memory={hookFrom:plan.memory.lastHook?.date||null,callback:plan.memory.callback?{date:plan.memory.callback.date,title:plan.memory.callback.title}:null,used:use};
  if(plan.memory.callback)ch.meta.callback={date:plan.memory.callback.date,title:plan.memory.callback.title};
  log(`${player} ${date}: memory used: hook ${use.hook===null?'-':use.hook?'yes':'no'}, callback ${use.callback===null?'-':use.callback?'yes':'no'}`);}
 const daynotesUsed=plan.daynotes&&!/^(template|deterministic quest fallback)/.test(source)?woven(ch,plan):[];if(daynotesUsed.length)ch.meta.daynotes=daynotesUsed; // day notes
 // No name reaches the voice as raw spelling (it would guess: "Pica" for Picos, "Pip-chu").
 const raw=speechLines(ch).flatMap(l=>rawNames(l.text,cast?.pronounce||{}).map(n=>`${n}: ${l.text.slice(0,50)}`));if(raw.length)throw Error('names without their pronunciation: '+raw.slice(0,3).join(' | '));
 // Every voiced line says each word once (template lines are covered by tests; this catches anything else).
 const twice=speechLines(ch).filter(l=>repeatedWords(l.text).length);if(twice.length)log(`${player} ${date}: WARNING word said twice in a row: `+twice.slice(0,3).map(l=>l.text.slice(0,60)).join(' | '));
 if(!noVoice&&!ch.episode?.checks?.certified){try{const n=await narrate(speechLines(ch),{paths});attachClips(ch,n.clips);log(`${player} ${date}: ${n.made} new clips`);}
  catch(e){log(`${player} ${date}: narration failed; chapter was not published (${String(e.message).slice(0,200)})`);throw e;}}
 if(review){ch.meta.review={state:'pending',at:new Date(now).toISOString(),by:'writer',revision:randomUUID()};
  if(!ch.episode)ch.calm=await renderCalm(ch,{paths,render:!noVoice});
  await backupSlot(slot(paths.book,player,date,true),'history');}
 // Publish: write into a staging folder, then rename each file into place (clips already exist).
 const stage=join(paths.book,'.staging',`${player}-${date}-${process.pid}`);await mkdir(stage,{recursive:true,mode:0o700});await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(join(stage,date+'.md'),markdown(ch),{mode:0o600});
 await writeFile(join(stage,date+'.json'),JSON.stringify(ch,null,1),{mode:0o600});
 if(review)await writeFile(join(stage,date+'.calm.json'),JSON.stringify(ch.calm||null),{mode:0o600});
 for(const ext of review?['md','calm.json','json']:['md','json'])await rename(join(stage,`${date}.${ext}`),join(dir,`${date}.${ext}`));
 await rm(stage,{recursive:true,force:true});
 if(plan.daynotes){if(daynotesUsed.length&&!review)await markUsed(dayNotesDir(paths),daynotesUsed,player,`${player}/${date}`,now).catch(e=>log(`${player} ${date}: could not mark day notes used (${e.message})`));
  log(`${player} ${date}: day notes woven in: ${daynotesUsed.length?daynotesUsed.join(', '):'none (they stay eligible)'}`);} // day notes
 log(`${player} ${date}: "${ch.title}" (${source})${lint.length?' first-draft lint issues (fixed or replaced): '+lint.join(' | '):''}${ch.meta.sceneNotes.length?' scene notes: '+ch.meta.sceneNotes.join('; '):''}`);
 if(!review)await payPublished(paths.book,player,ch);
 if(review)await reviewEvent(paths.book,{action:'draft',player,date,title:ch.title,revision:ch.meta.review.revision});
 return {file,chapter:ch,source,lint};
}
export async function generateOne(player,opts){
 const work=async()=>{
  const live=await readJSON(slot(opts.paths.book,player,opts.date)+'.json');if(live?.meta?.review?.state==='approved')return {skipped:true,file:slot(opts.paths.book,player,opts.date)+'.json'};
  if(opts.review){
   const saved=await readJSON(slot(opts.paths.book,player,opts.date,true)+'.review.json');opts={...opts,reviewNote:opts.reviewNote||saved?.notes?.map(n=>n.text).join('\n')||''};}
  return generateChapter(player,opts);
 };return opts.lockHeld?work():withSlotLock(opts.paths.book,player,opts.date,work);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;},flag=k=>args.includes(k);
 const paths=bookPaths(),profiles=readProfiles(paths),now=Date.now();
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:paths.timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date(now)));
 const date=arg('--date')||(flag('--review')?addDays(localDate(now,paths.timeZone),1):hour<12?localDate(now,paths.timeZone):addDays(localDate(now,paths.timeZone),1));
 const players=arg('--player')?[arg('--player')]:bookPlayers(paths,profiles);
 let failed=0;
 for(const p of players){try{await generateOne(p,{paths,profiles,date,review:flag('--review'),noLLM:flag('--no-llm'),noVoice:flag('--no-voice'),force:flag('--force'),life:flag('--life'),now});}
  catch(e){failed++;console.error(`${p}: ${e.stack||e}`);}}
 process.exit(failed?1:0);
}
