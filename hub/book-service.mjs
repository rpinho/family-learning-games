import {phonicsLine} from './phonics.mjs';
import {bookArtMatch} from './book-art-path.mjs';
// The Book in the hub: serves each child's chapter for today (and a read-only preview for grown-ups),
// keeps his progress and what he has collected in the book (letter keys, words he read), serves the
// picture library and narration, and takes the grown-ups' one-line "Today..." notes (the next chapter's plot).
// Chapters and narration are generated nightly (../book/generate.mjs) into bookDir and only read here.
// Progress and notes are the hub's own saves: data/book-progress/<player>.json, data/book-notes.json.
import {graphOf,routePages,reachedChoices} from './public/book-adventure.mjs';
import {completeAdventure} from '../book/adventure/ledger.mjs';
import {readFile,writeFile,rename,mkdir,readdir,access,mkdtemp,rm,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {bookPaths,resolveVoices,soundSource} from '../book/paths.mjs';
import {setCharacterVoices,setHuntVoices} from '../book/assemble.mjs';
import {LOUDNESS,level} from './voice-level.mjs';
import {artFor} from './public/book-scene.mjs';
import {applyBackgroundLayouts} from './public/book-painted-layout.mjs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),publicArt=join(here,'public','book-art');
// A narration clip's file name (the same key as book/narrate.py): content-addressed, only ever added.
// (book-3: a line with an isolated letter sound, e.g. [[b]]; see book/narrate.py)
export const clipName=({voice,speed,text})=>{const n=Number(speed),sp=Number.isInteger(n)?n.toFixed(1):String(n),v=String(voice).startsWith('local:')?'book-4':([...String(text).matchAll(/\[\[([^\]]*)\]\]/g)].some(m=>{const x=m[1].replace(/[ˈˌ]/g,'');return x.length>0&&x.length<=2;})?'book-3':'book-1');return createHash('sha256').update(`${v}\0${voice}\0${sp}\0${text}`).digest('hex').slice(0,16)+'.wav';};
const ART_TYPES={webp:'image/webp',png:'image/png',svg:'image/svg+xml',jpg:'image/jpeg'};
// (no-store: never a stale book or hunt from a browser cache)
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
export const localDate=(ms=Date.now(),timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const DATE=/^\d{4}-\d{2}-\d{2}$/;
// Only chapters in the picture-book format are served (an older chapter is treated as missing).
export const CHAPTER_SCHEMA='family-book-chapter-2';
export const AUTO_OPENS=3;
// Real-world hunts (find things that start with a sound, find a letter or word written at home): up to this many a day.
export const HUNTS_PER_DAY=5; // the day's hunts cover 3 letters (2026-09-28: "they want to do more letters")
// Tries on a beat: how many, whether the first was right, and how fast it came (a guess is under 1.5 s).
const attemptsOf=r=>{const o={};if(Number.isFinite(Number(r.attempts))&&r.attempts!=null)o.attempts=Math.max(0,Math.min(99,Number(r.attempts)));if(typeof r.correct==='boolean')o.correct=r.correct;if(Number.isFinite(Number(r.firstTapMs))&&r.firstTapMs!=null){o.firstTapMs=Math.max(0,Math.min(36e5,Math.round(Number(r.firstTapMs))));o.guess=o.firstTapMs<1500;}return o;};
const readJSON=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return fallback;throw e;}};
// An optional private release overlay changes pictures through the same staging/idle queue as code.
// It never edits the running household's library, chapters or saves.
// A release overlay (book-art-local.json) replaces whole entries (a fixed picture of the same place); a background's
// keep-out zones (the painted objects nobody may cover) come from the household library unless the overlay gives its own.
export function mergeArtLibrary(base,patch={}){const out=Object.fromEntries(['backgrounds','actors','props'].map(k=>[k,{...base?.[k],...patch[k]}]));
 for(const [id,b] of Object.entries(patch.backgrounds||{})){const z=base?.backgrounds?.[id]?.keepOut;if(b&&!b.keepOut&&Array.isArray(z))out.backgrounds[id]={...b,keepOut:z};}
 return out;}
