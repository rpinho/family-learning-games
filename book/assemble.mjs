// The Book: turn the story JSON + plan + picture library into the chapter the hub plays.
// Every spoken line carries its voice (the narrator, Dad, each friend) and, after narration, its clip.
import {sayOf} from './lint.mjs';
import {normalizeScene,artFor} from '../hub/public/book-scene.mjs';
export const CHAPTER_SCHEMA='family-book-chapter-2';
// Fixed lines the player speaks (content prompts always speak).
export const UI_LINES={goal:'Goal!',saved:'Ooh, saved! Try again!',go:'Toot toot! Off we go!',fetch:'Fetch!',yes:'Yes!',tryAgain:'Try again.',great:'Great job!',noPrompt:'What do you say?',readIt:'Can you read it?',nextTime:'See you in the next chapter!',tapToGo:'Tap to turn the page.',
 // Listening (push-to-talk): gentle prompts, never a scolding.
 listenTap:'Tap the word and read it out loud!',sayLetter:'Tap the letter and say its sound!',listenNothing:"I didn't hear you. Tap and say it nice and loud!",listenAgain:'So close! Try once more.',listenEcho:'Now you say it!',askGrownUp:'Ask a grown-up to turn on the microphone.',
 traceIt:'Draw the big letter with your finger!',traced:'You drew it!'};
