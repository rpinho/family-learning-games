// The Book follows the learner model (learner-profile.mjs, family-learner-2): tonight's chapter practises what he
// missed or is ready for TODAY or this week, inside the story, with the live beat kinds (signs he reads, a spell he
// rebuilds, sharing, a number lock, letter stones); never an overlay puzzle. Three small hooks, kept here so the
// planner, the prompt and the lint stay as they are:
//  - focusModel(model, learner)       before planChapter: his focus letter / word / fact goes first in the lists the
//                                      planner already picks from (the key story still decides an early letter);
//  - applyLearnerPlan(plan, learner)  after planChapter: the signs, the spell and one number game are set to the
//                                      planned items; plan.learnerFocus lists what the chapter practises and why;
//  - learnerBrief(plan) / learnerFocusIssues(chapter, plan)  the prompt section and the lint ("the chapter contains
//                                      the planned focus items").
// No learner model (or a stale or empty one) = the chapter is planned exactly as before.
import {FAMILIES,isFamilyWord,isLookAlike,lookAlikes,soundOut,canSoundOut,DECODABLE_SENTENCES,DECODABLE_NAMES,hasSound} from '../hub/public/word-families.mjs';
import {scramble,tilesOf,endMark,shuffle} from '../hub/public/word-break.mjs';
import {missingBeatProps} from '../hub/public/book-scene.mjs';
import {PROFILE_SCHEMA} from './learner-profile.mjs';

// Same seeded generator as plan.mjs (kept here so this module never imports the planner).
function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const say=n=>WORD_NUM[n]||String(n);
const usable=l=>l&&l.schema===PROFILE_SCHEMA&&l.bookPlan?l.bookPlan:null;
function numOptions(ans,r,near=[]){const s=new Set([String(ans)]);for(const x of [...near,ans+1,ans-1,ans+2,ans-2])if(s.size<3&&Number.isInteger(x)&&x>0&&x!==ans)s.add(String(x));return shuffle([...s],r);}
const ALL_FAMILY=Object.values(FAMILIES).flat();
// Look-alikes that differ ONLY in the vowel (pin: pan, pen), then the usual ones (same first letter, one change).
export function vowelLookAlikes(word,n=2,r=Math.random){
 const w=String(word).toLowerCase();if(!isFamilyWord(w))return [];
 const vow=shuffle(ALL_FAMILY.filter(x=>x!==w&&x[0]===w[0]&&x[2]===w[2]&&x[1]!==w[1]&&canSoundOut(x)),r);
 const rest=lookAlikes(w,n,r).filter(x=>!vow.includes(x));
 return [...vow,...rest].slice(0,n);
}
const signable=w=>isFamilyWord(w)&&canSoundOut(w)&&lookAlikes(w,2,()=>0).length>=2;

// Before planning: his focus items first in the lists the planner picks from (a copy; the model is not changed).
export function focusModel(model,learner){
 const bp=usable(learner);if(!bp||!model)return model;
 const m={...model,literacy:{...(model.literacy||{})},math:{...(model.math||{})}};
 const L=bp.letterFocus?.letter;
 if(L&&m.literacy.track==='letters'&&hasSound(L))m.literacy.learning=[L,...(m.literacy.learning||[]).filter(c=>c!==L)];
 const w=(bp.wordPatterns||[]).flatMap(p=>p.words||[]).find(signable);
 if(w)m.literacy.wordsStuck=[w,...(m.literacy.wordsStuck||[]).filter(x=>x!==w)];
 const f=bp.mathFocus;
 if(f?.kind==='fact')m.math.factsStuck=[`${Math.min(f.a,f.b)}x${Math.max(f.a,f.b)}`,...(m.math.factsStuck||[])];
 if(f?.kind==='share')m.math.hardShares=[...(m.math.hardShares||[]),{total:f.total,groups:f.groups,mode:'share'}];
 return m;
}

