// The Book: a private "life context" per child, distilled from the family's own notes (a list of files
// in profiles.json: "<player>": {"life": {"sources": [...]}}). It holds THEMES, not facts: story seeds the
// chapter writer may use as gentle allegory (a new kid in the forest school finds a friend; a knight takes
// a big breath before a hard gate). Rebuilt weekly or when a source changes; stored only in the learner
// directory (<player>-life.json), never in a repository. Every theme passes the chapter safety lint.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,basename} from 'node:path';
import {homedir} from 'node:os';
import {safetyIssues} from './lint.mjs';
export const LIFE_SCHEMA='family-book-life-1',LIFE_MAX_AGE_MS=7*864e5;
const exp=p=>String(p).replace(/^~(?=\/|$)/,homedir());
export const LIFE_SYSTEM=`You help a parent turn private family notes into gentle story seeds for his child's picture book.
You never copy facts, names, places, dates, quotes, diagnoses or school details into your answer. You write themes a warm children's author could use as allegory.
You reply with ONE JSON object and nothing else.`;
export function lifePrompt({name,age,sibling,text}){
 return `Below are a parent's private notes about ${name} (age ${age}${sibling?`, brother of ${sibling}`:''}). Read them and distil what matters for ${name}'s own adventure book: what he loves, what he is good at, what is new or hard in his life right now, and adventures with his Dad.

RULES
- Output THEMES, not facts. Each theme is one short story seed (max 30 words) a children's author could use as gentle allegory, e.g. "a new kid arrives at the forest school and finds a friend by sharing his ball", "a brave knight takes a big breath before opening a hard gate", "Dad and ${name} build something together and fix it when it wobbles".
- Always empowering. Never label, diagnose or describe a problem with him. Turn a difficulty into a strength he is growing ("learning to wait for his turn" becomes "a friend who learns the magic of waiting, and gets the best surprise").
- NEVER include: names of anyone except ${name}${sibling?`, ${sibling}`:''}, Mom and Dad; teachers or school staff (not even their roles); school, classroom or town names; therapy, evaluations, reports, meetings or "concerns"; illness, doctors, sleep problems, eating, crying, or any family medical event; grandparents; brands; anything shaming or scary.
- 5 to 8 themes. Mix: 2-3 about his interests and strengths, 2-3 gentle allegories of what is new or hard right now, 1-2 adventures with Dad.
- "interests": up to 8 short things he loves (games, sports, animals, activities), as plain words.

NOTES
${text}

REPLY WITH ONLY THIS JSON
{"themes":[{"id":"short-kebab-id","kind":"loves|strength|growing|dad","seed":"..."}],"interests":["..."]}`;
}
export async function readLife(learnerDir,player){try{return JSON.parse(await readFile(join(learnerDir,`${player}-life.json`),'utf8'));}catch{return null;}}
export function checkLife(j,{extra=[],allow=[]}={}){
 const themes=(Array.isArray(j?.themes)?j.themes:[]).map(t=>({id:String(t.id||'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,40),kind:String(t.kind||'').slice(0,12),seed:String(t.seed||'').trim().slice(0,240)}))
  .filter(t=>t.seed&&!safetyIssues(t.seed,{extra,allow}).length);
 const interests=(Array.isArray(j?.interests)?j.interests:[]).map(s=>String(s).trim().slice(0,30)).filter(s=>s&&!safetyIssues(s,{extra,allow}).length).slice(0,8);
 return {themes:themes.slice(0,8),interests};
}
// Returns the current life context, rebuilding it when a source changed or it is older than a week.
export async function ensureLife(player,{paths,profile={},extra=[],allow=[],ask,log=()=>{},now=Date.now(),force=false}){
 const sources=(profile.life?.sources||[]).map(exp);
 const old=await readLife(paths.learner,player);
 if(!sources.length||!ask)return old;
 const parts=[];for(const f of sources){try{parts.push(`=== ${basename(f)} ===\n${(await readFile(f,'utf8')).slice(0,60000)}`);}catch{}}
 if(!parts.length){log(`${player}: life sources not readable; keeping the last life context`);return old;}
 const text=parts.join('\n\n').slice(0,200000),hash=createHash('sha256').update(text).digest('hex').slice(0,16);
 if(!force&&old&&old.sourceHash===hash&&now-Date.parse(old.builtAt)<LIFE_MAX_AGE_MS)return old;
 const reply=await ask(lifePrompt({name:profile.name||player[0].toUpperCase()+player.slice(1),age:profile.age||'',sibling:profile.sibling,text}),{log,system:LIFE_SYSTEM});
 let j=null;try{const s=reply?.text||'';j=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));}catch{}
 const checked=checkLife(j,{extra,allow});
 if(checked.themes.length<3){log(`${player}: life distillation failed or unsafe (${checked.themes.length} usable themes); keeping the last one`);return old;}
 const out={schema:LIFE_SCHEMA,player,builtAt:new Date(now).toISOString(),sourceHash:hash,sources:sources.map(f=>basename(f)),source:reply.source,...checked};
 await mkdir(paths.learner,{recursive:true,mode:0o700});const file=join(paths.learner,`${player}-life.json`);
 await writeFile(file+'.tmp',JSON.stringify(out,null,1),{mode:0o600});await rename(file+'.tmp',file);
 log(`${player}: life context rebuilt (${out.themes.length} themes)`);
 return out;
}
