// Letter Slalom timing budget over every line a run can say (used by scripts/check-slalom-timing.mjs and the tests).
import {gapAfterGate,COURSE} from './slalom-timing.mjs';
import {CVC_TARGETS} from './word-break.mjs';
import {FIRST_WORDS} from './word-break.mjs';
import {praiseLetter,missLetter,praiseWord,missWord,sentenceTargets} from './slalom.mjs';
import {STARTER_SENTENCES,SENTENCES} from './word-break.mjs';
const UP='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// feedback and question lines per track
export function trackLines(){
 const letters={feedback:[...[...UP].flatMap(c=>[praiseLetter(c,false),missLetter(c,false),praiseLetter(c,true),missLetter(c,true)])],
  prompt:[...[...UP].flatMap(c=>[`Find the letter ${c}.`,`Find the little letter ${c}.`]),...FIRST_WORDS.map(([w])=>`Which letter does ${w} start with?`)]};
 const words={feedback:CVC_TARGETS.flatMap(w=>[praiseWord(w),missWord(w)]),prompt:CVC_TARGETS.map(w=>`Find the word ${w}.`)};
 const sentenceWords=sentenceTargets(),ready={feedback:[...words.feedback,...sentenceWords.flatMap(w=>[praiseWord(w),missWord(w)])],prompt:[...words.prompt,...STARTER_SENTENCES,...SENTENCES[0]]};
 return {'letters (Beginner)':letters,'words (Explorer)':words,'words, sentence-ready':ready};
}
export const slalomTimingLines=()=>[...new Set(Object.values(trackLines()).flatMap(t=>[...t.feedback,...t.prompt]))];
export function budgetReport(seconds){
 const cases=[];
 for(const [track,t] of Object.entries(trackLines())){
  const worst=list=>list.reduce((a,b)=>seconds[b]>seconds[a]?b:a);
  const wf=worst(t.feedback),wp=worst(t.prompt);
  for(const [speed,v0,boost] of [['base',COURSE.baseSpeed,false],['go-faster',COURSE.boostSpeed,true]])
   cases.push({track,speed,worstFeedback:wf,worstPrompt:wp,...gapAfterGate({feedback:seconds[wf],prompt:seconds[wp],v0,boost})});
 }
 return {ok:cases.every(c=>c.ok),cases};
}
