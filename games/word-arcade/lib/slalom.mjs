// Letter Slalom: a short, calm downhill run. Each gate row carries two or three letters (Beginner) or words
// (Explorer); the child skis through the one they hear. No score, no fail state: a missed gate names the
// right answer and the run continues. Content follows Letter Quest (read-only `literacyFrom`), like word breaks.
// Pure module: used by the server engine (gate generation, checking) and the browser (lines, recap).
import {FIRST_WORDS,WORD_GROUPS,SENTENCES,STARTER_SENTENCES,SENTENCE_DISTRACT,tilesOf,literacyFrom,DEFAULT_TRACK,CVC_WORDS,CVC_FAMILIES,CVC_TARGETS,cvcDistractors} from './word-break.mjs';
export {CVC_WORDS,CVC_FAMILIES,CVC_TARGETS,cvcDistractors};
export const SLALOM_GATES=8;
export const SLALOM_LINES={
 howLetters:'Slide your finger to steer. Ski through the gate with the right letter.',
 howWords:'Slide your finger to steer. Ski through the gate with the right word.',
 recapLetters:'What a lovely run! Here are your letters.',
 recapWords:'What a lovely run! Here are your words.'
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
function letterLines(target,lower){return lower?{prompt:`Find the little letter ${upper(target)}.`,correction:`The little letter ${upper(target)}.`,recap:`Little letter ${upper(target)}.`}:{prompt:`Find the letter ${target}.`,correction:`The letter ${target}.`,recap:`Letter ${target}.`};}
const firstLine=(word,letter)=>`${cap(word)} starts with ${letter}.`;
const wordLines=w=>({prompt:`Find the word ${w}.`,correction:`The word is ${w}.`,recap:`${w}.`});
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
   return {kind:'first-letter',track:'letters',word,picture,answer,prompt:`Which letter does ${word} start with?`,correction:line,recap:line,options:letterOptions(answer,n,upperKnown,r)};}
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
// Letters with a recorded sound in the private edition. Only words made of these are ever sounded out.
export const SOUND_LETTERS='abcdefghimnoprstu';
export const canSoundOut=w=>[...w].every(c=>SOUND_LETTERS.includes(c));
function readWordGate(level,r,n,avoid){
 const fresh=CVC_TARGETS.filter(w=>!avoid.has(w)&&![...avoid].some(a=>typeof a==='string'&&a.length===3&&a.slice(1)===w.slice(1))),answer=pick(fresh.length?fresh:CVC_TARGETS,r),near=cvcDistractors(answer);
 // one last-letter look-alike and one vowel look-alike when there is room for both
 const last=near.filter(w=>w[1]===answer[1]),vowel=near.filter(w=>w[1]!==answer[1]);
 const picks=n>=3&&last.length&&vowel.length?[pick(last,r),pick(vowel,r)]:shuffled(near,r).slice(0,n-1);
 return {kind:'read-word',track:'words',answer,...wordLines(answer),correction:soundOutLine(answer),after:soundOutLine(answer),options:[answer,...picks]};
}
// The next word of a spoken sentence: the start of the sentence is shown, the child picks the word that comes next.
// Only lowercase words with a real look-alike (never a name, never the first word).
export function nextWordGate(level,r,n,avoid){
 const bank=[...STARTER_SENTENCES,...SENTENCES[0]];
 const candidates=[];
 for(const sentence of bank){if(avoid.has(sentence))continue;const words=tilesOf(sentence);words.forEach((w,k)=>{if(k>0&&CVC_WORDS.includes(w)&&canSoundOut(w)&&cvcDistractors(w).length&&!avoid.has(w))candidates.push({sentence,words,k});});}
 if(!candidates.length)return null;
 const {sentence,words,k}=pick(candidates,r),answer=words[k],near=cvcDistractors(answer);
 return {kind:'next-word',track:'words',sentence,before:words.slice(0,k),answer,prompt:sentence,correction:soundOutLine(answer),after:soundOutLine(answer),recap:`${answer}.`,options:[answer,...shuffled(near,r).slice(0,n-1)]};
}
// Gate rows for one run. Beginner (letters): pairs first, then triplets. Explorer (words): CVC words, two pairs then triplets;
// next-word-of-a-sentence gates (rows 3, 6, 8) only once Letter Quest shows he builds sentences on his own. The answer never sits in the same lane three times running.
export function slalomRun(levelIn,{seed=1,count=SLALOM_GATES}={}){
 const level={...literacyFrom(null),...levelIn},r=rng(seed*7919+13),gates=[],recent=[],used=new Set();
 for(let i=0;i<count;i++){
  const track=level.track==='mixed'?(i%2?'words':'letters'):level.track;
  const n=track==='letters'?(i<4?2:3):(i<2?2:3),avoid=new Set([...recent.slice(track==='letters'?-4:-3),...used]);
  let g=track==='letters'?letterGate(level,r,n,avoid):(level.sentenceReady&&[2,5,7].includes(i)&&nextWordGate(level,r,n,avoid))||readWordGate(level,r,n,avoid);
  let options=shuffled(g.options,r);
  const lane=options.indexOf(g.answer),prev=gates.slice(-2).map(x=>x.lane);
  if(prev.length===2&&prev.every(x=>x===lane)&&options.length>1){const j=(lane+1)%options.length;[options[lane],options[j]]=[options[j],options[lane]];}
  g={...g,options,lane:options.indexOf(g.answer),game:'slalom',gate:i};recent.push(g.answer);if(g.sentence)used.add(g.sentence);gates.push(g);
 }
 return gates;
}
// After a missed gate, the next triplet becomes a pair (the answer and its closest look-alike stay).
export function easeGate(g){
 if(!g||g.options.length<3)return g;
 const drop=g.options.map((o,i)=>[o,i]).filter(([o])=>o!==g.answer).at(-1)[1];
 const options=g.options.filter((_,i)=>i!==drop);return {...g,options,lane:options.indexOf(g.answer),eased:true};
}
export const slalomTrack=(id,level)=>level?.track||DEFAULT_TRACK[id]||'mixed';
// Every line a run can say (for the voice build and its tests).
export function slalomLines(){
 const lines=new Set(Object.values(SLALOM_LINES));
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){for(const l of [false,true])for(const v of Object.values(letterLines(l?c.toLowerCase():c,l)))lines.add(v);}
 for(const [w] of FIRST_WORDS){lines.add(`Which letter does ${w} start with?`);lines.add(firstLine(w,upper(w[0])));}
 const words=new Set([...WORD_GROUPS.flat().flat(),...CVC_WORDS]);
 for(const s of [...SENTENCES.flat(),...STARTER_SENTENCES]){lines.add(s);tilesOf(s).forEach((w,k)=>{if(k>0&&/^[a-z]+$/.test(w)&&lookalikes(w).length)words.add(w);});}
 for(const w of words)for(const v of Object.values(wordLines(w)))lines.add(v);
 for(const w of CVC_WORDS)if(canSoundOut(w))lines.add(soundOutLine(w));
 return [...lines];
}
