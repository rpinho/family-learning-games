// The Book: "your day becomes tomorrow's chapter". A grown-up (or Claude, told in chat) leaves a quick note about a
// child's day ("we took the golf cart to the park; he biked") and that night's chapter weaves it in, told warmly as
// a real event from his own life. This is the Primer's "it knows what happened", through the involved parent.
//
// Private store, never in a repository: <book dir>/daynotes/<YYYY-MM-DD>.json (dir 700, files 600), or $FAMILY_DAYNOTES.
//   {schema, date, notes:[{id, at, child: <player>|"both", text, from: "dad"|"mom"|"claude",
//                          memory?: true,                       just for the Book's memory: never told
//                          used?: {<player>: {chapter, at}},    the chapter that wove it in (per child)
//                          soft?: {<player>: {seed}|{skip}}}]}  a sensitive note's allegory seed (cached)
// The nightly (generate.mjs) reads each child's ELIGIBLE notes: about him (or both), not memory-only, not yet used by
// him (or used by this same chapter, so a --force rerun gets the same note), dated at most EXPIRE_DAYS before the chapter.
// Code picks the most chapter-worthy one as the chapter's real-life thread; a second one may be a small moment.
// Sensitive notes (doctors, therapy/OT, evaluations, sleep trouble, school concerns, illness, private names) are NEVER
// sent as written: the model turns them into one gentle allegory seed first (the life.mjs way), checked by the same
// safety lint, else they are skipped. Their trigger words are forbidden in the chapter (lint "private word").
import {readFile,writeFile,rename,mkdir,readdir,rmdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {safetyIssues} from './lint.mjs';
import {LIFE_SYSTEM} from './life.mjs';
import {localDate,addDays} from './paths.mjs';

export const DAYNOTES_SCHEMA='family-book-daynotes-1',EXPIRE_DAYS=3,MAX_TEXT=400,FROM=['dad','mom','claude'];
const DATE=/^\d{4}-\d{2}-\d{2}$/,ID=/^\d{8}-[a-z0-9]{6,12}$/;
export const dayNotesDir=(paths,env=process.env)=>env.FAMILY_DAYNOTES||join(paths.book,'daynotes');
export const cleanText=t=>String(t||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,MAX_TEXT);
const dateOfId=id=>`${id.slice(0,4)}-${id.slice(4,6)}-${id.slice(6,8)}`;

// ---- store -------------------------------------------------------------------------------------------------
async function readDay(dir,date){try{const j=JSON.parse(await readFile(join(dir,date+'.json'),'utf8'));return Array.isArray(j?.notes)?j:{schema:DAYNOTES_SCHEMA,date,notes:[]};}
 catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return {schema:DAYNOTES_SCHEMA,date,notes:[]};throw e;}}
