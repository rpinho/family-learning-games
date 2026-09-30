// Letter Slalom timing budget over every line a run can say (used by scripts/check-slalom-timing.mjs and the tests).
import {gapAfterGate,COURSE} from './slalom-timing.mjs';
import {FIRST_WORDS} from './word-break.mjs';
import {praiseLetter,missLetter,praiseWord,missWord,soundOutLine,SLALOM_FAMILIES,familyWords} from './slalom.mjs';
const UP='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// feedback and question lines per track; `support` = rows after two misses in a row (the question is the sound-out,
// the rider cruises at COURSE.supportSpeed and may ease off further while it plays)
export function trackLines(){
 const letters={feedback:[...[...UP].flatMap(c=>[praiseLetter(c,false),missLetter(c,false),praiseLetter(c,true),missLetter(c,true)])],
  prompt:[...[...UP].flatMap(c=>[`Find the letter ${c}.`,`Find the little letter ${c}.`]),...FIRST_WORDS.map(([w])=>`Which letter does ${w} start with?`)]};
 const targets=SLALOM_FAMILIES.flatMap(familyWords);
 const words={feedback:targets.flatMap(w=>[praiseWord(w),missWord(w)]),prompt:targets.map(w=>`Find the word ${w}.`)};
 const support={feedback:words.feedback,prompt:targets.map(soundOutLine),support:true};
 return {'letters (Beginner)':letters,'words (Explorer)':words,'words, support (sound-out question)':support};
}
export const slalomTimingLines=()=>[...new Set(Object.values(trackLines()).flatMap(t=>[...t.feedback,...t.prompt]))];
export function budgetReport(seconds){
 const cases=[];
 for(const [track,t] of Object.entries(trackLines())){
  const worst=list=>list.reduce((a,b)=>seconds[b]>seconds[a]?b:a);
  const wf=worst(t.feedback),wp=worst(t.prompt);
  // support rows: arriving at cruise, at support speed, or still fast from go-faster (no go-faster on support rows)
  const speeds=t.support?[['base',COURSE.baseSpeed,false],['support',COURSE.supportSpeed,false],['from go-faster',COURSE.boostSpeed,false]]:[['base',COURSE.baseSpeed,false],['go-faster',COURSE.boostSpeed,true]];
  for(const [speed,v0,boost] of speeds)
   cases.push({track,speed,worstFeedback:wf,worstPrompt:wp,...gapAfterGate({feedback:seconds[wf],prompt:seconds[wp],v0,boost,...(t.support?{base:COURSE.supportSpeed,allowSlow:true}:{})})});
 }
 return {ok:cases.every(c=>c.ok),cases};
}
