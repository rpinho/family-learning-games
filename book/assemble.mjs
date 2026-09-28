// The Book: turn the story JSON + plan + picture library into the chapter the hub plays.
// Every spoken line carries its voice (the narrator, Dad, each friend) and, after narration, its clip.
import {sayOf} from './lint.mjs';
import {normalizeScene,artFor,MAX_ACTORS} from '../hub/public/book-scene.mjs';
import {phonemize} from '../hub/public/pronounce.mjs';
import {resolveVoice} from './paths.mjs';
export const CHAPTER_SCHEMA='family-book-chapter-2';
// Fixed lines the player speaks (content prompts always speak).
export const UI_LINES={goal:'Goal!',saved:'Ooh, saved! Try again!',go:'Toot! Off we go!',fetch:'Fetch!',yes:'Yes!',tryAgain:'Try again.',great:'Great job!',noPrompt:'What do you say?',readIt:'Can you read it?',nextTime:'See you in the next chapter!',tapToGo:'Tap to turn the page.',
 // Listening (push-to-talk): gentle prompts, never a scolding.
 listenTap:'Tap the word and read it out loud!',sayLetter:'Tap the letter and say its sound!',listenNothing:"I didn't hear you. Tap and say it nice and loud!",listenAgain:'So close! Try once more.',listenEcho:'Now you say it!',askGrownUp:'Ask a grown-up to turn on the microphone.',
 traceIt:'Draw the big letter with your finger!',traced:'You drew it!'};
