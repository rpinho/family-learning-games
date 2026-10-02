import {COOKIE_GAME,cookieQuestion,COOKIE_MAX_LEVEL,FADE,STAGE_WINS,MASTERY_RUN} from './cookie-division.mjs';
import {buildQuestion} from './place-build.mjs';
import {worthQuestion} from './place-worth.mjs';
import {numberNameReview} from './number-names.mjs';
import {balanceQuestion} from './balance.mjs';
export const EXPLORER_TRACK='explorer-math-1';
export const EXPLORER_GAMES=[
 {id:'mix',icon:'🚀',title:'Math mission',description:'Multiplication, sums and number puzzles.'},
 {id:'multiply',icon:'✖️',title:'Times-table challenge',description:'Multiply. Start with the 2–10 tables.'},
 {id:'factor',icon:'🔐',title:'Factor detective',description:'Find the missing number in a multiplication.'},
 {id:'sums',icon:'⚡',title:'Number builder',description:'Two-digit addition and subtraction.'},
 {id:'skip',icon:'🦘',title:'Number jumps',description:'Find the next number in a counting pattern.'},
 {id:'place',icon:'🏗️',title:'Tens & ones',description:'Build numbers with blocks. What is each digit worth?'},
 COOKIE_GAME,
 {id:'balance',icon:'⚖️',title:'Balance scale',description:'Compare animals and make the numbers balance.'}
];
export const advanced=p=>p.id==='explorer';
// Only this track's attempts inform its difficulty, independently per skill.
// Neither old preschool play nor guided tracing can establish mastery here.
const cookieRow=h=>h.question?.track===EXPLORER_TRACK&&h.question.skill==='cookies';
// Cookie division progress: a level (1-6) and a help stage inside it.
// Rounds saved before fading help existed (no question.fade) keep the old
// ladder, so the level he had reached is never taken away; faded rounds then
// move him through show -> hide -> own, and the quiet mastery check (five
// clean rounds in a row on his own) moves him up a level.
// A round won with only a Help tap (no uneven check, no wrong answer) is not a
// struggle: it earns no progress but never eases him. Two such taps had dropped
// Explorer from level 4 to 2, the level he had just called too easy.
const helpOnly=h=>h.helped&&h.cookieChecks===0;
export function cookieProgress(p){
 const history=p.history||[];
 const oldWins=history.filter(h=>cookieRow(h)&&h.question.plan!=='drag3'&&(!h.question.mode||h.question.mode==='share')&&h.ok&&!h.helped).length;
 let level=oldWins>=4?2:1,streak=0,struggles=0;
 for(const h of history){
  if(!cookieRow(h)||h.question.plan!=='drag3'||h.question.fade)continue;
  if(h.ok&&!h.helped){streak++;struggles=0;if(streak>=4){level=Math.min(5,level+1);streak=0;}}
  else if(h.ok&&helpOnly(h))streak=0;
  else{streak=0;struggles++;if(struggles>=2){level=Math.max(1,level-1);struggles=0;}}
 }
 let stage=0,clean=0,rough=0,mastered=0;
 for(const h of history){
  if(!cookieRow(h)||!h.question.fade)continue;
  if(h.ok&&!h.helped){
   clean++;rough=0;
   if(stage<2&&clean>=STAGE_WINS){stage++;clean=0;}
   else if(stage===2&&clean>=MASTERY_RUN){mastered++;clean=0;if(level<COOKIE_MAX_LEVEL){level++;stage=0;}}
  }else if(h.ok&&helpOnly(h))clean=0;
  else{
   clean=0;rough++;
   if(rough>=2){rough=0;if(stage>0)stage--;else if(level>1){level--;stage=1;}}
  }
 }
 return {level,stage,fade:FADE[stage],clean,mastered,toMastery:stage===2?MASTERY_RUN-clean:null};
}
// Challenge skills support levels 1–5 and explicit Easier/Harder choices.
// Rushed taps reset a streak without treating them as a difficulty mismatch.
export const CHALLENGE_MAX=5,CHALLENGE_SKILLS=['multiply','factor','sums','skip','balance'];
export const CHALLENGE_START={multiply:2,factor:2,sums:2,skip:2,balance:2};
export const RUSH_MS=2500;
const rushed=h=>!h.ok&&!h.helped&&Number.isFinite(h.durationMs)&&h.durationMs<RUSH_MS;
export const clampChallenge=n=>Math.max(1,Math.min(CHALLENGE_MAX,Math.round(Number(n))||1));
export function challengeLevel(p,skill){
 if(skill==='cookies')return cookieProgress(p).level;
 const rows=(p.history||[]).filter(h=>h.question?.track===EXPLORER_TRACK&&h.question.skill===skill);
 const max=CHALLENGE_SKILLS.includes(skill)?CHALLENGE_MAX:3;
 let level=CHALLENGE_START[skill]||2,start=0,streak=0,struggles=0;
 // An Easier/Harder choice (his or a grown-up's) applies at once; only later rounds adapt from it.
 const manual=p.challengeManual?.[skill];
 if(manual&&Number.isInteger(manual.level)){level=Math.min(max,clampChallenge(manual.level));start=Math.max(0,Math.min(rows.length,manual.after|0));}

 for(const h of rows.slice(start)){
  if(h.ok&&!h.helped){streak++;struggles=0;if(streak===6){level=Math.min(max,level+1);streak=0;}}
  else if(rushed(h))streak=0;
  else{streak=0;struggles++;if(struggles===2){level=Math.max(1,level-1);struggles=0;}}
 }
 return level;
}
const shuffle=(values,r)=>values.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
function options(answer,max,r,near=[]){
 const candidates=[...near,answer-1,answer+1,answer-2,answer+2,answer-10,answer+10];
 const valid=[...new Set(candidates)].filter(n=>Number.isInteger(n)&&n>=0&&n<=max&&n!==answer);
 for(let n=0;valid.length<3;n++)if(n!==answer&&!valid.includes(n))valid.push(n);
 return shuffle([answer,...valid.slice(0,3)],r);
}
export function challengeQuestion(p,game,round,r){
 const skills=['multiply','sums','factor','skip','place','multiply'];
 const skill=game==='mix'?skills[round%6]:({line:'sums',missing:'factor',count:'skip',addobjects:'multiply',subtract:'sums',pattern:'skip'}[game]||game);
 const level=challengeLevel(p,skill),roll=n=>Math.floor(r()*n);let q;
 if(skill==='balance'){
  for(let trial=0;trial<120;trial++){
   q={track:EXPLORER_TRACK,...balanceQuestion(level,round,r)};
   if(!(p.recent||[]).includes(q.fingerprint))break;
  }
  q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
 }
 // One listening item per six-question Tens & ones session. Its evidence is
 // separate from block-building and digit worth. After two clean checks of
 // every target, revisit only every third session.
 if(game==='place'&&round%6===2){
  const review=numberNameReview((p.history||[]).filter(h=>h.question?.track===EXPLORER_TRACK),r);
  if(!review.mastered||(p.completed?.place||0)%3===0){
   q={...review.question,track:EXPLORER_TRACK};
   q.fingerprint=JSON.stringify([q.track,q.skill,q.total]);
   q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
  }
 }
 if(skill==='cookies'){
  const {fade}=cookieProgress(p);
  for(let trial=0;trial<40;trial++){
   q={track:EXPLORER_TRACK,...cookieQuestion(level,r,fade)};

   if(!(p.recent||[]).includes(q.fingerprint))break;
  }
  q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
 }
 for(let trial=0;trial<120;trial++){
  const base={track:EXPLORER_TRACK,skill,level,max:200};
  if((skill==='multiply'||skill==='factor')&&level>=4){
   // Level 4: two-digit × one-digit (14 × 6). Level 5: bigger two-digit × one-digit (37 × 6), and
   // missing-factor questions shown as division (96 ÷ 8 = ?).
   const a=level===4?11+roll(9):21+roll(29),b=level===4?2+roll(8):3+roll(7),total=a*b;
   if(skill==='factor'&&level===5){
    q={...base,kind:'factor',a:total,b,total:a,blank:2,operator:'÷',answer:a,max:1000,prompt:'Share it out: how many in each group?'};
    q.options=options(a,1000,r,[a-1,a+1,a+10,a-10]);
   }else{
    const blank=skill==='factor'?roll(2):2,answer=[a,b,total][blank];
    q={...base,kind:skill,a,b,total,blank,operator:'×',answer,max:1000,prompt:skill==='factor'?'Find the missing factor.':'Multiply these numbers.'};
    q.options=options(answer,1000,r,blank===2?[total+b,total-b,total+10,a*(b+1)]:[answer-1,answer+1,answer+2]);
   }
  }else if(skill==='multiply'||skill==='factor'){
   const factors=level===1?[2,5,10]:Array.from({length:level===3?11:9},(_,i)=>i+2);
   const a=factors[roll(factors.length)],b=2+roll(level===1?4:level===3?11:9),total=a*b;
   const blank=skill==='factor'?roll(2):2,answer=[a,b,total][blank];
   q={...base,kind:skill,a,b,total,blank,operator:'×',answer,max:144,prompt:skill==='factor'?'Find the missing factor.':'Multiply these numbers.'};
   q.options=options(answer,144,r,blank===2?[total+a,total-a,a+b]:[answer-1,answer+1,answer+2]);
  }else if(skill==='sums'){
   // Level 4: up to 500, level 5: up to 1000; the missing number can be anywhere from level 3 up.
   const ceiling=[0,50,100,200,500,1000][level],floor=level>=4?100:20,total=floor+roll(ceiling-floor+1),a=10+roll(total-10),b=total-a;
   const minus=roll(2)===0,blank=level>=3?roll(3):2;
   const numbers=minus?[total,b,a]:[a,b,total],answer=numbers[blank];
   q={...base,kind:'sums',a:numbers[0],b:numbers[1],total:numbers[2],operator:minus?'−':'+',blank,answer,max:ceiling,prompt:'Find the missing number.'};
   q.options=options(answer,ceiling,r,[answer-10,answer+10,answer-1,answer+1,answer+100,answer-100]);
  }else if(skill==='skip'){
   // Level 4: jumps of 11, 12, 15, 25 from bigger starts. Level 5: jumps of 13-19 or 25, sometimes counting back.
   const steps=level===1?[2,5,10]:level===2?[2,3,4,5,6,7,8,9,10]:level===3?[3,4,6,7,8,9,11,12]:level===4?[11,12,15,25]:[13,14,16,17,18,19,25];
   const step=steps[roll(steps.length)],back=level===5&&roll(2)===0;
   const start=back?step*(8+roll(6)):step*(level===1?roll(3):1+roll(level>=4?12:7));
   const sequence=Array.from({length:4},(_,i)=>start+(back?-i:i)*step),answer=start+(back?-4:4)*step;
   q={...base,kind:'skip',sequence,step,answer,max:Math.max(200,answer+step*2),prompt:back?'Count back in equal jumps. What comes next?':'Count in equal jumps. What comes next?'};
   q.options=options(answer,q.max,r,[answer-step,answer+step,answer+1]);
  }else if(roll(5)<2){
   // Digit worth (its own skill and level): a digit's value by its place, and finding a place's digit.
   q={...base,...worthQuestion(challengeLevel(p,'worth'),r),track:EXPLORER_TRACK};
  }else if(level<3||roll(3)>0){
   // Block builder replaces the old "pick the number" mode, which was answered
   // in a few seconds every time; decoding a numeral into places is the skill.
   q={...base,...buildQuestion(level,r),track:EXPLORER_TRACK};
  }else{
   const tens=2+roll(8),ones=roll(10),total=tens*10+ones;
   const placeMode=level===3?['tens','ones'][roll(2)]:'number',answer=placeMode==='number'?total:placeMode==='tens'?tens:ones;
   q={...base,kind:'place',tens,ones,total,placeMode,answer,max:99,prompt:placeMode==='number'?'Build the number from tens and ones.':placeMode==='tens'?'How many tens?':'How many ones?'};
   q.options=options(answer,99,r,placeMode==='number'?[ones*10+tens,total-10,total+10]:[answer-1,answer+1,answer+2]);
  }
  q.fingerprint=JSON.stringify([q.track,skill,q.a,q.b,q.blank,q.operator,q.sequence,q.tens,q.ones,q.placeMode,q.target,q.digits,q.lit]);
  if(!(p.recent||[]).includes(q.fingerprint))break;
 }
 q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
}
