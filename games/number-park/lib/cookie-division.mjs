export const COOKIE_GAME={id:'cookies',icon:'🍪',title:'Cookie division',description:'Share cookies equally onto plates.'};

// Levels 1-3 deal a pile. Levels 4-5 start from Cookie Buddy's lopsided
// plates: the child must work out the fair amount and move cookies between
// plates, so difficulty comes from reasoning rather than more dragging.
const RANGES={
  1:{plates:[2,3],each:[2,4]},
  2:{plates:[3,4],each:[3,5]},
  3:{plates:[3,4],each:[4,6]},
  4:{plates:[3,4],each:[4,6],mode:'fix'},
  5:{plates:[4,5],each:[4,6],mode:'mixed'},
  // Level 6, the top of the ladder: remainders. Cookies that can't be shared
  // go to Cookie Buddy ("13 ÷ 4 = 3 r 1"). Never below level 6.
  6:{plates:[3,5],each:[3,6],mode:'leftover'}
};
export const COOKIE_MAX_LEVEL=6;
export const BAG_SLOTS=8; // bags on screen never reveal the answer: filled ones + one empty
// 'leftover' is the drag remainder round. The old button-only 'remainder' and
// 'snack' modes are not drag modes; saved ones are converted in prepareProfile.
export const DRAG_MODES=['share','fix','mixed','bags','rows','leftover'];
// Help fades inside every level, with no new screen or choice:
//  show - plate counts visible, tips on (the original round)
//  hide - counts hidden; the existing Help button brings them back
//  own  - he says how many each BEFORE sharing; the cookies are the check
// Two clean rounds move show -> hide -> own; five clean rounds in a row at
// 'own' (the quiet mastery check) move up a level.
export const FADE=['show','hide','own'];
export const STAGE_WINS=2,MASTERY_RUN=5;
// Cookie Buddy's spot counts as one more plate in a leftover round.
export const slotsFor=q=>q.mode==='leftover'?q.plates+1:q.plates;

export const isDragCookie=q=>!q.mode||DRAG_MODES.includes(q.mode);
// Spoken prompts are kept to one or two short sentences (a parent turned a
// tutor's verbosity down in a recording). The picture and the question step
// carry the rest.
export const FIX_PROMPT='Move cookies until every plate is the same.';
export const MIXED_PROMPT='Make every plate the same. Count carefully.';
// Older saved rounds still carry the longer wording; their clips stay available.
export const LEGACY_PROMPTS=['Cookie Buddy piled the cookies unevenly. Move cookies between the plates until every friend has the same.','Some cookies are on the plates and some are still on the tray. Make every plate the same. The plates hide their numbers, so count carefully.'];
export const COOKIE_HINTS={
 share:'Give one cookie to each plate, then go around again.',
 fix:'Find the fullest plate. Move one cookie to the plate with the fewest. Keep going.',
 mixed:'Put the tray cookies on the smallest plates first. Then move one from a full plate to a small plate.',
 bags:'Fill one bag until it is full. Then start the next bag.',
 rows:'Put one cookie in each row. Then go around again.',
 leftover:'Give every friend the same. Cookies you cannot share go to Cookie Buddy.',
 remainder:'Make full, equal plates. Count the cookies left over.',
 snack:'First take away the cookies Buddy ate. Then share the rest.'
};