function setSigns(b,word,r,vowel){
 const old=b.target,options=shuffle([word,...vowelLookAlikes(word,2,r)],r);
 const re=new RegExp(`\\b${old}\\b`,'g');
 const sounds=b.sounds?{...Object.fromEntries(Object.entries(b.sounds).filter(([k])=>!(b.options||[]).includes(k))),...Object.fromEntries(options.map(o=>[o,soundOut(o)]).filter(([,t])=>t))}:undefined;
 return {...b,target:word,options,what:String(b.what||'').replace(re,word),spoken:String(b.spoken||'').replace(re,word),...(sounds?{sounds}:{}),learner:{item:`vowel:${vowel}`,word}};
}
function setSpell(b,sentence,r,{decodable}){
 const answer=tilesOf(sentence),extraWord=b.tiles&&b.answer&&b.tiles.length>b.answer.length?(answer.filter(isFamilyWord).map(w=>lookAlikes(w,1,r)[0]).find(Boolean)||null):null;
 const sounds=decodable?Object.fromEntries([...answer.filter(isFamilyWord),...(extraWord?[extraWord]:[])].map(w=>[w.toLowerCase(),soundOut(w)]).filter(([,t])=>t)):null;
 return {...b,sentence,answer,tiles:scramble(extraWord?[...answer,extraWord]:answer,r),mark:endMark(sentence),spoken:`The spell says: ${sentence} Put the words back in order.`,...(sounds?{sounds}:{})};
}
function shareBeat(id,{total,groups},r){const each=total/groups;
 return {id,kind:'share',what:`share ${total} pizza slices fairly on ${groups} plates (each tap deals one slice onto every plate; then he says how many each)`,total,groups,thing:'pizza slices',
  spoken:`${total} pizza slices, shared fairly on ${say(groups)} plates. Tap the pizza to deal one slice onto every plate.`,ask:`How many slices on each plate?`,answer:String(each),options:numOptions(each,r),done:`Yes! ${say(each)} on each plate.`};}
function scoreBeat(id,{a,b},r){
 return {id,kind:'score',what:`the scoreboard: each goal is worth ${a} points and the team scored ${b} goals; he works out the points`,a,b,
  spoken:`Each goal is worth ${a} points. We scored ${b} goals. What is ${b} times ${a}?`,display:`${b} × ${a}`,answer:String(a*b),options:numOptions(a*b,r,[a*b+a,a*b-a]),done:`Yes! ${a*b} points!`};}
function ninesBeat(id,n,r){const ans=9*n;
 return {id,kind:'puzzle',variant:'nines',display:`9 × ${n}`,answer:String(ans),options:numOptions(ans,r,[ans+9,ans-9]),
  what:`a wizard's number lock needs nine times ${say(n)}; he uses the nines finger trick (fold down finger ${say(n)}: the fingers before it are the tens, the fingers after it are the ones)`,
  spoken:`The wizard lock asks: nine times ${say(n)}. Use the finger trick!`,hint:`Fold down finger ${say(n)}. ${say(n-1)} fingers before it, ${say(10-n)} after it.`,done:`Yes! ${ans}! The lock clicks open.`};}
function remainderOf(id,{total,groups},r){const left=total%groups;
 return {id,kind:'remainder',total,groups,thing:'cookies',prop:'cookie',answer:String(left),options:numOptions(left,r,[left+1,groups]),
  what:`${total} cookies must be shared fairly on ${groups} plates; he deals them round by round, and some are left over`,
  spoken:`${total} cookies, shared fairly on ${say(groups)} plates. Tap the basket to deal one onto every plate.`,ask:`${total} cookies on ${say(groups)} plates: how many are left over?`,done:`Yes! ${say(left)} left over.`};}
// The number game his focus needs (or null when it cannot be drawn: no pictures for it).
function mathBeat(id,f,r,library){
 const b=f.kind==='share'?shareBeat(id,f,r):f.kind==='remainder'?remainderOf(id,f,r):f.kind==='fact'?((f.a===9||f.b===9)?ninesBeat(id,f.a===9?f.b:f.a,r):scoreBeat(id,f,r)):null;
 if(!b)return null;if(library&&missingBeatProps(b,library).length)return null;return b;
}
const hasItem=(b,f)=>f.kind==='share'?b.kind==='share'&&b.total===f.total&&b.groups===f.groups:f.kind==='remainder'?b.kind==='remainder'&&b.total===f.total&&b.groups===f.groups
 :f.kind==='fact'?(b.kind==='score'&&((b.a===f.a&&b.b===f.b)||(b.a===f.b&&b.b===f.a)))||(b.kind==='puzzle'&&b.variant==='nines'&&b.display===`9 × ${f.a===9?f.b:f.a}`):f.kind==='count'?b.kind==='count'&&b.n===f.n:false;

