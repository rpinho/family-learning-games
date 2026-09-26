import {COOKIE_GAME,cookieQuestion,COOKIE_MAX_LEVEL} from './cookie-division.mjs';
import {buildQuestion} from './place-build.mjs';
export const EXPLORER_TRACK='explorer-math-1';
export const EXPLORER_GAMES=[
 {id:'mix',icon:'🚀',title:'Math mission',description:'Multiplication, sums and number puzzles.'},
 {id:'multiply',icon:'✖️',title:'Times-table challenge',description:'Multiply. Start with the 2–10 tables.'},
 {id:'factor',icon:'🔐',title:'Factor detective',description:'Find the missing number in a multiplication.'},
 {id:'sums',icon:'⚡',title:'Number builder',description:'Two-digit addition and subtraction.'},
 {id:'skip',icon:'🦘',title:'Number jumps',description:'Find the next number in a counting pattern.'},
 {id:'place',icon:'🏗️',title:'Tens & ones',description:'Build numbers with blocks. Decode their place values.'},
 COOKIE_GAME
];
export const advanced=p=>p.id==='explorer';
// Only this track's attempts inform its difficulty, independently per skill.
// Neither old preschool play nor guided tracing can establish mastery here.
export function challengeLevel(p,skill){
 if(skill==='cookies'){
  // Credit old sharing success once, without promoting twice from the same
  // short lesson. New drag rounds then drive this skill in either direction.
  const oldWins=(p.history||[]).filter(h=>h.question?.track===EXPLORER_TRACK&&h.question.skill==='cookies'&&h.question.plan!=='drag3'&&(!h.question.mode||h.question.mode==='share')&&h.ok&&!h.helped).length;
  let level=oldWins>=4?2:1,streak=0,struggles=0;
  for(const h of p.history||[]){
   if(h.question?.track!==EXPLORER_TRACK||h.question.skill!=='cookies'||h.question.plan!=='drag3')continue;
   if(h.ok&&!h.helped){streak++;struggles=0;if(streak>=4){level=Math.min(COOKIE_MAX_LEVEL,level+1);streak=0;}}
   else{streak=0;struggles++;if(struggles>=2){level=Math.max(1,level-1);struggles=0;}}
  }
  return level;
 }
 let level=2,streak=0,struggles=0;
 for(const h of p.history||[]){
  if(h.question?.track!==EXPLORER_TRACK||h.question.skill!==skill)continue;
  if(h.ok&&!h.helped){streak++;struggles=0;if(streak===6){level=Math.min(3,level+1);streak=0;}}
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
 if(skill==='cookies'){
  for(let trial=0;trial<40;trial++){
   q={track:EXPLORER_TRACK,...cookieQuestion(level,r)};
   if(!(p.recent||[]).includes(q.fingerprint))break;
  }
  q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
 }
 for(let trial=0;trial<120;trial++){
  const base={track:EXPLORER_TRACK,skill,level,max:200};
  if(skill==='multiply'||skill==='factor'){
   const factors=level===1?[2,5,10]:Array.from({length:level===3?11:9},(_,i)=>i+2);
   const a=factors[roll(factors.length)],b=2+roll(level===1?4:level===3?11:9),total=a*b;
   const blank=skill==='factor'?roll(2):2,answer=[a,b,total][blank];
   q={...base,kind:skill,a,b,total,blank,operator:'×',answer,max:144,prompt:skill==='factor'?'Find the missing factor.':'Multiply these numbers.'};
   q.options=options(answer,144,r,blank===2?[total+a,total-a,a+b]:[answer-1,answer+1,answer+2]);
  }else if(skill==='sums'){
   const ceiling=level===1?50:level===2?100:200,total=20+roll(ceiling-19),a=10+roll(total-10),b=total-a;
   const minus=roll(2)===0,blank=level===3?roll(3):2;
   const numbers=minus?[total,b,a]:[a,b,total],answer=numbers[blank];
   q={...base,kind:'sums',a:numbers[0],b:numbers[1],total:numbers[2],operator:minus?'−':'+',blank,answer,max:ceiling,prompt:'Find the missing number.'};
   q.options=options(answer,ceiling,r,[answer-10,answer+10,answer-1,answer+1]);
  }else if(skill==='skip'){
   const steps=level===1?[2,5,10]:level===2?[2,3,4,5,6,7,8,9,10]:[3,4,6,7,8,9,11,12];
   const step=steps[roll(steps.length)],start=step*(level===1?roll(3):1+roll(7));
   const sequence=Array.from({length:4},(_,i)=>start+i*step),answer=start+4*step;
   q={...base,kind:'skip',sequence,step,answer,prompt:'Count in equal jumps. What comes next?'};
   q.options=options(answer,200,r,[answer-step,answer+step,answer+1]);
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
  q.fingerprint=JSON.stringify([q.track,skill,q.a,q.b,q.blank,q.operator,q.sequence,q.tens,q.ones,q.placeMode,q.target]);
  if(!(p.recent||[]).includes(q.fingerprint))break;
 }
 q.id=`${p.revision}:${p.history.length}:${round}:f1`;return q;
}
