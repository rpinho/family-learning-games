// Broader short-word practice: vocabulary variety does not require a harder level.
import {BUILDER_STARTERS} from './builder.mjs';
import {chooseWord} from './variety.mjs';
export const WORD_FAMILIES=[['cat','hat','mat'],['cap','map','tap'],['dog','log','hog'],['sun','run','fun']];
export const FOUNDATION_WORDS=BUILDER_STARTERS;
export function foundationState(p){return p.foundation||{stage:1,serial:0,streak:0,misses:0,skills:{}};}
export function foundationQuestion(p){
 const s=foundationState(p),stage=s.stage,n=s.serial;
 const word=chooseWord(p,FOUNDATION_WORDS,{skills:s.skills,serial:n});
 const position=(n+(p.variety?.serial||0))%3,answer=word[position].toUpperCase();
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',start=n*7%26;
 const count=stage===1?2:stage===2?3:4,letters=[...(alphabet.slice(start)+alphabet.slice(0,start))].filter(c=>c!==answer);
 const choices=[answer,...letters.slice(0,count-1)],offset=n%count,options=choices.slice(offset).concat(choices.slice(0,offset));
 return {foundation:true,stage,word,position,answer,char:answer,options,display:[...word.toUpperCase()].map((c,i)=>i===position?'_':c).join(' '),prompt:`The word is ${word}.`,help:`The word is ${word}. The missing letter is ${answer}.`};
}
export function foundationAttempt(p,q,{ok,helped=false}){
 const s=p.foundation??=structuredClone(foundationState(p)),word=q.word.toLowerCase(),skill=s.skills[word]??={seen:0,hits:0,errors:0};
 skill.seen++;if(ok&&!helped)skill.hits++;if(!ok)skill.errors++;s.serial++;
 if(ok&&!helped){s.streak++;s.misses=0;if(s.streak>=6){s.stage=Math.min(4,s.stage+1);s.streak=0;}}
 else {s.streak=0;if(!ok&&++s.misses>=2){s.stage=Math.max(1,s.stage-1);s.misses=0;}}
 return s;
}
