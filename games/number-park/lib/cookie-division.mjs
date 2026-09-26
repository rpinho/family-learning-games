export const COOKIE_GAME={id:'cookies',icon:'🍪',title:'Cookie division',description:'Share cookies equally onto plates.'};

const RANGES={
  1:{plates:[2,3],each:[2,4]},
  2:{plates:[2,4],each:[4,7]},
  3:{plates:[3,5],each:[4,8]}
};

export function cookiePrompt(total,plates,mode='share',baked=total,eaten=0){
 if(mode==='snack')return `Cookie Buddy baked ${baked} cookies and ate ${eaten}. Share the rest with ${plates} friends. How many does each friend get, and how many are left over?`;
 if(mode==='remainder')return `Share ${total} cookies with ${plates} friends. How many does each friend get, and how many are left over?`;
 return `Share ${total} cookies equally onto ${plates} plates. How many cookies go on each plate?`;
}
export function cookieVoiceLines(){
 const lines=new Set(['Give one cookie to each plate, then go around again.','Make full, equal plates. Count the cookies left over.','First take away the cookies Buddy ate. Then share the rest.']);
 for(let plates=2;plates<=3;plates++)for(let each=2;each<=4;each++)lines.add(cookiePrompt(plates*each,plates));
 for(let plates=2;plates<=4;plates++)for(let each=4;each<=7;each++)for(let leftover=1;leftover<plates;leftover++)lines.add(cookiePrompt(plates*each+leftover,plates,'remainder'));
 for(let plates=3;plates<=5;plates++)for(let each=4;each<=8;each++)for(let leftover=0;leftover<plates;leftover++)for(let eaten=2;eaten<=4;eaten++){
  const total=plates*each+leftover;lines.add(cookiePrompt(total,plates,'snack',total+eaten,eaten));
 }
 return [...lines];
}
export function cookieQuestion(level,random){
 const range=RANGES[level]||RANGES[1];
 const plates=range.plates[0]+Math.floor(random()*(range.plates[1]-range.plates[0]+1));
 const each=range.each[0]+Math.floor(random()*(range.each[1]-range.each[0]+1));
 const mode=level>=3?'snack':level===2?'remainder':'share';
 const leftover=mode==='share'?0:mode==='remainder'?1+Math.floor(random()*(plates-1)):Math.floor(random()*plates);
 const eaten=mode==='snack'?2+Math.floor(random()*3):0;
 const total=plates*each+leftover,baked=total+eaten;
 return {kind:'cookies',skill:'cookies',level,mode,plates,total,baked,eaten,leftover,answer:each,max:baked,prompt:cookiePrompt(total,plates,mode,baked,eaten),fingerprint:JSON.stringify(['cookies',mode,plates,total,eaten])};
}
export function validCookieDraft(draft,total,plates){
 return Array.isArray(draft)&&draft.length===total&&draft.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<plates);
}
export function cookieCounts(draft,plates){
 return Array.from({length:plates},(_,i)=>draft.filter(n=>n===i).length);
}
