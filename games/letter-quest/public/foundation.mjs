// Short uppercase CVC practice, directed by Helper's September 7 feedback.
export const WORD_FAMILIES=[['cat','hat','mat'],['cap','map','tap'],['dog','log','hog'],['sun','run','fun']];
export const FOUNDATION_WORDS=WORD_FAMILIES.flat();
export function foundationState(p){return p.foundation||{stage:1,serial:0,streak:0,misses:0,skills:{}};}
export function foundationQuestion(p){
 const s=foundationState(p),stage=s.stage,n=s.serial;
 const family=WORD_FAMILIES[n%4===3?Math.max(0,stage-2):stage-1];
 const word=[...family].sort((a,b)=>(s.skills[a]?.hits||0)-(s.skills[b]?.hits||0)||((family.indexOf(a)+n)%3)-((family.indexOf(b)+n)%3))[0];
 const position=stage===1?0:stage===2?n%2*2:n%3,answer=word[position].toUpperCase();
 const count=stage===1?2:stage===2?3:4,letters=[...new Set([...family.map(w=>w[position]),...'catmpsdoglhrunfe'])].map(c=>c.toUpperCase()).filter(c=>c!==answer);
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