export const bagsPrompt=size=>`Each bag holds ${size} cookies. Fill the bags.`;
const legacyBagsPrompt=size=>`Cookie Buddy is packing bags. Each bag holds ${size} cookies. Fill the bags. How many bags do you need?`;
// Rows (arrays): the baking-tray picture of division. "12 cookies in 3 equal
// rows" is 12 ÷ 3, and the finished tray also shows 3 × 4 = 12.
export const rowsPrompt=(total,rows)=>`Put ${total} cookies in ${rows} equal rows.`;
export const ASK_EACH='How many cookies does each friend get?';
export const ASK_BAGS='How many bags did you fill?';
export const ASK_ROWS='How many cookies are in each row?';
export const askLine=q=>q.mode==='bags'?ASK_BAGS:q.mode==='rows'?ASK_ROWS:ASK_EACH;
// 'own' stage: the same question, asked before any cookie moves.
export const PREDICT_EACH='How many cookies will each friend get?';
export const PREDICT_BAGS='How many bags will you fill?';
export const PREDICT_ROWS='How many cookies will go in each row?';
export const predictLine=q=>q.mode==='bags'?PREDICT_BAGS:q.mode==='rows'?PREDICT_ROWS:PREDICT_EACH;
export const PREDICT_RIGHT='You knew it!';
export const leftoverPrompt=(total,plates)=>`Share ${total} cookies with ${plates} friends. Extras go to Cookie Buddy.`;
export const MONSTER_TOO_MANY='Cookie Buddy has enough for one more each. Share them!';
export const MONSTER_SHORT='Make every plate the same first.';
export const unevenMessage=q=>q.mode==='rows'?'Not equal yet. Move one from a long row to a short row.':'Not equal yet. Move one from a fuller plate to a smaller plate.';
export const askRetryMessage=q=>q.mode==='bags'?'Count the full bags.':q.mode==='rows'?'Count the cookies in one row.':'Count the cookies on one plate.';
// Rows start at 3 rows: 2 x 2 and 2 x 3 arrays were too easy in a recording.
const ROWS={2:{rows:[3,4],each:[3,5]},3:{rows:[3,5],each:[3,6]}};
export const ROWS_MAX_TOTAL=24;
export function cookiePrompt(total,plates,mode='share',baked=total,eaten=0,bagSize=0){
 if(mode==='bags')return bagsPrompt(bagSize);
 if(mode==='rows')return rowsPrompt(total,plates);
 if(mode==='leftover')return leftoverPrompt(total,plates);
 if(mode==='fix')return FIX_PROMPT;
 if(mode==='mixed')return MIXED_PROMPT;
 if(mode==='snack')return `Cookie Buddy baked ${baked} cookies and ate ${eaten}. Share the rest with ${plates} friends. How many does each friend get, and how many are left over?`;
 if(mode==='remainder')return `Share ${total} cookies with ${plates} friends. How many does each friend get, and how many are left over?`;
 return `Share ${total} cookies equally onto ${plates} plates.`;
}
const legacySharePrompt=(total,plates)=>`Share ${total} cookies equally onto ${plates} plates. How many cookies go on each plate?`;
export function cookieVoiceLines(){
 const lines=new Set([...Object.values(COOKIE_HINTS),FIX_PROMPT,MIXED_PROMPT,...LEGACY_PROMPTS,'Every friend has the same. Fair sharing!',ASK_EACH,ASK_BAGS,ASK_ROWS,PREDICT_EACH,PREDICT_BAGS,PREDICT_ROWS,PREDICT_RIGHT,'Count the cookies on one plate.','Count the full bags.','Count the cookies in one row.','A bag is not full yet. Fill it before you start a new one.']);
 for(const [plates,each,leftover] of leftoverShapes())lines.add(leftoverPrompt(plates*each+leftover,plates));
 for(let size=2;size<=6;size++){lines.add(bagsPrompt(size));lines.add(legacyBagsPrompt(size));}
 for(const {plates:[minPlates,maxPlates],each:[minEach,maxEach],mode} of Object.values(RANGES))if(!mode)for(let plates=minPlates;plates<=maxPlates;plates++)for(let each=minEach;each<=maxEach;each++){lines.add(cookiePrompt(plates*each,plates));lines.add(legacySharePrompt(plates*each,plates));}
 for(const {rows:[minRows,maxRows],each:[minEach,maxEach]} of Object.values(ROWS))for(let rows=minRows;rows<=maxRows;rows++)for(let each=minEach;each<=maxEach;each++)if(rows*each<=ROWS_MAX_TOTAL)lines.add(rowsPrompt(rows*each,rows));
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
// Every (plates, each, leftover) a level-6 round can use; at most 26 cookies to drag.
export const LEFTOVER_MAX_TOTAL=26;
export function leftoverShapes(){
 const out=[];const {plates:[a,b],each:[c,d]}=RANGES[6];
 for(let plates=a;plates<=b;plates++)for(let each=c;each<=d;each++)for(let leftover=1;leftover<plates;leftover++)if(plates*each+leftover<=LEFTOVER_MAX_TOTAL)out.push([plates,each,leftover]);
 return out;
}
export function cookieQuestion(level,random,stage='show'){
 const q=baseCookieQuestion(level,random);
 q.level=level; // level-6 reasoning rounds are built like level 5 but belong to 6
 q.fade=FADE.includes(stage)?stage:'show';

 return q;
}
function baseCookieQuestion(level,random){
 if(level>=6&&random()<0.67){
  const shapes=leftoverShapes(),[plates,each,leftover]=shapes[Math.floor(random()*shapes.length)],total=plates*each+leftover;
  return {kind:'cookies',skill:'cookies',level,mode:'leftover',plan:'drag3',plates,total,baked:total,eaten:0,leftover,answer:each,max:total,prompt:leftoverPrompt(total,plates),fingerprint:JSON.stringify(['cookies','leftover',plates,total])};
 }
 if(level>=6)level=5; // the rest of level 6 is level-5 reasoning rounds
 const range=RANGES[level]||RANGES[1];
 const plates=range.plates[0]+Math.floor(random()*(range.plates[1]-range.plates[0]+1));
 const each=range.each[0]+Math.floor(random()*(range.each[1]-range.each[0]+1));
 // From level 3 up, about one round in three is 'bags': the other meaning of
 // division (how many groups of a known size), dragged the same way. From
 // level 2 up, about one in three is 'rows': the array picture of division.
 const roll=level>=2?random():1;
 if(level>=3&&roll<0.34){
  const size=(level===3?2:3)+Math.floor(random()*(level===3?3:4)),bags=3+Math.floor(random()*3),total=size*bags;
  return {kind:'cookies',skill:'cookies',level,mode:'bags',plan:'drag3',bagSize:size,plates:BAG_SLOTS,total,baked:total,eaten:0,leftover:0,answer:bags,max:total,prompt:bagsPrompt(size),fingerprint:JSON.stringify(['cookies','bags',size,total])};
 }
 if(level>=2&&roll>=0.67){
  const rr=ROWS[Math.min(3,level)],rows=rr.rows[0]+Math.floor(random()*(rr.rows[1]-rr.rows[0]+1));
  const each=Math.min(Math.floor(ROWS_MAX_TOTAL/rows),rr.each[0]+Math.floor(random()*(rr.each[1]-rr.each[0]+1))),total=rows*each;
  return {kind:'cookies',skill:'cookies',level,mode:'rows',plan:'drag3',plates:rows,total,baked:total,eaten:0,leftover:0,answer:each,max:total,prompt:rowsPrompt(total,rows),fingerprint:JSON.stringify(['cookies','rows',rows,total])};
 }
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
export function validCookieDraft(draft,total,slots){
 return Array.isArray(draft)&&draft.length===total&&draft.every(n=>n===null||Number.isInteger(n)&&n>=0&&n<slots);
}

export function cookieCounts(draft,plates){
 return Array.from({length:plates},(_,i)=>draft.filter(n=>n===i).length);
}

// The ask step: three big choices for the quotient, in a shuffled order that is
// stable for a question (so a refresh doesn't reshuffle).
export function askOptions(q){
 const a=q.answer,near=a>1?[a-1,a,a+1]:[a,a+1,a+2];
 let h=0;for(const ch of String(q.id||q.fingerprint))h=(h*31+ch.charCodeAt(0))>>>0;
 return near.map(v=>[(h=(h*1103515245+12345)>>>0),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
}
export function bagsValid(draft,q){
 const counts=cookieCounts(draft,q.plates);
 return counts.every(n=>n<=q.bagSize);
}
