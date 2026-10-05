// right answer and the run continues. Content follows Letter Quest (read-only `literacyFrom`), like word breaks.
// Pure module: used by the server engine (gate generation, checking) and the browser (lines, recap).
import {FIRST_WORDS,WORD_GROUPS,SENTENCE_DISTRACT,literacyFrom,DEFAULT_TRACK,CVC_WORDS,CVC_FAMILIES,CVC_TARGETS,cvcDistractors,PICTURE_NAMES} from './word-break.mjs';
export {CVC_WORDS,CVC_FAMILIES,CVC_TARGETS,cvcDistractors};
export const SLALOM_GATES=8;
export const SLALOM_LINES={
 howLetters:'Take your time. Slide your finger to steer, and ski through the gate with the right letter.',
 howWords:'Take your time. Slide your finger to steer, and ski through the gate with the right word.',
 recapLetters:'What a lovely run! Here are your letters.',
 recapTricky:"What a lovely run! Let's look at the tricky ones.",
 recapAllRead:'What a lovely run! You read every word.',
 warmup:"Let's meet today's words.",
 warmupGo:"When you are ready, off we glide."
};
const LQ_ORDER='FRANCISOETLHDMBPUKGWYVZXJQ';
// Look-alike letters (same table as the shared word break), so the child has to look, not guess.
const LOOKALIKE={b:'dpq',d:'bpq',p:'qbd',q:'pgd',m:'nw',n:'mhu',u:'nv',w:'mv',v:'wy',i:'lj',l:'it',t:'lf',e:'ca',c:'eo',a:'od',o:'ac',g:'qj',h:'nb',j:'ig',k:'hx',f:'tl',r:'nv',s:'zc',x:'kz',y:'vg',z:'sx',
 E:'FLB',F:'EPT',L:'ITJ',M:'NWH',N:'MZH',O:'QCD',P:'RBF',R:'PBK',B:'PRD',C:'OGQ',G:'COQ',W:'MVN',V:'WYU',U:'VJO',I:'LTJ',T:'ILF',K:'XRH',X:'KYZ',Y:'VXT',Z:'NSX',S:'ZGC',D:'OBP',H:'NAK',A:'HVR',J:'LUI',Q:'OGC'};