async function writeJSON(file,value){const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file);}
export function cleanNote(text){return String(text||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);}
// Which child a note is about: the one whose first name it mentions, otherwise both.
export function noteTarget(text,players){const hits=players.filter(p=>p.name&&new RegExp(`\\b${p.name.replace(/[^\p{L}]/gu,'')}\\b`,'iu').test(text));return hits.length===1?hits[0].id:null;}
export function progressView(day){return {opens:day?.opens||0,page:day?.page||0,finished:!!day?.finished,results:day?.results||[],...(day?.choices?{choices:day.choices}:{})};}
export function shouldOpen(chapter,day){return !!chapter&&!day?.finished&&(day?.opens||0)<AUTO_OPENS;}
export function bookService({data,bookDir,players,config,log=()=>{},timeZone,now=()=>Date.now(),assets3d=null,voiceEngine=null}){
 const localArt=readJSON(join(here,'book-art-local.json'),{});
 // Voices whose private renderer opens every line with the character's recorded cry (voice-renderers.json):
 // their lines are marked cry:true so the players never let that friend speak twice in a row.
 async function markCries(obj){const r=(await readJSON(join(bookDir,'voice-renderers.json'),{}))?.voices||{};
  const cry=new Set(Object.entries(r).filter(([,v])=>/reaction/i.test(JSON.stringify(v?.command||[]))).map(([k])=>k));if(!cry.size)return obj;
  const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(typeof v.text==='string'&&cry.has(v.voice))v.cry=true;for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(obj);return obj;}
 // A letters book's quest hint that names a friend whose name does NOT start with the book's letter is left out when
 // served (2026-10-01: "Birdie starts with [[f]] too! Can you find Birdie?" in the F book, written before the
 // generator fix; the chapter file stays as written).
 const fitHints=c=>{const L=String(c?.letter||'').toUpperCase(),q=c?.quest;if(!/^[A-Z]$/.test(L)||!Array.isArray(q?.hints))return c;
  q.hints=q.hints.filter(h=>{const t=String(h?.line?.text||h?.text||''),m=t.match(/^((?:the )?[A-Z][\w-]*(?: [A-Z][\w-]*)*) starts with /i);
   return !(m&&/^[A-Z]/.test(String(h?.word||''))&&String(h.word).replace(/^the\s+/i,'')[0].toUpperCase()!==L);});return c;};
 async function library(){const additions=await readJSON(join(here,'book-art-additions.json'),{});const base=await readJSON(join(bookDir,'art','lib','library.json'),null)||await readJSON(join(publicArt,'library.json'),{});return applyBackgroundLayouts(mergeArtLibrary(mergeArtLibrary(additions,base),(await localArt).library),await readJSON(join(here,'book-art-layouts.json'),{}));}
 // ---- on-demand narration: a line with no clip is rendered by the same local voice engine (never the device's
 // voice), cached in the voice store, one at a time, at the lowest priority. Only lines that exist in a story or
 // a chapter can be rendered. narrate(lines) -> {clips} can be replaced in tests.
 let voiceQueue=Promise.resolve();
 const narrate=voiceEngine||(async lines=>{const p=bookPaths();const dir=await mkdtemp(join(tmpdir(),'book-voice-'));const req=join(dir,'req.json');
  await writeFile(req,JSON.stringify({lines,out:join(bookDir,'voice'),models:p.voiceModels,renderer_timeout:65,...soundSource({...p,voiceRenderers:join(bookDir,'voice-renderers.json')})}));
  try{const out=await new Promise((ok,no)=>execFile('nice',['-n','19','taskpolicy','-b',p.python,join(here,'..','book','narrate.py'),req],{timeout:90000,maxBuffer:1<<22,env:{...process.env,BOOK_VOICE_THREADS:'2'}},(e,so)=>e?no(e):ok(so)));
   return JSON.parse(String(out).trim().split('\n').at(-1));}finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}});
 async function renderLine(line){const file=clipName(line),at=join(bookDir,'voice',file);
  try{await access(at);return file;}catch{}
  const run=voiceQueue.catch(()=>{}).then(()=>narrate([line]));voiceQueue=run;
  const r=await run;const made=r?.clips?.[`${line.voice}|${line.speed}|${line.text}`];if(!made)throw Error('not rendered');
  await log({type:'book_voice_rendered',file:made,chars:line.text.length});return made;}
 const lineIn=(v,want)=>{let hit=false;const walk=x=>{if(hit||!x||typeof x!=='object')return;if(Array.isArray(x))return x.forEach(walk);if(x.text===want.text&&x.voice===want.voice&&Number(x.speed)===Number(want.speed))hit=true;else Object.values(x).forEach(walk);};walk(v);return hit;};
 const kids=config.players.filter(p=>p.id!=='admin');
 const progressDir=join(data,'book-progress'),notesFile=join(data,'book-notes.json');
 let queue=Promise.resolve();
 const serial=fn=>(queue=queue.catch(()=>{}).then(fn));
 const today=()=>localDate(now(),timeZone);
 async function chapter(player,date,review=false){if(!DATE.test(date))return null;const c=await readJSON(join(bookDir,player,...(review?['review']:[]),date+'.json'),null)||(review?await readJSON(join(bookDir,player,'review',date+'.receipt.json'),null):null);
  if(!c||c.player!==player||c.schema!==CHAPTER_SCHEMA||!Array.isArray(c.pages))return null;
  const cast=await readJSON(join(bookDir,'cast.json'),{});
  for(const l of setCharacterVoices(c,cast)){const file=clipName(l);try{await access(join(bookDir,'voice',file));l.clip=file;}catch{}}
  await markCries(c);fitHints(c);
  // Pictures come from TODAY's art library, not the one the chapter was written with: an older chapter gets the
  // current drawings and layouts too (a train that carries its riders instead of covering them, redrawn friends).
  // The story stays exactly as written; selected cast voices and pictures refresh on read.
  const lib=await library();
  if(lib?.actors){const fresh=artFor(c.pages,lib),old=c.art||{};c.art={backgrounds:{...old.backgrounds,...fresh.backgrounds},actors:{...old.actors,...fresh.actors},props:{...old.props,...fresh.props}};}
  // The calm Book's own lines (book/calm-lines.mjs writes <player>/<date>.calm.json beside the chapter): with clips.
  const calm=c.calm||await readJSON(join(bookDir,player,...(review?['review']:[]),date+'.calm.json'),null);
  if(calm?.schema==='family-book-calm-1'){const all=[calm.greet,calm.offer,calm.easier,calm.harder,...(calm.resets||[]),...Object.values(calm.pages||{}).flatMap(o=>[o.ask,o.praise])].filter(l=>l?.text);
   for(const l of all){const file=clipName(l);try{await access(join(bookDir,'voice',file));l.clip=file;}catch{}}c.calm=calm;}
  return c;}
 // Today's book letter (a letters book): the chapter's letter, else its teach-letter beat's.
 async function bookChapter(player,date){const c=await readJSON(join(bookDir,player,date+'.json'),null);return c?.level==='early'?fitHints(c):null;}
 const letterOf=c=>{const L=c?.letter||c?.pages?.find(p=>p.beat?.kind==='teach-letter')?.beat?.letter;return /^[A-Za-z]$/.test(L||'')?L.toUpperCase():null;};
 // A letters book whose letter has no hunt in the day's hunts (the chapter was written or rewritten after the hunts,
 // e.g. a parent-review sample): its own quest becomes that letter's sound hunt, so the book's closing card and the
 // hunt it opens always show the same letter (2026-09-30: the book ended on B and the hunt opened on M). Voiced by
 // the chapter's own clips; nothing is invented.
 function questHunt(c,L,date){const q=c?.quest;if(!q?.text||!L)return null;const snd=String(c.pages?.find(p=>p.beat?.kind==='teach-letter')?.beat?.sound||'').replace(/[\[\]]/g,'');
  return {id:`${L}-sound-${date}`,mode:'letter',kind:'sound',letter:L,generated:date,fromBook:true,intro:q,tip:snd?`${L} says /${snd}/`:L,
   goal:{text:snd?`Find things that start with /${snd}/`:`Find things that start with ${L}`},hints:(q.hints||[]).filter(h=>h?.word).slice(0,3)};}
 // Today's hunt for a child: the ONE place that decides which hunt (and so which letter) comes first. The Letter
 // Hunt screen and the book's closing hunt card both use it, so they always show the same letter.
 async function dayHunt(player,{mode:want=null}={}){
  const cfg0=(await readJSON(join(bookDir,'hunts.json'),{players:{}})).players?.[player];if(!cfg0?.hunts?.length)return null;
  const cast=await readJSON(join(bookDir,'cast.json'),{});
  for(const l of setHuntVoices(cfg0,cast)){const file=clipName(l);try{await access(join(bookDir,'voice',file));l.clip=file;}catch{}}
  await markCries(cfg0);
  // Two kinds of hunt: a LETTER (its sound or its shape) or a WORD. The mode is remembered per child on this
  // computer (not in one browser); a hunt without a mode is a letter hunt. Letter is the default.
  const modeOf=h=>h.mode==='word'?'word':'letter',modes=[...new Set(cfg0.hunts.map(modeOf))].sort();
  const p=await progress(player),mode=modes.includes(want)?want:modes.includes(p.huntMode)?p.huntMode:modes.includes('letter')?'letter':modes[0];
  const cfg={...cfg0,...(cfg0.byMode?.[mode]||{}),hunts:cfg0.hunts.filter(h=>modeOf(h)===mode)};
  const date=today(),day=p.days[date]||{},started=(day.hunts||[]).length,done=new Set(p.collection?.hunts||[]);
  // ONE letter for the day: a letters book's hunt is the book's letter (its closing page sends him here), so the
  // hunt for that letter comes first, unless it is done; an unfinished hunt of another letter waits behind it.
  const chapter=mode==='letter'?await bookChapter(player,date):null,L=letterOf(chapter),same=h=>L&&String(h.letter||'').toUpperCase()===L;
  if(L&&!cfg.hunts.some(same)){const qh=questHunt(chapter,L,date);if(qh)cfg.hunts=[qh,...cfg.hunts];}
  const openH=(day.hunts||[]).find(h=>!h.foundAt),openCfg=cfg.hunts.find(h=>h.id===openH?.id);
  const hunt=(openCfg&&(!L||same(openCfg))?openCfg:null)||cfg.hunts.find(h=>same(h)&&!done.has(h.id))||openCfg||cfg.hunts.find(h=>!done.has(h.id))||cfg.hunts[started%cfg.hunts.length];
  return {cfg,hunt,mode,modes,date,started,open:openH};}
 async function progress(player){return readJSON(join(progressDir,player+'.json'),{days:{}});}
 async function notes(){const n=await readJSON(notesFile,{notes:[]});return Array.isArray(n.notes)?n.notes:[];}
 async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Object.assign(Error('Too much data.'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
 // What he keeps from the book: letter keys (A-Z) and words he read himself (magic words).
 function collect(p,earned){if(!earned||typeof earned!=='object')return;const c=p.collection??={keys:[],words:[]};
  const k=String(earned.key||'');if(/^[A-Z]$/.test(k)&&!c.keys.includes(k))c.keys.push(k);
  const w=String(earned.word||'').toLowerCase();if(/^[a-z]{1,12}$/.test(w)&&!c.words.includes(w))c.words=[...c.words,w].slice(-300);
  // A quest item (a quest-style book's fork): only an item that exists in today's chapter is kept (id, name, emoji).
  const it=String(earned.item||'');if(/^[a-z0-9-]{1,32}$/.test(it)&&earned.itemInfo&&!(c.items||[]).some(x=>x.id===it))c.items=[...(c.items||[]),{id:it,name:String(earned.itemInfo.name||it).slice(0,40),emoji:String(earned.itemInfo.emoji||'✨').slice(0,4)}].slice(-60);}
 // Clips keep their names when their letter sounds are re-rendered (hub/scripts/rerender-sounds.mjs moves the old ones
 // to voice-replaced-<stamp>/), and clips are cached as immutable, so every clip URL carries the newest re-render stamp:
 // a device that cached the old sound fetches the new one.
 // The loudness levelling's own name is added (hub/voice-level.mjs), so levelled copies replace cached unlevelled ones.
 const voiceRev=async()=>{let stamp='';try{stamp=(await readdir(bookDir)).filter(n=>/^voice-replaced-\d{8}T\d{6}$/.test(n)).sort().at(-1)?.slice(15)||'';}catch{}return (stamp?stamp+'-':'')+LOUDNESS.rev;};
 // Served copies of the narration clips (see /book-voice/<clip>.webm), levelled to one loudness (hub/voice-level.mjs):
 // at most two encodes at a time, each written to a temporary name and renamed, so a half-written file is never served.
 const aacDir=join(bookDir,'voice-aac'),aacWait=new Map();let aacRunning=0;const aacQueue=[];
 const aacSlot=()=>new Promise(r=>{if(aacRunning<2){aacRunning++;r();}else aacQueue.push(r);}),aacDone=()=>{const n=aacQueue.shift();if(n)n();else aacRunning--;};
 async function aacOf(id,ext='m4a'){
  const wav=join(bookDir,'voice',id+'.wav'),m4a=join(aacDir,`${id}.${LOUDNESS.rev}.${ext}`);
  const [w,a]=await Promise.all([stat(wav).catch(()=>null),stat(m4a).catch(()=>null)]);if(!w)return null;
  if(a&&a.mtimeMs>=w.mtimeMs)return readFile(m4a);
  const key=id+'.'+ext;
  if(!aacWait.has(key))aacWait.set(key,(async()=>{await aacSlot();try{await mkdir(aacDir,{recursive:true});const tmp=m4a+`.${process.pid}.tmp.${ext}`;
    await level(wav,tmp,ext);
    await rename(tmp,m4a);return await readFile(m4a);}catch{return null;}finally{aacDone();aacWait.delete(key);}})());
  return aacWait.get(key);}
 const collectionOf=p=>({keys:p.collection?.keys||[],words:p.collection?.words||[],...(p.collection?.items?.length?{items:p.collection.items}:{}),...(p.collection?.hunts?.length?{hunts:p.collection.hunts}:{})});
 // Grown-ups' preview: the newest chapter up to tomorrow (or a given date), read-only.
 async function latest(player,date){if(date)return DATE.test(date)?{date,chapter:await chapter(player,date)}:{date,chapter:null};
  const limit=localDate(now()+864e5,timeZone);let files=[];try{files=(await readdir(join(bookDir,player))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)<=limit).sort();}catch{}
  for(const f of files.reverse()){const c=await chapter(player,f.slice(0,10));if(c)return {date:f.slice(0,10),chapter:c};}return {date:today(),chapter:null};}
 async function update(player,input){
  return serial(async()=>{
   const p=await progress(player),date=today();
   if(!['living','huntMode'].includes(input.type)&&input.date!==date)throw Object.assign(Error('That chapter is not today’s.'),{status:409});
   const day=p.days[date]??={opens:0,page:0,finished:false,results:[],startedAt:new Date(now()).toISOString()};
   const page=Math.max(0,Math.min(60,Number(input.page)||0));
   if(input.type==='open')day.opens++;
   else if(input.type==='page'){const ch=await chapter(player,date);if(graphOf(ch)){if(!routePages(ch,day.choices||{}).includes(page))throw Object.assign(Error('That page is not on your route.'),{status:409});day.page=page;}else day.page=Math.max(day.page,page);}
   else if(input.type==='choice'){const ch=await chapter(player,date),pg=ch?.pages?.[page],choices=reachedChoices(ch,day.choices||{});
    if(!graphOf(ch)||!pg?.choice||pg.node!==input.node||!routePages(ch,choices).includes(page)||!pg.choice.options.some(o=>o.id===input.option))throw Object.assign(Error('Choose an available route.'),{status:409});
    if(choices[pg.node]&&choices[pg.node]!==input.option)throw Object.assign(Error('This chapter remembers your first choice.'),{status:409});day.choices={...choices,[pg.node]:input.option};day.page=page;}
   // Time on a page (sent when he leaves it): summed per page, each visit capped at 30 minutes.
   else if(input.type==='dwell'){const ms=Math.max(0,Math.min(18e5,Math.round(Number(input.ms)||0)));const d=day.dwell??={};d[page]=Math.min(36e5,(d[page]||0)+ms);}
   else if(input.type==='result'){const r=input.result||{};
    if(r.earned?.item){const ch=await chapter(player,date);const o=ch?.pages?.flatMap(pg=>pg.beat?.kind==='fork'?pg.beat.options:[]).find(o=>o.item?.id===r.earned.item);r.earned={...r.earned,itemInfo:o?.item||null};}
    collect(p,r.earned);day.results=[...day.results.filter(x=>x.page!==page),{page,at:new Date(now()).toISOString(),kind:String(r.kind||'').slice(0,20),misses:Math.max(0,Math.min(99,Number(r.misses)||0)),ms:Math.max(0,Math.min(36e5,Number(r.ms)||0)),hints:Math.max(0,Math.min(9,Number(r.hints)||0)),...(['voice','echo','tap'].includes(r.via)?{via:r.via}:{}),...(/^[a-z0-9-]{1,24}$/.test(String(r.choice||''))?{choice:String(r.choice)}:{}),...(r.trace&&typeof r.trace==='object'?{trace:{ms:Math.max(0,Math.min(36e5,Math.round(Number(r.trace.ms)||0))),strokes:Math.max(0,Math.min(20,Number(r.trace.strokes)||0))}}:{}),...attemptsOf(r)}].slice(-20);}
   // The living book: one record per beat (tries, first-try right, time to the first tap; a guess is under 1.5 s).
   else if(input.type==='living'){const L=day.living??=[];L.push({story:String(input.story||'').slice(0,40),beat:String(input.beat||'').slice(0,24),at:new Date(now()).toISOString(),...attemptsOf(input),misses:Math.max(0,Math.min(99,Number(input.misses)||0)),ms:Math.max(0,Math.min(36e5,Number(input.ms)||0)),...(['voice','echo','tap'].includes(input.via)?{via:input.via}:{})});if(L.length>60)L.splice(0,L.length-60);}
   else if(input.type==='finish'){const ch=await chapter(player,date);await completeAdventure(bookDir,player,ch,day.choices||{});day.finished=true;day.finishedAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else if(input.type==='hunt'){
    // A hunt away from the screen: started (counts toward today's limit) and found (with how many, if a grown-up said).
    const id=String(input.id||'').slice(0,24),hs=day.hunts??=[];let h=hs.find(x=>x.id===id&&!x.foundAt);
    if(input.stage==='start'){if(!h){if(hs.length>=HUNTS_PER_DAY)throw Object.assign(Error('That is enough hunting for today.'),{status:429});hs.push(h={id,startedAt:new Date(now()).toISOString()});}}
    // Only a grown-up-confirmed count of at least one completes a hunt (zero: keep looking, it stays open).
    else if(input.stage==='found'&&h&&input.confirmed===true&&Number(input.found)>=1){h.foundAt=new Date(now()).toISOString();h.found=Math.max(0,Math.min(20,Number(input.found)||0));h.ms=Date.parse(h.foundAt)-Date.parse(h.startedAt);
     const c=p.collection??={keys:[],words:[]};c.hunts=[...new Set([...(c.hunts||[]),id])].slice(-100);}
   }
   // Easier or harder next time (the calm Book's closing offer): remembered for the next chapters.
   else if(input.type==='difficulty'){if(!['easier','harder'].includes(input.value))throw Object.assign(Error('Unknown choice.'),{status:400});p.difficulty={value:input.value,date,at:new Date(now()).toISOString()};}
   else if(input.type==='huntMode'){if(!['letter','word'].includes(input.mode))throw Object.assign(Error('Unknown mode.'),{status:400});p.huntMode=input.mode;}
   else if(input.type==='leave'){day.leftAt=new Date(now()).toISOString();day.page=Math.max(day.page,page);}
   else throw Object.assign(Error('Unsupported action.'),{status:400});
   const keep=Object.keys(p.days).sort().slice(-30);p.days=Object.fromEntries(keep.map(k=>[k,p.days[k]]));
   await mkdir(progressDir,{recursive:true,mode:0o700});await writeJSON(join(progressDir,player+'.json'),p);
   await log({type:'book',player,action:input.type,date,page,finished:day.finished,...(input.type==='hunt'?{hunt:String(input.id||'').slice(0,24),stage:input.stage,found:Number(input.found)||0}:{}),...(input.type==='living'?{story:String(input.story||'').slice(0,40),beat:String(input.beat||'').slice(0,24),...attemptsOf(input)}:{}),...(input.type==='result'?{...attemptsOf(input.result||{}),misses:day.results.find(x=>x.page===page).misses,hints:day.results.find(x=>x.page===page).hints}:{})});
   return progressView(day);
  });
 }
 return {
  async handle(req,res,u){
   if(u.pathname==='/api/book'){
    const player=u.searchParams.get('player');
    if(!kids.some(k=>k.id===player)){if(player==='admin'||players.includes(player))return send(res,200,{date:today(),chapter:null,progress:progressView(null),open:false});return send(res,400,{error:'Choose a player.'});}
    if(req.method==='GET'){const date=today(),ch=await chapter(player,date),p=await progress(player),day=p.days[date];
     // peek: only whether an unread chapter is waiting (the hub asks at session start; the chapter loads when opened).
     if(u.searchParams.get('peek'))return send(res,200,{date,hasChapter:!!ch,open:shouldOpen(ch,day)});
     // The closing hunt card: today's first LETTER hunt, exactly the one the Letter Hunt screen opens on (dayHunt).
     const H=ch?await dayHunt(player,{mode:'letter'}).catch(()=>null):null,hunt=H?.mode==='letter'&&/^[A-Za-z]$/.test(H.hunt?.letter||'')?{letter:H.hunt.letter.toUpperCase(),intro:H.hunt.intro||null}:null;
     return send(res,200,{voiceRev:await voiceRev(),date,chapter:ch,progress:progressView(day),collection:collectionOf(p),open:shouldOpen(ch,day),...(hunt?{hunt}:{})});}
    if(req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
     try{return send(res,200,{progress:await update(player,await body(req))});}catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save.'});}}
    return send(res,405,{error:'Unsupported action.'});
   }
   // Today's next hunt for a child (from the household's private hunts.json), and how many are left today.
   if(u.pathname==='/api/book/hunt'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const H=await dayHunt(player);if(!H)return send(res,200,{available:false});const {cfg,hunt,mode,modes,date,started,open}=H;
    return send(res,200,{available:true,voiceRev:await voiceRev(),date,left:Math.max(0,HUNTS_PER_DAY-started)+(open?1:0),hunt,friend:cfg.friend||null,label:cfg.label||'Hunt',tomorrow:cfg.tomorrow||null,cheer:cfg.cheer||null,mode,modes});
   }
   if(u.pathname==='/api/book/preview'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const review=u.searchParams.get('review')==='1',want=u.searchParams.get('date')||localDate(now()+864e5,timeZone);
    const {date,chapter:ch}=review?{date:want,chapter:await chapter(player,want,true)}:await latest(player,u.searchParams.get('date'));const p=await progress(player);
    return send(res,200,{voiceRev:await voiceRev(),date,chapter:ch,progress:progressView(null),collection:collectionOf(p),open:!!ch,preview:true});
   }
   // The living book: the whole picture library (with URLs) and its narration clips (private manifest).
   if(u.pathname==='/api/book/library'&&req.method==='GET'){
    const lib=await library();
    const url=f=>'/book-art/'+f;const out={backgrounds:{},actors:{},props:{}};
    for(const [k,b] of Object.entries(lib.backgrounds||{}))out.backgrounds[k]={url:url(b.file),...(b.variants?{variants:Object.fromEntries(Object.entries(b.variants).map(([name,v])=>[name,{...v,url:url(v.file)}]))}:{}),...(b.bed!==undefined?{bed:b.bed}:{}),...(b.goal?{goal:b.goal}:{}),...(b.keepOut?{keepOut:b.keepOut}:{}),...(Number.isFinite(b.foreground)?{foreground:b.foreground}:{}),...(b.oneRow?{oneRow:true}:{}),...(b.fit?{fit:b.fit}:{}),...(b.portraitHeight?{portraitHeight:b.portraitHeight}:{}),...(b.floorColor?{floorColor:b.floorColor}:{}),...(b.targets?{targets:b.targets}:{}),...(b.size?{size:b.size}:{}),...(b.focal?{focal:b.focal}:{}),...(b.standBand?{standBand:b.standBand}:{}),...(Number.isFinite(b.groundStart)?{groundStart:b.groundStart}:{}),...(Number.isFinite(b.ground)?{ground:b.ground}:{})};
    for(const [k,a] of Object.entries(lib.actors||{}))out.actors[k]={name:a.name||k,h:a.h||.4,poses:Object.fromEntries(Object.entries(a.poses||{}).map(([n,P])=>[n,{url:url(P.file),ar:P.ar||.6,...(P.fly?{fly:true}:{})}]))};
    for(const [k,P] of Object.entries(lib.props||{}))out.props[k]={url:url(P.file),h:P.h||.12,ar:P.ar||1};
    return send(res,200,out);
   }
   // One story from the household's private story file (words, voices, cast roles) with its narration clips.
   if(u.pathname==='/api/book/living'&&req.method==='GET'){const f=await readJSON(join(bookDir,'living','stories.json'),{stories:{},clips:{}});const id=String(u.searchParams.get('story')||'');
    const raw=Object.hasOwn(f.stories||{},id)?f.stories[id]:null;if(!raw)return send(res,404,{error:'No such story.'});
    const named=(await readJSON(join(bookDir,'cast.json'),{}))?.voices||{},story={...raw,voices:resolveVoices(raw.voices,named)};
    const clips=Object.fromEntries(Object.values(story.lines||{}).map(([who,text])=>{const v=story.voices?.[who]||story.voices?.narrator||{};const k=`${v.voice}|${v.speed}|${text}`;return [k,f.clips?.[k]];}).filter(([,c])=>c));
    return send(res,200,{story,clips});}
   // A missing narration clip, rendered now: {story, key} (a living-book line) or {player, date, text, voice, speed}
   // (a line of that child's chapter). Returns {clip}. Anything else is refused.
   if(u.pathname==='/api/book/phonics'&&req.method==='POST'){
    let b;try{b=await body(req);}catch(e){return send(res,e.status||400,{error:e.message});}
    if(!kids.some(k=>k.id===b.player))return send(res,400,{error:'Choose a player.'});
    const line=phonicsLine(b.word,b.mode);if(!line)return send(res,400,{error:'No recorded sound for this item.'});
    try{return send(res,200,{clip:await renderLine(line)});}catch{return send(res,503,{error:'Sound unavailable.'});}}
   if(u.pathname==='/api/book/voice'&&req.method==='POST'){let b;try{b=await body(req);}catch(e){return send(res,e.status||400,{error:e.message});}
    let line=null;
    if(b.story){const f=await readJSON(join(bookDir,'living','stories.json'),{stories:{}});const st=Object.hasOwn(f.stories||{},b.story)?f.stories[b.story]:null;const l=st?.lines?.[b.key];
     const voices=resolveVoices(st?.voices,(await readJSON(join(bookDir,'cast.json'),{}))?.voices||{});
     if(l){const v=voices[l[0]]||voices.narrator;if(v)line={text:l[1],voice:v.voice,speed:v.speed};}}
    else if(kids.some(k=>k.id===b.player)&&DATE.test(String(b.date||''))){const ch=await chapter(b.player,b.date);const want={text:String(b.text||''),voice:String(b.voice||''),speed:Number(b.speed)};if(ch&&want.text&&lineIn(ch,want))line=want;
     else if(b.date===today()){const h=(await readJSON(join(bookDir,'hunts.json'),{}))?.players?.[b.player];if(h){setHuntVoices(h,await readJSON(join(bookDir,'cast.json'),{}));if(want.text&&lineIn(h,want))line=want;}}}
    if(!line||!line.text||line.text.length>400)return send(res,404,{error:'No such line.'});
    try{return send(res,200,{clip:await renderLine(line)});}catch(e){await log({type:'book_voice_error',detail:String(e.message).slice(0,160)});return send(res,503,{error:'Could not render the line.'});}}
   // The household's 3D toys (GLB models made privately in Blender) and the list of which exist.
   if(u.pathname.startsWith('/book-3d/')&&req.method==='GET'){
    if(!assets3d)return send(res,404,{error:'No 3D toys here.'});
    if(u.pathname==='/book-3d/index.json'){let files=[];try{files=(await readdir(assets3d)).filter(f=>/^[a-z0-9-]{1,40}\.glb$/.test(f)).map(f=>f.slice(0,-4));}catch{}
     // Optional private looks (e.g. fur for a plush): {<toy id>: {fur: {...}}}, only for toys that exist.
     const looks=await readJSON(join(assets3d,'looks.json'),{});const L=Object.fromEntries(Object.entries(looks&&typeof looks==='object'?looks:{}).filter(([k,v])=>files.includes(k)&&v&&typeof v==='object'));
     return send(res,200,{toys:files,looks:L});}
    const m=u.pathname.match(/^\/book-3d\/([a-z0-9-]{1,40}\.glb)$/);if(!m)return send(res,404,{error:'Not found.'});
    try{const bytes=await readFile(join(assets3d,m[1]));res.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':bytes.length,'Cache-Control':'max-age=300'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Not found.'});else throw e;}
    return;
   }
   // Word cards for Dad to print and hide (one page, big letters) when today's quest needs words on paper.
   if(u.pathname==='/api/book/cards'&&req.method==='GET'){
    const player=u.searchParams.get('player');if(!kids.some(k=>k.id===player))return send(res,400,{error:'Choose a child.'});
    const {chapter:ch}=await latest(player,u.searchParams.get('date'));const cards=(ch?.quest?.cards||[]).filter(w=>/^[a-z' -]{1,20}$/i.test(w)).slice(0,6);
    const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Word cards</title><style>@page{size:letter;margin:.4in}body{font-family:"Nunito","Trebuchet MS",system-ui,sans-serif;margin:0;color:#2b2118}.tip{font-size:14px;margin:0 0 .2in}.cards{display:grid;grid-template-columns:1fr;gap:.25in}.card{border:3px dashed #b99a6a;border-radius:18px;height:2.9in;display:grid;place-items:center;font-weight:900;font-size:1.6in;letter-spacing:.04em}@media print{.tip button{display:none}}</style></head><body><p class="tip">${cards.length?`${e(ch.name)}'s quest: cut out ${cards.length===1?'this card':'these cards'} and hide ${cards.length===1?'it':'them'} around the house. <button onclick="print()">Print</button>`:'Today\'s chapter needs no word cards.'}</p><div class="cards">${cards.map(w=>`<div class="card">${e(w)}</div>`).join('')}</div></body></html>`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
   }
   if(u.pathname==='/api/book/notes'){
    if(req.method==='GET'){const since=localDate(now()-6*864e5,timeZone);return send(res,200,{today:today(),notes:(await notes()).filter(n=>n.date>=since)});}
    if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
    try{const input=await body(req);
     const result=await serial(async()=>{const all=await notes();
      if(input.remove){const next=all.filter(n=>n.id!==String(input.remove));await writeJSON(notesFile,{notes:next});return next;}
      const text=cleanNote(input.text);if(!text)throw Object.assign(Error('Write a short line.'),{status:400});
      const at=new Date(now()).toISOString(),note={id:at.replace(/\D/g,'').slice(0,17)+Math.random().toString(36).slice(2,6),date:today(),at,text,player:noteTarget(text,kids)};
      const next=[...all,note].slice(-200);await mkdir(data,{recursive:true});await writeJSON(notesFile,{notes:next});await log({type:'book_note',player:note.player||'both',length:text.length});return next;});
     const since=localDate(now()-6*864e5,timeZone);return send(res,200,{today:today(),notes:result.filter(n=>n.date>=since)});}
    catch(e){return send(res,e.status||500,{error:e.status?e.message:'Could not save.'});}
   }
   const clip=u.pathname.match(/^\/book-voice\/([a-f0-9]{16})\.(wav|m4a|webm)$/);
   if(clip&&req.method==='GET'){try{
    // The same clip at the shared loudness: .webm is the .wav as Opus 64 kb/s (a fifth of the bytes; .m4a AAC is also
    // possible but pads ~35 ms, so the book asks for Opus), .wav a levelled PCM copy; made once and kept in voice-aac/
    // (remade when the .wav is newer, e.g. a letter-sound re-render). Cannot make it? The original WAV bytes.
    let bytes=await aacOf(clip[1],clip[2]),type='audio/wav';
    if(bytes&&clip[2]!=='wav')type=clip[2]==='webm'?'audio/webm':'audio/mp4';
    if(!bytes)bytes=await readFile(join(bookDir,'voice',clip[1]+'.wav'));
    res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'max-age=31536000, immutable'});res.end(bytes);}catch(e){if(e.code==='ENOENT')send(res,404,{error:'Use device narration.'});else throw e;}return;}
   // Pictures: the household's own library (private, next to the chapters), else the generic one.
   const pic=bookArtMatch(u.pathname);
   if(pic&&req.method==='GET'){for(const dir of [(await localArt).directory,join(bookDir,'art','lib'),publicArt].filter(Boolean)){try{const bytes=await readFile(join(dir,pic[1]));res.writeHead(200,{'Content-Type':ART_TYPES[pic[2]],'Content-Length':bytes.length,'Cache-Control':'max-age=300'});res.end(bytes);return;}catch(e){if(e.code!=='ENOENT')throw e;}}
    send(res,404,{error:'No picture.'});return;}
   return false;
  },
  today,chapter,progress,notes,library,renderLine,recordQuest:(player,{date,index,result})=>update(player,{type:'result',date,page:index+1,result:{kind:'quest',misses:result.misses,hints:result.help?1:0,via:'tap'}})
 };
}