export const DEFAULT_VOICES={narrator:{voice:'af_heart',speed:0.95},dad:{voice:'am_michael',speed:0.95},mom:{voice:'af_sarah',speed:0.95}};
const FRIEND_VOICES=[{voice:'am_puck',speed:1},{voice:'af_bella',speed:1},{voice:'bm_fable',speed:1},{voice:'af_nova',speed:1.05}];
export function voicesFor(plan,{narrator}={}){
 const v={narrator:{...DEFAULT_VOICES.narrator,...(narrator||{})},dad:{...DEFAULT_VOICES.dad},mom:{...DEFAULT_VOICES.mom}};
 (plan.cast||[]).forEach((c,i)=>{v[c.id]=c.voice?{voice:c.voice,speed:Number(c.speed)||1}:FRIEND_VOICES[i%FRIEND_VOICES.length];});
 return v;
}
const clean=t=>String(t||'').trim().replace(/\s*[—–]\s*/g,', ').replace(/\s+/g,' ');
export function assemble(story,plan,{number=1,source='template',lint=[],generatedAt=new Date().toISOString(),dadLines=[],library,actors,voices}){
 const V=voices||voicesFor(plan),line=(who,text)=>{const w=V[who]?who:'narrator';return {who:w,text:clean(text),...V[w]};};
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
  if(p.beat&&beats[p.beat]){const b=beatLines(beats[p.beat],{N,line,plan});return {...base,kind:'beat',beat:b,...(b.kind==='kick-letter'?{carrierProp:'ball'}:b.kind==='count'?{carrierProp:b.thing}:b.kind==='share'?{carrierProp:'pizza'}:{})};}
  return base;
 });
 const art=artFor(pages,library);
 const first=pages[0];
 const cover={title:clean(story.title),line:N(`${plan.name}'s Book. Chapter ${number}. ${clean(story.title).replace(/[.!?]*$/,'.')}`),scene:first.scene};
 const ui=Object.fromEntries(Object.entries(UI_LINES).map(([k,t])=>[k,N(t)]));
 ui.numbers=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),N(String(i+1))]));
 return {schema:CHAPTER_SCHEMA,player:plan.player,name:plan.name,date:plan.date,number,title:cover.title,level:plan.level,cover,
  cast:(plan.cast||[]).map(c=>({id:c.id,name:c.name,emoji:c.emoji||'⭐'})),art,pages,ui,
  // The quest is always doable at home: hint pictures for a hunt, or word cards Dad prints and hides.
  quest:plan.quest?(q=>({...N(`A quest for you and ${plan.lead?.name||'Dad'}: ${q.text}`),...(q.hints?.length?{hints:q.hints.slice(0,7).map(h=>({word:h.word,emoji:h.emoji,line:N(h.text)}))}:{}),...(q.cards?.length?{cards:q.cards,dad:q.dad}:{})}))(typeof plan.quest==='string'?{text:plan.quest}:plan.quest):null,reward:plan.reward||null,
  summary:clean(story.summary),hook:clean(story.hook),
  meta:{generatedAt,source,lint,sceneNotes:notes,practises:plan.beats.map(b=>`${b.kind}: ${b.what}`),magic:plan.magic,dadLines,themes:(plan.themes||[]).map(t=>t.id||t.seed),yesterday:plan.yesterday}};
}
// The spoken lines of each beat, in the right voices. The words the child must find are never spoken first.
function beatLines(b,{N,line,plan}){
 const who=b.who&&plan.cast.some(c=>c.id===b.who)?b.who:'narrator';
 switch(b.kind){
  case 'teach-letter':return {...b,lines:b.lines.map(([w,t])=>line(w,t)),tap:N(b.tap)};
  case 'kick-letter':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(b.done),tap:N(`${b.letter}! ${b.sound}!`)};
  case 'stones':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(b.done),tap:N(`${b.letter}! ${b.sound}!`)};
  case 'order':return {...b,spoken:N(b.spoken),done:N(b.done)};
  case 'count':return {...b,spoken:N(b.spoken),ask:N(b.ask),done:N(`Yes! ${b.answer} ${b.things}!`)};
  case 'signs':return {...b,spoken:N(b.spoken),notIt:N(b.notIt),done:N(`Yes! It says ${b.target}!`)};
  case 'spell':return {...b,spoken:N(b.spoken),done:N(b.sentence)};
  case 'share':return {...b,spoken:N(b.spoken),ask:N(b.ask),done:N(`Yes! ${b.answer} slices on each plate. Fair for everyone!`)};
  case 'score':return {...b,spoken:N(b.spoken),done:N(`Yes! ${b.answer} points!`)};
  case 'no':return {...b,claim:line(who,b.claim),ask:line(who,b.ask),ifYes:line(who,b.ifYes),caught:N(b.caught),fixSpoken:N(b.fixSpoken),hint:N(b.hint)};
 }
 return b;
}
// Every line to narrate: [{text, voice, speed}] (deduplicated by voice + speed + text).
export function speechLines(ch){
 const out=new Map();const add=l=>{if(l&&l.text&&l.voice)out.set(`${l.voice}|${l.speed}|${l.text}`,{text:l.text,voice:l.voice,speed:l.speed});};
 // A line may carry nested lines (the quest carries its hint lines).
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(typeof v.text==='string'&&v.voice)add(v);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch.cover);walk(ch.pages);walk(ch.ui);walk(ch.quest);
 return [...out.values()];
}
// Attach narration clips: clips maps "voice|speed|text" to a file name.
export function attachClips(ch,clips){
 const walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(walk);if(typeof v.text==='string'&&v.voice){const f=clips[`${v.voice}|${v.speed}|${v.text}`];if(f)v.clip=f;}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};
 walk(ch.cover);walk(ch.pages);walk(ch.ui);walk(ch.quest);return ch;
}
// A short plain-text summary for grown-ups (what he will practise, the lines in order).
export function markdown(ch){
 const out=[`# ${ch.title}`,'',`*${ch.name}'s Book, chapter ${ch.number} · ${ch.date}*`,''];
 for(const p of ch.pages){out.push(`**[${p.scene.bg}${p.scene.actors.length?' · '+p.scene.actors.map(a=>a.id+(a.pose!=='idle'?':'+a.pose:'')).join(', '):''}]**${p.caption?` _${p.caption}_`:''}`);
  for(const l of p.say)out.push(`- ${l.who}: ${l.text}`);
  if(p.magic)out.push(`- MAGIC WORD on ${p.magic.object}: **${p.magic.word}**`,...p.magic.after.map(l=>`  - ${l.who}: ${l.text}`));
  if(p.beat)out.push(`- BEAT (${p.beat.kind}): ${p.beat.what}`);out.push('');}
 if(ch.quest)out.push(`**Quest:** ${ch.quest.text}`,...(ch.quest.hints?.length?[`Hints (one at a time): ${ch.quest.hints.map(h=>h.word).join(', ')}`]:[]),...(ch.quest.cards?.length?[`Word cards for Dad to hide: ${ch.quest.cards.join(', ')}`]:[]),'');
 return out.join('\n');
}