export function rng(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
function shuffled(a,r){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const cap=w=>w[0].toUpperCase()+w.slice(1);
const upper=c=>c.toUpperCase();
// Spoken lines per gate kind. `correction` is said when the child skis through another gate (content, always
// spoken); `recap` is the short line said for this gate at the bottom of the hill.
// or "It's F." on a miss. Measured budget and test: lib/slalom-timing.mjs, tests/slalom-timing.test.mjs.
export const praiseLetter=(c,lower)=>lower?`Little ${c.toLowerCase()}!`:`${c.toUpperCase()}!`;
export const missLetter=(c,lower)=>lower?`Little ${c.toLowerCase()}!`:`It's ${c.toUpperCase()}.`;
export const praiseWord=w=>`${w}!`,missWord=w=>`It's ${w}.`;
function letterLines(target,lower){return lower?{prompt:`Find the little letter ${upper(target)}.`,praise:praiseLetter(target,true),correction:missLetter(target,true),recap:`Little letter ${upper(target)}.`}:{prompt:`Find the letter ${target}.`,praise:praiseLetter(target,false),correction:missLetter(target,false),recap:`Letter ${target}.`};}
const firstLine=(word,letter)=>`${cap(word)} starts with ${letter}.`;
const wordLines=w=>({prompt:`Find the word ${w}.`,praise:praiseWord(w),correction:missWord(w),recap:`${w}.`});
// Letter options: the answer, its look-alikes first, then letters the child already knows.
function letterOptions(answer,n,known,r){
 const lower=/^[a-z]$/.test(answer),near=[...(LOOKALIKE[answer]||'')].filter(c=>c!==answer);
 const pool=lower?[...'abcdefghijklmnopqrstuvwxyz']:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
 const knownSame=known.filter(c=>c!==answer&&/^[a-z]$/.test(c)===lower&&!near.includes(c));
 const rest=pool.filter(c=>c!==answer&&!near.includes(c)&&!knownSame.includes(c));
 return [answer,...[...shuffled(near,r),...shuffled(knownSame,r),...shuffled(rest,r)].slice(0,n-1)];
}
function letterGate(level,r,n,avoid){
 const upperKnown=level.letters.length?level.letters:[...LQ_ORDER.slice(0,8)],known=[...upperKnown,...level.lower];
 if(r()<.4){
  const have=new Set(upperKnown.map(c=>c.toLowerCase()));
  const seen=new Set([...avoid].map(c=>String(c).toLowerCase())),words=FIRST_WORDS.filter(([w])=>have.has(w[0])&&!seen.has(w[0]));
  if(words.length){const [word,picture]=pick(words,r),answer=upper(word[0]),line=firstLine(word,answer);
   return {kind:'first-letter',track:'letters',word,picture,answer,prompt:`Which letter does ${word} start with?`,praise:praiseLetter(answer,false),correction:missLetter(answer,false),recap:line,options:letterOptions(answer,n,upperKnown,r)};}
 }
 const focus=r()<.65&&level.learning.length?level.learning:known;
 const seen=new Set([...avoid].map(c=>String(c).toLowerCase())),fresh=focus.filter(c=>!seen.has(c.toLowerCase())),target=pick(fresh.length?fresh:focus,r),lower=/^[a-z]$/.test(target);
 return {kind:'find-letter',track:'letters',answer:target,...letterLines(target,lower),options:letterOptions(target,n,known,r)};
}
// A word's look-alikes: its WORD_GROUPS family first, then the sentence look-alike tile.
export function lookalikes(word){
 const w=word.toLowerCase(),out=[];
 for(const g of WORD_GROUPS.flat())if(g.includes(w))out.push(...g.filter(x=>x!==w));
 if(SENTENCE_DISTRACT[w])out.push(SENTENCE_DISTRACT[w]);
 for(const [k,v] of Object.entries(SENTENCE_DISTRACT))if(v===w)out.push(k);
 return [...new Set(out)].filter(x=>x!==w);
}
// Words track = CVC words only (see CVC_WORDS in the shared word-break module): look-alikes share the first letter
// and differ only in the vowel or the last letter (mat / map / man).
export const soundOutLine=w=>`Sound out ${w}.`;
// Letters with a recorded sound (scripts/import-letter-sounds.py). Only words made of these are ever sounded out.
export const SOUND_LETTERS='abcdefghimnoprstu';
export const canSoundOut=w=>[...w].every(c=>SOUND_LETTERS.includes(c));
// Teach before testing: the run's 3-4 target words come from ONE family (at, an, ig, op, ug, in) and are introduced
// before the first gate (picture, slow sound-out, whole word). Gate look-alikes still share the first letter and differ
// in the vowel or the last letter (mat / map / mit), so the child reads past the first letter.
// Pictures: the shared allowlist (PICTURE_NAMES) plus these reviewed ones; a word with no clear picture shows its card only.
export const FAMILY_PICTURES={'👒':'hat','👨':'man','📌':'pin','🐛':'bug','🫂':'hug'};
const PICTURE_OF={};for(const [e,w] of [...Object.entries(PICTURE_NAMES),...Object.entries(FAMILY_PICTURES)])PICTURE_OF[w]??=e;
export const wordPicture=w=>PICTURE_OF[w]||null;
export const familyWords=f=>CVC_TARGETS.filter(w=>w.slice(1)===f&&canSoundOut(w));
export const SLALOM_FAMILIES=CVC_FAMILIES.filter(f=>familyWords(f).length>=3);
// The family for the next run: the same one again when the last run was hard (easy), otherwise the next in order.
export function pickFamily(wordRuns=[],easy=false){
 const last=[...wordRuns].reverse().find(r=>SLALOM_FAMILIES.includes(r?.family))?.family;
 if(!last)return SLALOM_FAMILIES[0];
 return easy?last:SLALOM_FAMILIES[(SLALOM_FAMILIES.indexOf(last)+1)%SLALOM_FAMILIES.length];
}
// 3 targets on an easy run, else 4: words with a picture first, then the ones he has missed most (tallies), then the rest.
export function familyTargets(family,{n=4,tallies={},seed=1}={}){
 const r=rng(seed*104729+7),words=shuffled(familyWords(family),r),miss=w=>(tallies[w]?.errors||0)-(tallies[w]?.hits||0);
 return words.map((w,k)=>[w,k]).sort((x,y)=>(!!wordPicture(y[0])-!!wordPicture(x[0]))||(miss(y[0])-miss(x[0]))||(x[1]-y[1])).slice(0,n).map(x=>x[0]);
}
function familyGate(answer,family,r,n){
 const near=cvcDistractors(answer),last=near.filter(w=>w[1]===answer[1]),vowel=near.filter(w=>w[1]!==answer[1]);
 // one last-letter look-alike and one vowel look-alike when there is room for both
 const picks=n>=3&&last.length&&vowel.length?[pick(last,r),pick(vowel,r)]:shuffled(near,r).slice(0,n-1),picture=wordPicture(answer);
 return {kind:'read-word',track:'words',family,answer,...(picture?{picture}:{}),...wordLines(answer),recapSoundOut:soundOutLine(answer),supportPrompt:soundOutLine(answer),options:[answer,...picks]};
}
// Row order: every target twice (or three times), never the same word twice in a row.
function targetOrder(targets,count,r){
 for(let tries=0;tries<50;tries++){const bag=shuffled(Array.from({length:count},(_,i)=>targets[i%targets.length]),r);if(bag.every((w,i)=>i===0||w!==bag[i-1]))return bag;}
 return Array.from({length:count},(_,i)=>targets[i%targets.length]);
}
// four pairs on an easy run (after a hard one). The answer never sits in the same lane three times running.
export function slalomRun(levelIn,{seed=1,count=SLALOM_GATES,family,targets,easy=false}={}){
 const level={...literacyFrom(null),...levelIn},r=rng(seed*7919+13),gates=[],recent=[];
 const fam=SLALOM_FAMILIES.includes(family)?family:SLALOM_FAMILIES[Math.abs(seed)%SLALOM_FAMILIES.length];
 const words=targets?.length?targets:familyTargets(fam,{n:easy?3:4,seed}),order=targetOrder(words,count,r);let wi=0;
 for(let i=0;i<count;i++){
  const track=level.track==='mixed'?(i%2?'words':'letters'):level.track;
  const pairs=track==='letters'||easy?4:2,n=i<pairs?2:3,avoid=new Set(recent.slice(-4));
  let g=track==='letters'?letterGate(level,r,n,avoid):familyGate(order[wi++],fam,r,n);
  let options=shuffled(g.options,r);
  const lane=options.indexOf(g.answer),prev=gates.slice(-2).map(x=>x.lane);
  if(prev.length===2&&prev.every(x=>x===lane)&&options.length>1){const j=(lane+1)%options.length;[options[lane],options[j]]=[options[j],options[lane]];}
  g={...g,options,lane:options.indexOf(g.answer),game:'slalom',gate:i};recent.push(g.answer);gates.push(g);
 }
 return gates;
}
// After a missed gate, the next triplet becomes a pair (the answer and its closest look-alike stay).
export function easeGate(g){
 if(!g||g.options.length<3)return g;
 const drop=g.options.map((o,i)=>[o,i]).filter(([o])=>o!==g.answer).at(-1)[1];
 const options=g.options.filter((_,i)=>i!==drop);return {...g,options,lane:options.indexOf(g.answer),eased:true};
}
// Adapt inside the run: after two misses in a row on the words track, every row left becomes a pair, its question is
// the sound-out ("m... a... t... mat") and the rider cruises slower (COURSE.supportSpeed). Pure, shared by the
// server and the browser so both hold the same rows.
export const SUPPORT_AFTER=2;
export function supportGate(g){if(!g)return g;const e=easeGate(g);return g.track==='words'?{...e,support:true,prompt:g.supportPrompt||g.prompt}:e;}
export function afterGate(gates,i,ok,{support=false,missRun=0}={}){
 const out=[...gates],run=ok?0:missRun+1,g=out[i];
 if(!support&&g?.track==='words'&&run>=SUPPORT_AFTER){for(let k=i+1;k<out.length;k++)out[k]=supportGate(out[k]);return {gates:out,support:true,missRun:run,started:true};}
 if(!ok&&out[i+1])out[i+1]=support?supportGate(out[i+1]):easeGate(out[i+1]);
 return {gates:out,support,missRun:run,started:false};
}
// The next run starts easier (same family, 3 words, four pairs) when more than 40% of the last 8 word rows were missed.
export const easyNext=(rows=[])=>{const last=(Array.isArray(rows)?rows:[]).slice(-8);return last.length>=4&&last.filter(Boolean).length/last.length>0.4;};
// until the last two word runs were read over 70% on his own (no glow), then words. `ready` offers words.
export function slalomChoice(id,slalom={},defaultTrack=DEFAULT_TRACK[id]||'mixed'){
 const runs=(Array.isArray(slalom?.wordRuns)?slalom.wordRuns:[]).filter(r=>r?.rows>=SLALOM_GATES).slice(-2);
 const rows=runs.reduce((a,r)=>a+r.rows,0),read=runs.reduce((a,r)=>a+(r.read||0),0),ready=runs.length===2&&read/rows>0.7;
 if(defaultTrack==='letters')return {toggle:false,track:'letters',ready:false,accuracy:null};
 return {toggle:true,track:['letters','words'].includes(slalom?.track)?slalom.track:ready?'words':'letters',ready,accuracy:rows?+(read/rows).toFixed(2):null};
}
// Missed words (a wrong gate or the glow), once each, in run order: the recap replays only these.
export function trickyWords(gates,outcomes){const out=[];gates.forEach((g,k)=>{const o=outcomes[k];if(g?.track==='words'&&o&&(!o.ok||o.hinted)&&!out.includes(g.answer))out.push(g.answer);});return out;}
// The finish still displays every gate. Speak only a few distinct letters that need review,
// prioritising wrong answers over passes that needed the glow.
export function trickyLetters(gates,outcomes,limit=3){
 const chosen=[],seen=new Set();
 for(const predicate of [o=>!o.ok,o=>o.hinted]){
  gates.forEach((g,k)=>{
   const o=outcomes[k],answer=g?.answer;
   if(g?.track!=='letters'||!o||!predicate(o)||seen.has(answer)||chosen.length>=limit)return;
   seen.add(answer);chosen.push(k);
  });
 }
 return chosen;
}
// The word break after the finish line: a word from the SAME family (a missed one first), against one family
// neighbour and one same-first-letter look-alike (mat: cat, map).
export function familyBreakItem(family,{tricky=[],targets=[],r=Math.random}={}){
 const fam=familyWords(family);if(!fam.length)return null;
 const answer=tricky.find(w=>fam.includes(w))||pick(targets.filter(w=>fam.includes(w)).length?targets.filter(w=>fam.includes(w)):fam,r);
 const neighbour=pick(fam.filter(w=>w!==answer),r),look=cvcDistractors(answer).filter(w=>w!==neighbour);
 return {kind:'read-word',cvc:true,track:'words',family,spoken:`Find the word ${answer}.`,answer,options:shuffled([answer,neighbour,...(look.length?[pick(look,r)]:[])],r)};
}
export const slalomTrack=(id,level)=>level?.track||DEFAULT_TRACK[id]||'mixed';
// Every line a run can say (for the voice build and its tests).
export function slalomLines(){
 const lines=new Set(Object.values(SLALOM_LINES));
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){for(const l of [false,true])for(const v of Object.values(letterLines(l?c.toLowerCase():c,l)))lines.add(v);}
 for(const [w] of FIRST_WORDS){lines.add(`Which letter does ${w} start with?`);lines.add(firstLine(w,upper(w[0])));}
 for(const w of CVC_TARGETS){for(const v of Object.values(wordLines(w)))lines.add(v);if(canSoundOut(w))lines.add(soundOutLine(w));}
 return [...lines];
}
