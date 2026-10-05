// game as the older cookie track, but only fair sharing of a few cookies onto
// 2 (later 3) plates, one for you, one for me. No division sign, no remainders,
// no number buttons and no "how many each?" question: the plates count out loud
// as each cookie lands, and the round checks itself when the tray is empty.
// Its rows carry their own track, so the older track's levels never read them.
export const KINDER_TRACK='kinder-cookies-1';
export const KINDER_COOKIE_GAME={id:'cookies',icon:'🍪',title:'Snack Friend',description:'Share the cookies. One for you, one for me!'};
// Every level stays at 10 cookies or fewer.
export const KINDER_LEVELS={
 1:{plates:[2,2],each:[1,2]}, // 2 or 4 cookies, 2 plates
 2:{plates:[2,2],each:[2,3]}, // 4 or 6
 3:{plates:[3,3],each:[1,2]}, // 3 or 6, the first three-plate rounds
 4:{plates:[2,2],each:[3,5]}, // 6, 8 or 10
 5:{plates:[3,3],each:[2,3]}  // 6 or 9
};
export const KINDER_MAX_LEVEL=5,KINDER_START=2,KINDER_MAX_TOTAL=10;
// Three clean rounds in a row move up; two rough rounds in a row move down.
export const KINDER_UP=3,KINDER_DOWN=2;
export const KINDER_TIP='One for you, one for me!';
export const KINDER_HINT='Give one cookie to each friend. Then go around again.';
export const KINDER_UNEVEN='Not fair yet. Move a cookie to the plate with fewer.';
export const kinderPrompt=(total,plates)=>`Share ${total} cookies with ${plates} friends.`;
export const kinderWin=each=>`${each} for each friend. Fair!`;
export const isKinder=q=>q?.track===KINDER_TRACK;
const kinderRow=h=>h?.question?.track===KINDER_TRACK;
// A Help tap alone (no uneven plates) is neither progress nor a struggle.
const clean=h=>h.ok&&!h.helped&&!h.cookieChecks;
const helpOnly=h=>h.ok&&h.helped&&!h.cookieChecks;
// Level from his own results. A parent/child Easier/Harder choice is stored as
// {level, after}: it applies at once, and only rounds after it adapt from there.
export function kinderProgress(p){
 const rows=(p.history||[]).filter(kinderRow),manual=p.kinderCookies?.manual;
 let level=KINDER_START,start=0;
 if(manual&&Number.isInteger(manual.level)){level=clampLevel(manual.level);start=Math.max(0,Math.min(rows.length,manual.after|0));}
 let streak=0,rough=0;
 for(const h of rows.slice(start)){
  if(clean(h)){streak++;rough=0;if(streak>=KINDER_UP){if(level<KINDER_MAX_LEVEL)level++;streak=0;}}
  else if(helpOnly(h))streak=0;
  else{streak=0;rough++;if(rough>=KINDER_DOWN){if(level>1)level--;rough=0;}}
 }
 return {level,streak,rough,rounds:rows.length};
}
export const clampLevel=n=>Math.max(1,Math.min(KINDER_MAX_LEVEL,Math.round(Number(n))||1));
export function kinderQuestion(level,random){
 const range=KINDER_LEVELS[clampLevel(level)];
 const plates=range.plates[0]+Math.floor(random()*(range.plates[1]-range.plates[0]+1));
 const each=range.each[0]+Math.floor(random()*(range.each[1]-range.each[0]+1)),total=plates*each;
 return {kind:'cookies',skill:'cookies',track:KINDER_TRACK,level:clampLevel(level),mode:'share',plan:'drag3',fade:'show',plates,total,baked:total,eaten:0,leftover:0,answer:each,max:total,prompt:kinderPrompt(total,plates),fingerprint:JSON.stringify([KINDER_TRACK,plates,total])};
}
// Avoid repeating the last couple of rounds when the level has another shape.
export function nextKinderQuestion(p,random){
 const {level}=kinderProgress(p),recent=p.recent||[];let q;
 for(let trial=0;trial<12;trial++){q=kinderQuestion(level,random);if(!recent.slice(-2).includes(q.fingerprint))break;}
 return q;
}
export function kinderVoiceLines(){
 const lines=new Set([KINDER_TIP,KINDER_HINT,KINDER_UNEVEN]);
 for(const {plates:[a,b],each:[c,d]} of Object.values(KINDER_LEVELS))for(let plates=a;plates<=b;plates++)for(let each=c;each<=d;each++){lines.add(kinderPrompt(plates*each,plates));lines.add(kinderWin(each));}
 return [...lines];
}