export const DEFAULT_VOICES={narrator:{voice:'af_heart',speed:0.95},dad:{voice:'am_michael',speed:0.95},mom:{voice:'af_sarah',speed:0.95}};
const FRIEND_VOICES=[{voice:'am_puck',speed:1},{voice:'af_bella',speed:1},{voice:'bm_fable',speed:1},{voice:'af_nova',speed:1.05}];
export function voicesFor(plan,{narrator,named={}}={}){
 const v={narrator:{...DEFAULT_VOICES.narrator,...(narrator||{})},dad:{...DEFAULT_VOICES.dad,voiceRole:'rook',...(named.rook?{voice:named.rook}:{})},mom:{...DEFAULT_VOICES.mom}};
 (plan.cast||[]).forEach((c,i)=>{v[c.id]={...resolveVoice(c.voice?{voice:c.voice,speed:Number(c.speed)||1}:FRIEND_VOICES[i%FRIEND_VOICES.length],named),voiceRole:c.id};});
 return v;
}
const clean=t=>String(t||'').trim().replace(/\s*[—–]\s*/g,', ').replace(/\s+/g,' ');
// Who a line names: every friend, grown-up and the sibling by the words the story uses for them ("Pika",
// "Pikachu with Hat", "George", "Mom"/"Mommy"). A first or last name word counts only when no one else has it.
export function nameForms(plan){
 const people=[...(plan.cast||[]).map(c=>({id:c.id,names:[c.name,...(c.alsoCalled||[])]})),...(plan.grownups||[]).map(g=>({id:g.id,names:[g.name,...(g.alsoCalled||[])]})),
  ...(plan.sibling?[{id:String(plan.sibling).toLowerCase(),names:[plan.sibling]}]:[])];
 const GENERIC=new Set(['the','big','little','with','hat','captain','mr','mrs']),words=new Map();
 for(const p of people)for(const n of p.names)for(const w of String(n).replace(/^the\s+/i,'').split(/\s+/))if(!GENERIC.has(w.toLowerCase())){const k=w.toLowerCase();words.set(k,(words.get(k)||new Set()).add(p.id));}
 return people.map(p=>({id:p.id,forms:[...new Set(p.names.flatMap(n=>{const core=String(n).replace(/^the\s+/i,'');const ws=core.split(/\s+/).filter(w=>!GENERIC.has(w.toLowerCase())&&words.get(w.toLowerCase())?.size===1);return [core,...ws];}))]}));
}
export function mentions(text,forms){const t=String(text).replace(/\[\[[^\]]*\]\]/g,' ');return forms.filter(f=>f.forms.some(n=>new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}s?\\b`,'i').test(t))).map(f=>f.id);}
const WORDN=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
const cap=w=>String(w)[0].toUpperCase()+String(w).slice(1);
export function assemble(story,plan,{number=1,source='template',lint=[],generatedAt=new Date().toISOString(),dadLines=[],library,actors,voices,pronounce={}}){
 // Every spoken line goes to the voice through the one pronunciation map (names as phonemes, never guessed).
 const V=voices||voicesFor(plan),line=(who,text)=>{const w=V[who]?who:'narrator',t=clean(text),s=phonemize(t,pronounce);return {who:w,text:s,...(s!==t?{shown:t}:{}),...V[w]};};
 const forms=nameForms(plan),inPicture=id=>library.actors?.[id]&&(!actors||actors.includes(id));
 const N=t=>line('narrator',t);
 const beats=Object.fromEntries(plan.beats.map(b=>[b.id,b]));
 const notes=[];let lastBg=null;
 const pages=story.pages.map((p,i)=>{
  const {scene,notes:n}=normalizeScene(p,library,{allowed:actors,fallbackBg:lastBg});notes.push(...n.map(x=>`page ${i+1}: ${x}`));lastBg=scene.bg;
  const base={id:`p${i+1}`,kind:'story',scene,caption:clean(p.caption).slice(0,60),say:sayOf(p).map(l=>line(l.who,l.text)).filter(l=>l.text)};
  if(p.magic&&plan.magic.includes(String(p.magic.word).toLowerCase())){const w=String(p.magic.word).toLowerCase();
   base.magic={word:w,object:clean(p.magic.object).slice(0,60),read:N(`${w[0].toUpperCase()+w.slice(1)}!`),after:sayOf({say:p.magic.after||[]}).map(l=>line(l.who,l.text))};}
  if(p.action&&plan.actions?.[p.action]&&!p.beat){const fetcher=String(p.fetcher||'').toLowerCase();
   base.action={kind:p.action,after:sayOf({say:p.after||[]}).map(l=>line(l.who,l.text)).filter(l=>l.text),...(p.action==='throw'&&(plan.cast||[]).some(c=>c.id===fetcher)?{fetcher}:{})};
   if(p.action==='kick'||p.action==='throw')base.carrierProp='ball';if(p.action==='drive'&&!scene.props.some(x=>x.id==='train')&&library.props.train)scene.props.push({id:'train',n:1});}
  // Anyone the page names or lets speak is in its picture (the hero is always welcome; nobody is announced and
  // then missing). Friends nobody mentions make room first when the picture is full.
  {const txt=[...sayOf(p),...sayOf({say:p.after||[]}),...sayOf({say:p.magic?.after||[]})],need=[...new Set([...txt.map(l=>l.who),...txt.flatMap(l=>mentions(l.text,forms))])].filter(id=>id!=='narrator'&&inPicture(id));
   for(const id of need)if(!scene.actors.some(a=>a.id===id))scene.actors.push({id,pose:library.actors[id].poses.idle?'idle':Object.keys(library.actors[id].poses)[0]});
   while(scene.actors.length>MAX_ACTORS){const i=scene.actors.findLastIndex(a=>!need.includes(a.id)&&a.id!==(plan.actorIds?.hero||plan.player));if(i<0)break;scene.actors.splice(i,1);}}
  if(p.beat&&beats[p.beat]){const b=beatLines(beats[p.beat],{N,line,plan});return {...base,kind:'beat',beat:b,...(b.kind==='kick-letter'?{carrierProp:'ball'}:b.kind==='count'?{carrierProp:b.thing}:b.kind==='share'?{carrierProp:'pizza'}:{})};}
  return base;
 });
 const art=artFor(pages,library);
 const first=pages[0];
 const bookWord=plan.theme==='spellbook'?'Spellbook':'Book';
 const cover={title:clean(story.title),line:N(`${plan.name}'s ${bookWord}. Chapter ${number}. ${clean(story.title).replace(/[.!?]*$/,'.')}`),scene:first.scene};
 const ui=Object.fromEntries(Object.entries(UI_LINES).map(([k,t])=>[k,N(t)]));
 ui.numbers=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),N(String(i+1))]));
 return {schema:CHAPTER_SCHEMA,player:plan.player,name:plan.name,date:plan.date,number,title:cover.title,level:plan.level,cover,
  cast:(plan.cast||[]).map(c=>({id:c.id,name:c.name,emoji:c.emoji||'⭐'})),art,pages,ui,
  ...(plan.level==='early'&&plan.letter?{letter:plan.letter}:{}),
  // The key ring (a letters book with a key goal): what he has, how many to find, and what the keys open, said once at
  // the start of every chapter.
  ...(plan.keyArc?{keyring:{goal:plan.keyArc.goal,have:plan.keyArc.have,letter:plan.keyArc.letter},
   keysLine:N(plan.keyArc.finale?`This is the last key! ${cap(WORDN[plan.keyArc.goal]||String(plan.keyArc.goal))} keys for ${WORDN[plan.keyArc.goal]||plan.keyArc.goal} hiding places, and today is Dad's birthday party!`
    :`Every golden key opens a hiding place with your secret presents for Dad. You have ${WORDN[plan.keyArc.have.length]||plan.keyArc.have.length} of ${WORDN[plan.keyArc.goal]||plan.keyArc.goal} keys.`)}:{}),...(plan.theme?{theme:plan.theme}:{}),...(plan.style&&plan.style!=='classic'?{style:plan.style}:{}),...(plan.keyStyle?{keyStyle:plan.keyStyle}:{}),
  // The quest is always doable at home: hint pictures for a hunt, or word cards Dad prints and hides.
  quest:plan.quest?(q=>({...N(`A quest for you and ${plan.lead?.name||'Dad'}: ${q.text}`),...(q.hints?.length?{hints:q.hints.slice(0,7).map(h=>({word:h.word,emoji:h.emoji,line:N(h.text)}))}:{}),...(q.cards?.length?{cards:q.cards,dad:q.dad}:{})}))(typeof plan.quest==='string'?{text:plan.quest}:plan.quest):null,reward:plan.reward||null,
  summary:clean(story.summary),hook:clean(story.hook),
  meta:{generatedAt,source,lint,sceneNotes:notes,practises:plan.beats.map(b=>`${b.kind}: ${b.what}`),magic:plan.magic,dadLines,themes:(plan.themes||[]).map(t=>t.id||t.seed),details:(plan.details||[]).map(d=>d.id),yesterday:plan.yesterday}};
}
// A decodable word sounded out slowly (c-a-t, cat), in the narrator's voice.
const soundLines=(sounds,N)=>Object.fromEntries(Object.entries(sounds).map(([w,t])=>[w,N(t)]));
// The spoken lines of each beat, in the right voices. The words the child must find are never spoken first.
function beatLines(b,{N,line,plan}){
 const who=b.who&&plan.cast.some(c=>c.id===b.who)?b.who:'narrator';
 switch(b.kind){
  case 'teach-letter':return {...b,lines:b.lines.map(([w,t])=>line(w,t)),tap:N(b.tap)};
  case 'kick-letter':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(b.done),tap:N(`${b.sound}!`)};
  case 'stones':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(b.done),tap:N(`${b.sound}!`)};
  case 'order':return {...b,spoken:N(b.spoken),done:N(b.done)};
  case 'count':return {...b,spoken:N(b.spoken),ask:N(b.ask),done:N(`Yes! ${b.answer} ${b.things}!`)};
  case 'signs':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(`Yes! It says ${b.target}!`),...(b.sounds?{sounds:soundLines(b.sounds,N)}:{})};
  case 'spell':return {...b,spoken:N(b.spoken),done:N(b.sentence),...(b.sounds?{sounds:soundLines(b.sounds,N)}:{})};
  case 'share':return {...b,spoken:N(b.spoken),ask:N(b.ask),done:N(`Yes! ${b.answer} slices on each plate. Fair for everyone!`)};
  case 'score':return {...b,spoken:N(b.spoken),done:N(`Yes! ${b.answer} points!`)};
  case 'puzzle':return {...b,spoken:N(b.spoken),hint:N(b.hint),done:N(b.done)};
  case 'remainder':return {...b,spoken:N(b.spoken),ask:N(b.ask),done:N(b.done)};
  case 'fork':return {...b,spoken:N(b.spoken),options:b.options.map(o=>({...o,reply:N(o.reply),got:N(`${o.item.name[0].toUpperCase()+o.item.name.slice(1)} for your spellbook!`)}))};
  case 'no':return {...b,claim:line(who,b.claim),ask:line(who,b.ask),ifYes:line(who,b.ifYes),caught:N(b.caught),fixSpoken:N(b.fixSpoken),hint:N(b.hint)};
 }
 return b;
}
// Every line to narrate: [{text, voice, speed}] (deduplicated by voice + speed + text).
export function speechLines(ch){
 const out=new Map();const add=l=>{if(l&&l.text&&l.voice)out.set(`${l.voice}|${l.speed}|${l.text}`,{text:l.text,voice:l.voice,speed:l.speed});};
 // A line may carry nested lines (the quest carries its hint lines).
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(typeof v.text==='string'&&v.voice)add(v);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch.cover);walk(ch.pages);walk(ch.ui);walk(ch.quest);walk(ch.keysLine);
 return [...out.values()];
}
// Read-time voice selection also applies to already-written chapters, without
// rewriting their story or progress. Legacy Dad lines used the stock Rook voice.
// An explicitly different Dad voice (and every other actor) stays independent.
export function setRookVoice(ch,voice='am_michael'){
 const changed=[];
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);
  if(v.text&&v.voice&&(v.voiceRole==='rook'||(['dad','rook'].includes(v.who)&&(v.voice==='am_michael'||v.voice.startsWith('local:rook-'))))&&v.voice!==voice){v.voice=voice;delete v.clip;changed.push(v);}
  for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch);return changed;
}
// The cast is the voice source of truth for old chapters as well as new ones.
// Resolve only configured actors; keep the narrator and unrelated roles intact.
// A hunt's friend can supply the role for legacy lines that have no `who` field.
export function setCharacterVoices(ch,cast={},fallbackRole=null){
 const changed=setRookVoice(ch,cast.voices?.rook||'am_michael');
 const byId=new Map((cast.cast||[]).filter(c=>c.id&&c.voice&&c.refreshVoice===true).map(c=>[c.id,resolveVoice({voice:c.voice,speed:Number(c.speed)||1},cast.voices||{})]));
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);
  if(typeof v.text==='string'&&v.voice){const role=v.voiceRole||v.who||fallbackRole,desired=byId.get(role);
   if(desired&&(v.voice!==desired.voice||Number(v.speed)!==desired.speed)){v.voice=desired.voice;v.speed=desired.speed;delete v.clip;changed.push(v);}}
  for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch);return changed;
}
// Attach narration clips: clips maps "voice|speed|text" to a file name.
export function attachClips(ch,clips){
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(typeof v.text==='string'&&v.voice){const f=clips[`${v.voice}|${v.speed}|${v.text}`];if(f)v.clip=f;}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch.cover);walk(ch.pages);walk(ch.ui);walk(ch.quest);walk(ch.keysLine);return ch;
}
// A short plain-text summary for grown-ups (what he will practise, the lines in order).
export function markdown(ch){
 const out=[`# ${ch.title}`,'',`*${ch.name}'s Book, chapter ${ch.number} · ${ch.date}*`,''];
 for(const p of ch.pages){out.push(`**[${p.scene.bg}${p.scene.actors.length?' · '+p.scene.actors.map(a=>a.id+(a.pose!=='idle'?':'+a.pose:'')).join(', '):''}]**${p.caption?` _${p.caption}_`:''}`);
  for(const l of p.say)out.push(`- ${l.who}: ${l.shown||l.text}`);
  if(p.magic)out.push(`- MAGIC WORD on ${p.magic.object}: **${p.magic.word}**`,...p.magic.after.map(l=>`  - ${l.who}: ${l.shown||l.text}`));
  if(p.beat)out.push(`- BEAT (${p.beat.kind}): ${p.beat.what}`);out.push('');}
 if(ch.quest)out.push(`**Quest:** ${ch.quest.text}`,...(ch.quest.hints?.length?[`Hints (one at a time): ${ch.quest.hints.map(h=>h.word).join(', ')}`]:[]),...(ch.quest.cards?.length?[`Word cards for Dad to hide: ${ch.quest.cards.join(', ')}`]:[]),'');
 return out.join('\n');
}
