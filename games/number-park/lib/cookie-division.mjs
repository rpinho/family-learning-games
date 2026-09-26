export const COOKIE_GAME={id:'cookies',icon:'🍪',title:'Cookie division',description:'Share cookies equally onto plates.'};

// Levels 1-3 deal a pile. Levels 4-5 start from Cookie Buddy's lopsided
// plates: the child must work out the fair amount and move cookies between
// plates, so difficulty comes from reasoning rather than more dragging.
const RANGES={
  1:{plates:[2,3],each:[2,4]},
  2:{plates:[3,4],each:[3,5]},
  3:{plates:[3,4],each:[4,6]},
  4:{plates:[3,4],each:[4,6],mode:'fix'},
  5:{plates:[4,5],each:[4,6],mode:'mixed'}
};
export const COOKIE_MAX_LEVEL=5;
export const DRAG_MODES=['share','fix','mixed'];
export const isDragCookie=q=>!q.mode||DRAG_MODES.includes(q.mode);
export const FIX_PROMPT='Cookie Buddy piled the cookies unevenly. Move cookies between the plates until every friend has the same.';
export const MIXED_PROMPT='Some cookies are on the plates and some are still on the tray. Make every plate the same. The plates hide their numbers, so count carefully.';
export const COOKIE_HINTS={
 share:'Give one cookie to each plate, then go around again.',
 fix:'Find the fullest plate. Move one cookie to the plate with the fewest. Keep going.',
 mixed:'Put the tray cookies on the smallest plates first. Then move one from a full plate to a small plate.',
 remainder:'Make full, equal plates. Count the cookies left over.',
 snack:'First take away the cookies Buddy ate. Then share the rest.'
};

export function cookiePrompt(total,plates,mode='share',baked=total,eaten=0){
 if(mode==='fix')return FIX_PROMPT;
 if(mode==='mixed')return MIXED_PROMPT;
 if(mode==='snack')return `Cookie Buddy baked ${baked} cookies and ate ${eaten}. Share the rest with ${plates} friends. How many does each friend get, and how many are left over?`;
 if(mode==='remainder')return `Share ${total} cookies with ${plates} friends. How many does each friend get, and how many are left over?`;
 return `Share ${total} cookies equally onto ${plates} plates. How many cookies go on each plate?`;
}
export function cookieVoiceLines(){
 const lines=new Set([...Object.values(COOKIE_HINTS),FIX_PROMPT,MIXED_PROMPT,'Every friend has the same. Fair sharing!']);
 for(const {plates:[minPlates,maxPlates],each:[minEach,maxEach],mode} of Object.values(RANGES))if(!mode)for(let plates=minPlates;plates<=maxPlates;plates++)for(let each=minEach;each<=maxEach;each++)lines.add(cookiePrompt(plates*each,plates));
 for(let plates=2;plates<=4;plates++)for(let each=4;each<=7;each++)for(let leftover=1;leftover<plates;leftover++)lines.add(cookiePrompt(plates*each+leftover,plates,'remainder'));
 for(let plates=3;plates<=5;plates++)for(let each=4;each<=8;each++)for(let leftover=0;leftover<plates;leftover++)for(let eaten=2;eaten<=4;eaten++){
  const total=plates*each+leftover;lines.add(cookiePrompt(total,plates,'snack',total+eaten,eaten));
 }
 return [...lines];
}
// Build Cookie Buddy's lopsided start: begin fair, then make random unfair
// moves. Guarantees the start is not already fair and that at least one plate
// is two or more away from the fair amount, so a single move never solves it.
export function messyStart(plates,each,random,moves,tray=0){
 const counts=Array(plates).fill(each);
 for(let trial=0;trial<200;trial++){
  const c=[...counts];
  for(let m=0;m<moves;m++){const from=Math.floor(random()*plates);let to=Math.floor(random()*plates);if(to===from)to=(to+1)%plates;if(c[from]>0){c[from]--;c[to]++;}}
  if(Math.max(...c.map(n=>Math.abs(n-each)))<2)continue;
  let pulled=0;for(let k=0;k<tray*4&&pulled<tray;k++){const i=Math.floor(random()*plates);if(c[i]>0){c[i]--;pulled++;}}
  if(pulled<tray)continue;
  const draft=[];c.forEach((n,i)=>{for(let k=0;k<n;k++)draft.push(i);});
  for(let k=0;k<tray;k++)draft.push(null);
  if(c.every(n=>n===c[0])&&!tray)continue;
  return draft;
 }
 // Deterministic fallback for a weak random source: still lopsided, still fair-able.
 const c=Array(plates).fill(each);c[0]-=2;c[1]+=2;if(plates>2){c[2]-=1;c[0]+=1;}
 for(let k=0;k<tray;k++)c[(k+1)%plates]--;
 const draft=[];c.forEach((n,i)=>{for(let k=0;k<n;k++)draft.push(i);});for(let k=0;k<tray;k++)draft.push(null);return draft;
}
export function cookieQuestion(level,random){
 const range=RANGES[level]||RANGES[1];
 const plates=range.plates[0]+Math.floor(random()*(range.plates[1]-range.plates[0]+1));
 const each=range.each[0]+Math.floor(random()*(range.each[1]-range.each[0]+1));
 const mode=range.mode||'share';
 const leftover=0,eaten=0;
 const total=plates*each+leftover,baked=total+eaten;
 const q={kind:'cookies',skill:'cookies',level,mode,plan:'drag3',plates,total,baked,eaten,leftover,answer:each,max:baked,prompt:cookiePrompt(total,plates,mode,baked,eaten)};
 if(mode==='fix'||mode==='mixed'){
  q.start=messyStart(plates,each,random,3+Math.floor(random()*3),mode==='mixed'?plates+Math.floor(random()*plates):0);
  q.hideCounts=mode==='mixed';
 }
 q.fingerprint=JSON.stringify(['cookies',mode,plates,total,eaten,q.start?cookieCounts(q.start,plates):null]);
 return q;
}
export function initialCookieDraft(q){
 return Array.isArray(q.start)&&q.start.length===q.total?[...q.start]:Array(q.total).fill(null);
}
export function validCookieDraft(draft,total,plates){
 return Array.isArray(draft)&&draft.length===total&&draft.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<plates);
}
export function cookieCounts(draft,plates){
 return Array.from({length:plates},(_,i)=>draft.filter(n=>n===i).length);
}
