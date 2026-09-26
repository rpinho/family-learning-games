export const COOKIE_GAME={id:'cookies',icon:'🍪',title:'Cookie division',description:'Share cookies equally onto plates.'};

const RANGES={
  1:{plates:[2,3],each:[2,4]},
  2:{plates:[2,4],each:[2,6]},
  3:{plates:[3,5],each:[3,8]}
};

export function cookiePrompt(total,plates){return `Share ${total} cookies equally onto ${plates} plates. How many cookies go on each plate?`;}
export function cookieVoiceLines(){
 const lines=new Set(['Give one cookie to each plate, then go around again.']);
 for(let plates=2;plates<=5;plates++)for(let each=2;each<=8;each++)lines.add(cookiePrompt(plates*each,plates));
 return [...lines];
}
export function cookieQuestion(level,random){
 const range=RANGES[level]||RANGES[1];
 const plates=range.plates[0]+Math.floor(random()*(range.plates[1]-range.plates[0]+1));
 const each=range.each[0]+Math.floor(random()*(range.each[1]-range.each[0]+1));
 const total=plates*each;
 return {kind:'cookies',skill:'cookies',level,plates,total,answer:each,max:total,prompt:cookiePrompt(total,plates),fingerprint:JSON.stringify(['cookies',plates,total])};
}
export function validCookieDraft(draft,total,plates){
 return Array.isArray(draft)&&draft.length===total&&draft.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<plates);
}
export function cookieCounts(draft,plates){
 return Array.from({length:plates},(_,i)=>draft.filter(n=>n===i).length);
}