async function writeDay(dir,day){await mkdir(dir,{recursive:true,mode:0o700});const f=join(dir,day.date+'.json'),tmp=`${f}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
 await writeFile(tmp,JSON.stringify({schema:DAYNOTES_SCHEMA,date:day.date,notes:day.notes},null,1),{mode:0o600});await rename(tmp,f);}
// The hub, the CLI and the nightly may write at once: a small directory lock (stale after 30 s).
async function withLock(dir,fn){await mkdir(dir,{recursive:true,mode:0o700});const lock=join(dir,'.lock');
 for(let i=0;;i++){try{await mkdir(lock);break;}catch(e){if(e.code!=='EEXIST')throw e;
  try{if(Date.now()-(await stat(lock)).mtimeMs>30000){await rmdir(lock).catch(()=>{});continue;}}catch{}
  if(i>200)throw Error('day notes are busy; try again');await new Promise(r=>setTimeout(r,25));}}
 try{return await fn();}finally{await rmdir(lock).catch(()=>{});}}
async function changeDay(dir,date,fn){return withLock(dir,async()=>{const day=await readDay(dir,date);const out=await fn(day);await writeDay(dir,day);return out;});}

// children: the valid child ids (players). Returns the stored note.
export async function addNote(dir,{child,text,from='dad',memory=false,now=Date.now(),timeZone='UTC',children=[]}){
 const t=cleanText(text);if(!t)throw Error('Write a few words about the day.');
 const c=String(child||'both').toLowerCase();if(c!=='both'&&!children.includes(c))throw Error(`Choose ${[...children,'both'].join(', ')}.`);
 const f=String(from||'dad').toLowerCase();if(!FROM.includes(f))throw Error(`from must be ${FROM.join(', ')}`);
 const date=localDate(now,timeZone),id=date.replace(/-/g,'')+'-'+randomBytes(5).toString('hex');
 const note={id,at:new Date(now).toISOString(),child:c,text:t,from:f,...(memory?{memory:true}:{})};
 await changeDay(dir,date,day=>{day.notes.push(note);day.notes=day.notes.slice(-60);});
 return {...note,date};
}
export async function removeNote(dir,id){id=String(id||'');if(!ID.test(id))return false;
 return changeDay(dir,dateOfId(id),day=>{const n=day.notes.length;day.notes=day.notes.filter(x=>x.id!==id);return day.notes.length<n;});}
// Notes dated from..to (inclusive), oldest first, each with its date.
export async function listNotes(dir,{from,to}={}){let files=[];try{files=(await readdir(dir)).filter(f=>DATE.test(f.slice(0,10))&&f.endsWith('.json')&&f.length===15);}catch{return [];}
 const out=[];for(const f of files.sort()){const d=f.slice(0,10);if(from&&d<from||to&&d>to)continue;for(const n of (await readDay(dir,d)).notes)out.push({...n,date:d});}
 return out.sort((a,b)=>String(a.at).localeCompare(String(b.at)));}
export async function markUsed(dir,ids,player,chapter,now=Date.now()){
 const byDate=new Map();for(const id of ids)if(ID.test(id))byDate.set(dateOfId(id),[...(byDate.get(dateOfId(id))||[]),id]);
 for(const [date,list] of byDate)await changeDay(dir,date,day=>{for(const n of day.notes)if(list.includes(n.id))n.used={...(n.used||{}),[player]:{chapter,at:new Date(now).toISOString()}};});}
async function saveSoft(dir,id,player,soft){if(!ID.test(id))return;await changeDay(dir,dateOfId(id),day=>{const n=day.notes.find(x=>x.id===id);if(n)n.soft={...(n.soft||{}),[player]:soft};});}

// ---- what can be told --------------------------------------------------------------------------------------
// Never literal in a child's book: medical, therapy and evaluations, sleep trouble, school concerns, hard feelings,
// family medical events. (lint.mjs SAFETY covers more; both run.)
export const SENSITIVE=[
 ['medical',/\b(doctors?|dr\.?|dentists?|pediatrician\w*|paediatrician\w*|hospital\w*|clinic\w*|nurses?|er|urgent care|check-?ups?|appointments?|blood tests?|x-?rays?|stitches|vaccin\w*|medicines?|medication\w*|antibiotic\w*|inhaler\w*|allerg\w*|asthma|sick\w*|ill|illness|fevers?|flu|covid|virus\w*|vomit\w*|threw up|throwing up|diarrh\w*|cough\w*|ear infection|surgery|operation|injur\w*|broke his|sprain\w*|concussion)\b/i],
 ['sleep',/\b(sleep (study|studies|test|problems?|issues?|trouble|apnea|clinic|doctor|lab)|trouble sleeping|(couldn'?t|can'?t|didn'?t|won'?t) sleep|insomnia|night terrors?|nightmares?|bed-?wetting|wet (the|his) bed|melatonin)\b/i],
 ['therapy or evaluation',/\b(OT|PT|ABA|IEP|ADHD|SLP)\b|\b(therap\w*|occupational|speech (therapy|therapist|lessons?)|evaluat\w*|evals?|assess\w*|screening\w*|diagnos\w*|autis\w*|psycholog\w*|psychiatr\w*|neuro\w*|counsel\w*|specialist\w*|sensory|regulat\w*|dysregulat\w*)\b/i],
 ['school concern',/\b(teachers? (said|told|called|emailed|wrote|mentioned)|principal|school (called|meeting|report|concern\w*)|parent-?teacher|conference|report cards?|behaviou?r\w*|in trouble|sent home|detention|incident|concern\w*|worried|struggl\w*|falling behind|bit (a|another|his)|hit (a|another|his)|pushed (a|another)|bull(y|ied|ying))\b/i],
 ['hard feelings',/\b(meltdown\w*|tantrum\w*|cried|crying|cries|upset|angry|anxious|anxiety|scared|afraid|sad|lonely|punish\w*|time-?out|grounded|yell\w*|fight\w*|fought)\b/i],
 ['family event',/\b(grand(ma|mother|pa|father|parents?)|av[oóô]s?|vov[oóô]s?|stroke|funeral|died|death|passed away|divorce\w*)\b/i]];
// What a note touches that must never be told literally: the sensitive kinds and the exact words that matched.
export function sensitivity(text,{extra=[],allow=[]}={}){
 const kinds=[],words=new Set();
 for(const [k,re] of SENSITIVE){const m=[...String(text).matchAll(new RegExp(re.source,re.flags+'g'))].map(x=>x[0]);if(m.length){kinds.push(k);m.forEach(w=>words.add(w));}}
 // a brand is not private, only unsayable: the note is still told, without the brand (it is forbidden in the chapter)
 const brands=new Set();
 for(const i of safetyIssues(text,{extra,allow})){const m=i.match(/^([^:]+): "(.+)"$/);if(!m)continue;if(m[1]==='brand'){brands.add(m[2]);continue;}if(!kinds.includes(m[1]))kinds.push(m[1]);words.add(m[2]);}
 return {sensitive:kinds.length>0,kinds,words:[...words],brands:[...brands]};
}
// Real names of the grown-ups (cast.json grownups[].realNames, private) read as their role: "Mom biked along".
export function normalizeNote(text,grownups=[]){let t=String(text);
 for(const g of grownups)for(const n of g.realNames||[])if(n)t=t.replace(new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'gi'),g.name);
 return t;}
// Capitalised words a literal note may name: the family, his friends, the allowed toy names, days and months.
const COMMON=new Set('i a the we he she they my our his her mom grown-up mama dad daddy papa monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december today yesterday tonight this then after and but so later first ok'.split(' '));
export function unknownNames(text,known=[]){const ok=new Set([...COMMON,...known.flatMap(k=>String(k).toLowerCase().split(/\s+/))]);
 const out=new Set();for(const m of String(text).matchAll(/(^|[^.!?]\s+)([A-Z][\p{L}'-]+)/gu)){const w=m[2].replace(/'s$/,'');if(!ok.has(w.toLowerCase()))out.add(w);}return [...out];}

// ---- choosing ----------------------------------------------------------------------------------------------
const MILESTONE=/\b(first time|for the first time|lost (a|his|her) (tooth|teeth)|tooth|learned|learnt|taught himself|birthday|won|scored|finished|all by himself|on his own|new|built|made|found|caught|climbed|rode|swam|read)\b/i;
const OUTING=/\b(went|go|going|took|visited|trip|park|beach|forest|river|lake|pool|zoo|museum|shop|store|market|library|playground|bike\w*|biked|scoot\w*|skate\w*|cart|car|train|boat|walk\w*|hike\w*|picnic|played|loved|cooked|baked|planted|painted|drew)\b/i;
export function eligible(notes,{player,date}){const chapter=`${player}/${date}`,oldest=addDays(date,-EXPIRE_DAYS);
 return notes.filter(n=>n&&n.text&&!n.memory&&(n.child===player||n.child==='both'||!n.child)&&n.date<=date&&n.date>=oldest&&(!n.used?.[player]||n.used[player].chapter===chapter));}
export function worth(n,{player,date,sensitive=false}){let s=1;
 if(n.child===player)s+=2;else s+=1;
 if(MILESTONE.test(n.text))s+=2;if(OUTING.test(n.text))s+=1;if((n.text.match(/\S+/g)||[]).length>=6)s+=1;
 s-=0.5*Math.max(0,(Date.parse(date)-Date.parse(n.date))/864e5-1);if(sensitive)s-=10;return s;}
// Best first. Each: {note, sensitive, why}.
// known: names a literal note may use (the children, the family, the toys); any other capitalised name is forbidden.
export function rankNotes(notes,{player,date,extra=[],allow=[],grownups=[],known=[]}){
 const names=[...known,...allow,...grownups.map(g=>g.name),...grownups.flatMap(g=>g.alsoCalled||[])];
 return eligible(notes,{player,date}).map(note=>{const text=normalizeNote(note.text,grownups),s=sensitivity(text,{extra,allow});
  return {note:{...note,text},sensitive:s.sensitive,kinds:s.kinds,words:s.words,forbid:[...s.brands,...unknownNames(text,names)],score:worth({...note,text},{player,date,sensitive:s.sensitive})};})
  .sort((a,b)=>b.score-a.score||String(b.note.at).localeCompare(String(a.note.at)));}

// A sensitive note becomes one gentle allegory seed (cached per child in the store), or nothing.
export function softenPrompt({name,age,text}){
 return `A parent wrote this private note about ${name}'s day${age?` (age ${age})`:''}. It touches something private (a visit, a check-up, school, sleep, feelings or someone outside the family) that must NEVER appear literally in his picture book.

Turn it into ONE gentle story seed (at most 30 words) a children's author could use as allegory inside a magical adventure: warm and empowering, never a label or a problem, never naming anyone except ${name}, Mom and Dad, and never mentioning doctors, tests, checks, therapy, school staff, illness, sleep trouble or anything the note names. The seed is a feeling and an action (being brave, trying something new, a cosy moment with Mom or Dad), not a place or a time of day: it must fit any scene of the adventure. If nothing warm and safe can be made of it, reply with an empty seed.

NOTE
${text}

REPLY WITH ONLY THIS JSON
{"seed":"..."}`;
}
export function checkSeed(seed,{extra=[],allow=[],forbid=[]}={}){const s=cleanText(seed).slice(0,240);if(!s)return null;
 if(safetyIssues(s,{extra:[...extra,...forbid],allow}).length||sensitivity(s,{extra,allow}).sensitive)return null;return s;}
export async function softenNote(r,{dir,player,name,age,ask,extra=[],allow=[],log=()=>{}}){
 const cached=r.note.soft?.[player];if(cached)return cached.seed||null;if(!ask)return null;
 let seed=null;try{const reply=await ask(softenPrompt({name,age,text:r.note.text}),{log,system:LIFE_SYSTEM});const s=reply?.text||'';seed=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1)).seed;}catch{}
 const ok=checkSeed(seed,{extra,allow,forbid:r.words});
 if(dir)await saveSoft(dir,r.note.id,player,ok?{seed:ok}:{skip:true}).catch(()=>{});
 if(!ok)log(`${player}: a sensitive day note was skipped (no safe allegory)`);return ok;
}

// ---- the plan hook (generate.mjs) ----------------------------------------------------------------------------
// plan.daynotes = {thread?: {id, text, from, child, when}, moment?: {id, text?|seed?, kind: 'real'|'allegory', ...}, forbid: [...]}
// forbid: words that must not appear in the chapter (added to the lint's private words for this chapter only).
export async function dayNotesFor(player,{dir,date,name,age,extra=[],allow=[],grownups=[],known=[],ask=null,log=()=>{}}){
 const all=await listNotes(dir,{from:addDays(date,-EXPIRE_DAYS),to:date});if(!all.length)return null;
 const ranked=rankNotes(all,{player,date,extra,allow,grownups,known:[name,...known]});if(!ranked.length)return null;
 const when=d=>{const n=Math.round((Date.parse(date)-Date.parse(d))/864e5);return n<=0?'today':n===1?'yesterday':'a few days ago';};
 const real=r=>({id:r.note.id,text:r.note.text,from:r.note.from,child:r.note.child,when:when(r.note.date),kind:'real',forbid:r.forbid});
 const out={thread:null,moment:null,forbid:[...new Set(ranked.filter(r=>r.sensitive).flatMap(r=>r.words))]};
 const literal=ranked.filter(r=>!r.sensitive),soft=ranked.filter(r=>r.sensitive);
 if(literal[0])out.thread=real(literal[0]);
 if(literal[1])out.moment=real(literal[1]);
 else for(const r of soft){const seed=await softenNote(r,{dir,player,name,age,ask,extra,allow,log});if(seed){out.moment={id:r.note.id,seed,kind:'allegory',when:when(r.note.date)};break;}}
 if(!out.thread&&!out.moment)return out.forbid.length?out:null;
 // a told note's other names and brands never reach the chapter either (told as "a friend", "the shop")
 for(const t of [out.thread,out.moment].filter(x=>x?.kind==='real')){out.forbid.push(...t.forbid);delete t.forbid;}
 out.forbid=[...new Set(out.forbid)];
 return out;
}
// (a note through Claude is Dad telling it in a chat)
const whoWrote=f=>f==='mom'?'Mom':'Dad';
// The brief's section (prompt.mjs). Empty when there is nothing to tell.
export function dayNotesSection(plan){const d=plan?.daynotes;if(!d||!(d.thread||d.moment))return '';
 const sib=plan.sibling,both=x=>x&&(x.child==='both'||!x.child)&&sib;const lines=[];
 if(d.thread){const t=d.thread;lines.push(`
FROM HIS REAL DAY (${whoWrote(t.from)} told the Book this happened ${t.when}; it is ${plan.name}'s own life, and the heart of this chapter)
- What happened: "${t.text}"
- Make it the chapter's real-life thread: tell it as a real event, warmly and concretely, like a happy family memory (he really did this). Open with it or build to it, and let the last page come back to it. Today's place, beats and friends above still apply: weave them together (the real outing can lead into today's place, or today's place reminds everyone of it).
- In the note, "I", "me" and "my" mean ${whoWrote(t.from)}; the narrator still never says "I": she tells it to ${plan.name} ("You rode...", "Dad skated beside you").
- Keep the family's own words for things (a nickname for a cart, a game or a place stays as the family says it). Anyone outside the family is "a friend", "a big kid" or "a grown-up"; a real shop, park or school is told generically ("the shop", "the park", "his school"). The people the note names are in that part of the story, as it really happened (nobody who was not there is added to it); the rest of the chapter follows the cast above.${both(t)?`
- His brother ${sib} was there too: give each brother his own moment. Never compare or rank the brothers (who was faster, better, braver or first).`:''}`);}
 if(d.moment)lines.push(d.moment.kind==='allegory'?`
A GENTLE MOMENT FROM HIS WEEK (allegory only: one or two lines on a page that is already in the story; never literal, never naming anyone or anything real)
- ${d.moment.seed}`:`
ONE MORE SMALL REAL MOMENT (${whoWrote(d.moment.from)}, ${d.moment.when}; one short warm touch if it fits, never a lecture)
- "${d.moment.text}"${both(d.moment)?` (his brother ${sib} too; no comparing)`:''}`);
 lines.push(`- These happen inside the chapter's own places (today's place or the 1-3 others): never add a background just for them; every place still gets at least two pages.`);
 return lines.join('\n')+'\n';
}
// Chapter lint (lint.mjs): the brothers are never compared in a chapter that tells their shared day.
const COMPARE=/\b(faster|quicker|better|braver|stronger|smarter|bigger|taller|older|younger|best|fastest|first)\b[^.!?]{0,20}\bthan\b|\b(beat|beats|won against|faster than|better than)\b/i;
export function dayNoteIssues(ch,plan){const d=plan?.daynotes;if(!d?.thread&&!d?.moment||!plan.sibling)return [];
 const out=[],sib=String(plan.sibling).toLowerCase(),me=String(plan.name||'').toLowerCase();
 (ch?.pages||[]).forEach((p,i)=>{const t=JSON.stringify([p?.say||[],p?.after||[]]).replace(/\\"/g,'"');
  for(const s of t.split(/(?<=[.!?])\s+|","|"\],\["/)){const l=s.toLowerCase();if((l.includes(sib)||l.includes('brother'))&&COMPARE.test(s)&&(l.includes(me)||/\byou\b/.test(l)))out.push(`page ${i+1}: never compare the brothers ("${s.slice(0,60)}")`);}});
 return [...new Set(out)];}
// After publishing: which told notes the chapter really used (a real note: its own content words appear).
const STOP=new Set('about after again also and because before being both came come could from good great have into just like loved more much really some that their them then there they this took very went were what when with went would your went'.split(' '));
export function woven(ch,plan){const d=plan?.daynotes;if(!d)return [];const text=JSON.stringify(ch?.episode||ch?.pages||[]).toLowerCase()+' '+String(ch?.summary||'').toLowerCase(),out=[];
 for(const x of [d.thread,d.moment].filter(Boolean)){if(x.kind==='allegory'){out.push(x.id);continue;}
  const words=(x.text.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>!STOP.has(w)&&w!==String(plan.name).toLowerCase()&&w!==String(plan.sibling||'').toLowerCase());
  if(words.some(w=>text.includes(w.slice(0,Math.max(4,w.length-2)))))out.push(x.id);}
 return out;}
// Never worse than without the notes: when the chapter with a day note fails the lint all the way to the template,
// it is written once more without the note (and without its forbidden words) before the template is used.
export const withDayNotes=(write,log=()=>{})=>async(plan,opts)=>{
 const first=await write(plan,opts),dn=plan.daynotes;
 if(!dn||!/^template \(model chapter failed/.test(first.source))return first;
 log(`${plan.player} ${plan.date}: the chapter with the day note failed the lint; writing it once more without the note`);
 delete plan.daynotes;const forbid=new Set(dn.forbid||[]);
 const second=await write(plan,{...opts,extra:(opts.extra||[]).filter(w=>!forbid.has(w))});
 if(/^template/.test(second.source)){plan.daynotes=dn;return first;}
 return {...second,source:second.source+' (without the day note)'};};