// After planning: set the beats to the plan's focus items. Returns notes for the log; plan.learnerFocus lists them.
export function applyLearnerPlan(plan,learner,{library=null}={}){
 const notes=[];plan.learnerFocus=[];
 const bp=usable(learner);if(!bp)return notes;
 const r=rng(`learner:${plan.player}:${plan.date}`),beats=plan.beats||[],add=(f)=>plan.learnerFocus.push(f);
 if(plan.level==='reader'){
  const wp=(bp.wordPatterns||[]).find(p=>p.vowel&&(p.words||[]).some(signable));
  const signs=beats.find(b=>b.kind==='signs');
  if(wp&&signs){
   const word=(wp.words||[]).find(w=>signable(w)&&w===signs.target)||(signs.target&&signs.target[1]===wp.vowel&&signable(signs.target)?signs.target:(wp.words||[]).find(signable));
   const i=beats.indexOf(signs);beats[i]=setSigns(signs,word,r,wp.vowel);
   add({item:wp.item,beat:signs.id,kind:'signs',value:word,label:`the short ${wp.vowel} sound`,why:wp.why});
   // The spell: a sentence with a word of that vowel when there is one.
   const spell=beats.find(b=>b.kind==='spell');
   if(spell&&plan.reading==='decodable'){const has=s=>tilesOf(s).some(w=>isFamilyWord(w)&&!DECODABLE_NAMES.includes(w.toLowerCase())&&w.toLowerCase()[1]===wp.vowel);
    const confidence=new Set(bp.confidenceWords||[]);
    const candidates=DECODABLE_SENTENCES.filter(has),withConfidence=candidates.filter(s=>tilesOf(s).some(w=>confidence.has(w.toLowerCase())));
    const pick=shuffle(withConfidence.length?withConfidence:candidates,r)[0];
    if(pick){const j=beats.indexOf(spell);if(!has(spell.sentence))beats[j]=setSpell(spell,pick,r,{decodable:true});
     const w=tilesOf(beats[j].sentence).find(x=>isFamilyWord(x)&&!DECODABLE_NAMES.includes(x.toLowerCase())&&x.toLowerCase()[1]===wp.vowel);
     add({item:wp.item,beat:spell.id,kind:'spell',value:w.toLowerCase(),label:`the short ${wp.vowel} sound`,why:wp.why});}}
  }else if(wp)notes.push(`learner: no signs beat for ${wp.item}`);
  const raw=bp.mathFocus,f=raw?.kind==='remainder'&&plan.allowRemainders!==true?null:raw;
  if(raw?.kind==='remainder'&&!f)notes.push('learner: remainder focus disabled by the reader plan');
  if(f&&['share','remainder','fact'].includes(f.kind)){
   const have=beats.find(b=>hasItem(b,f));
   if(have)add({item:f.item,beat:have.id,kind:have.kind,value:f.kind==='fact'?`${f.a}x${f.b}`:`${f.total}/${f.groups}`,label:f.kind,why:f.why});
   else{
    // The number game he is on the edge of replaces a number game of the same family, else the last puzzle.
    const same=beats.findIndex(b=>b.kind===(f.kind==='fact'?'score':f.kind));
    const last=[...beats].reverse().find(b=>['puzzle','remainder','share','score'].includes(b.kind));
    const at=same>=0?same:last?beats.indexOf(last):-1;
    const nb=at>=0?mathBeat(beats[at].id,f,r,library):null;
    if(nb){beats[at]=nb;add({item:f.item,beat:nb.id,kind:nb.kind,value:f.kind==='fact'?`${f.a}x${f.b}`:`${f.total}/${f.groups}`,label:f.kind,why:f.why});}
    else notes.push(`learner: math focus ${f.item} not placed (${at<0?'no number game in this chapter':'no pictures for it'})`);
   }
  }
 }else{
  const lf=bp.letterFocus;
  if(lf&&plan.letter===lf.letter){const lb=beats.find(b=>['stones','kick-letter'].includes(b.kind));if(lb)add({item:lf.item,beat:lb.id,kind:lb.kind,value:lf.letter,label:`the letter ${lf.letter}`,why:lf.why});}
  else if(lf)notes.push(`learner: letter focus ${lf.letter} not today (the key story chose ${plan.letter})`);
  const f=bp.mathFocus,cb=beats.find(b=>b.kind==='count');
  if(f?.kind==='count'&&cb&&f.n>=3&&f.n<=12){cb.n=f.n;cb.answer=String(f.n);cb.options=numOptions(f.n,r);add({item:f.item,beat:cb.id,kind:'count',value:String(f.n),label:'counting',why:f.why});}
 }
 return notes;
}

