// Independent word history: restarting a flight must not restart a fixed word list.
import {chooseWord} from './variety.mjs';
// Corrections change only the current draft, never word history or earned XP.
export function editBuilderDraft(draft,operation,index){
 if(operation==='clear')return [];
 if(operation==='backspace'){const next=[...draft];while(next.length&&!next.at(-1))next.pop();next.pop();while(next.length&&!next.at(-1))next.pop();return next;}
 if(operation==='remove'&&Number.isInteger(index)&&index>=0&&index<draft.length){const next=[...draft];next[index]='';while(next.length&&!next.at(-1))next.pop();return next;}
 return [...draft];
}
export const BUILDER_STARTERS=['cat','dog','sun','hat','pig','cup','bed','fox','map','hen','pen','bug','mat','cap','tap','log','hog','run','fun','bat','pan','fan','can','man','big','wig','dig','hop','mop','top','rug','mug','hug','red','pin','nap','bag','tag','rag','jam','ham','ram','van','wax','web','wet','net','pet','jet','leg','peg','ten','den','vet','win','fin','bin','lid','kid','lip','zip','sit','hit','fit','dip','tip','pot','hot','dot','pop','rod','mud'];
export function builderState(p){
 if(p.builder)return p.builder;
 // Older saves have only the active flight. Retain its exposure history without
 // treating the old display-only level as demonstrated spelling mastery.
 const recent=p.session?.game==='builder'?[...(p.session.results||[]).map(r=>r.q.word),p.session.q?.word].filter(Boolean):[];
 const words=recent.filter((w,i)=>!i||w!==recent[i-1]),skills={};
 for(const word of words){const skill=skills[word]??={seen:0,hits:0,errors:0};skill.seen++;}
 return {stage:1,serial:words.length,recent:words.slice(-12),skills,wins:[],misses:0};
}
export function builderQuestion(p,wordPools){
 const s=p.builder??=structuredClone(builderState(p));
 const pool=s.stage===1?BUILDER_STARTERS:wordPools[s.stage-1].map(x=>x[0]);
 const word=chooseWord(p,pool,{recent:s.recent.slice(-8),skills:s.skills,serial:s.serial});
 const alphabet='abcdefghijklmnopqrstuvwxyz',start=(s.serial*7)%26,count=s.stage===1?2:s.stage===2?4:6;
 const extras=(alphabet.slice(start)+alphabet.slice(0,start)).split('').filter(c=>!word.includes(c)).slice(0,count);
 const letters=[...new Set([...word,...extras])];
 const offset=s.serial%letters.length,tiles=letters.slice(offset).concat(letters.slice(0,offset)).reverse();
 s.recent.push(word);s.recent=s.recent.slice(-12);s.serial++;
 const skill=s.skills[word]??={seen:0,hits:0,errors:0};skill.seen++;
 return {game:'builder',builder:true,level:s.stage,word,answer:word,tiles,options:[],model:null,printCase:'upper',prompt:`Build the word ${word}. Tap the letters in order.`,help:`The word is ${word}.`};
}
export function builderAttempt(p,q,{ok,helped=false}){
 const s=p.builder??=structuredClone(builderState(p)),skill=s.skills[q.word]??={seen:1,hits:0,errors:0};
 if(!ok){skill.errors++;s.misses++;if(s.misses>=2){s.stage=Math.max(1,s.stage-1);s.wins=[];s.misses=0;}return;}
 const independent=!helped;if(independent)skill.hits++;
 s.wins.push({word:q.word,independent});s.wins=s.wins.slice(-8);s.misses=0;
 if(s.wins.length===8&&new Set(s.wins.filter(x=>x.independent).map(x=>x.word)).size>=6){s.stage=Math.min(3,s.stage+1);s.wins=[];}
}