// The prompt section: what the beats practise and why (for the writer only; never said to him).
export function learnerBrief(plan){try{return brief(plan);}catch{return '';}}
function brief(plan){
 const f=plan.learnerFocus||[];if(!f.length)return '';
 const line=x=>{const b=(plan.beats||[]).find(y=>y.id===x.beat);
  if(x.kind==='signs')return `- "${x.beat}" (signs): today he practises ${x.label}. The signs differ by ${(b?.options||[]).every(o=>o===b.target||(o[0]===b.target[0]&&o[2]===b.target[2]))?'only the middle letter':'one letter'}, so he must sound out every letter. Make the story NEED that one sign right now (the way on, the door that opens); each letter has a tap-to-hear sound and Hear it blends the word; a wrong try repeats the sound without blocking the story.`;
  if(x.kind==='spell')return `- "${x.beat}" (spell): the spell has a word with ${x.label} in it; let the story make the spell matter.`;
  if(['share','remainder'].includes(x.kind))return `- "${x.beat}" (${x.kind}): sharing ${b?.total} things fairly by ${b?.groups} is just at his level today; make the friends need it shared fairly before the adventure goes on. Never say how many each.`;
  if(['score','puzzle'].includes(x.kind))return `- "${x.beat}" (${x.kind}): this fact is just at his level today; give the story a real reason to need it. Never say the answer.`;
  if(['stones','kick-letter'].includes(x.kind))return `- "${x.beat}" (${x.kind}): today's letter is one he is still learning; let him find it by its sound inside the adventure.`;
  if(x.kind==='count')return `- "${x.beat}" (count): counting ${x.value} things is just at his edge; give the story a reason to need exactly that many.`;
  return '';};
 return `\nWHAT HE PRACTISES TODAY (chosen from his own play today and this week; for you only: never tell him, never call anything hard, never a quiz)\n${f.map(line).filter(Boolean).join('\n')}\n`;
}

// Lint: the chapter contains the planned focus items (the beat page is there and still carries the item).
export function learnerFocusIssues(ch,plan){
 const out=[],pages=ch?.pages||[];
 for(const f of plan.learnerFocus||[]){const b=(plan.beats||[]).find(x=>x.id===f.beat);
  if(!b){out.push(`learner focus ${f.item}: beat ${f.beat} is missing from the plan`);continue;}
  const carries=f.kind==='signs'?b.target===f.value&&(b.options||[]).includes(f.value)&&(b.options||[]).every(o=>o===f.value||isLookAlike(f.value,o))
   :f.kind==='spell'?(b.answer||[]).some(w=>w.toLowerCase()===f.value)
   :['stones','kick-letter'].includes(f.kind)?b.letter===f.value
   :f.kind==='count'?String(b.n)===f.value
   :['share','remainder'].includes(f.kind)?`${b.total}/${b.groups}`===f.value
   :['score','puzzle'].includes(f.kind)?(b.kind==='score'?[`${b.a}x${b.b}`,`${b.b}x${b.a}`].includes(f.value):String(b.display||'').includes(f.value.split('x').find(x=>x!=='9')||'')):true;
  if(!carries)out.push(`learner focus ${f.item}: beat ${f.beat} no longer practises it`);
  if(!pages.some(p=>p?.beat===f.beat))out.push(`the chapter must include beat ${f.beat} (today's practice: ${f.label})`);
 }
 return out;
}
