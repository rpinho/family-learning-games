import {SHAPES,validGuidedShape,nextShape} from './shapes.mjs';
import {validNumberTrace,nextTraceNumber,traceNumber,numberPaths,TRACE_MAX} from './number-trace.mjs';
import {validInk,checkCopy} from './copy-practice.mjs';
import {countingQuestion,countingOptions} from './counting.mjs';
import {patternQuestion} from './play-practice.mjs';
import {advanced,EXPLORER_GAMES,challengeQuestion} from './explorer.mjs';
import {readingAction} from './reading.mjs';
import {artAction} from './art.mjs';
import {planningAction} from './planning.mjs';
export const VERSION='number-park-2026-09-15-menu-cleanup';
export const GAMES=[
 {id:'mix',icon:'🎲',title:'Little sums',description:'A mix just like the first unit.'},
 {id:'line',icon:'📏',title:'Number hop',description:'Slide to the missing number.'},
 {id:'missing',icon:'🧩',title:'Missing piece',description:'Find the number that fits.'},
 {id:'count',icon:'🍎',title:'Count & collect',description:'Bigger groups. Find what counts!'},
 {id:'addobjects',icon:'🧺',title:'Put together',description:'Join bigger groups. Count them all!'},
 {id:'subtract',icon:'➖',title:'Take away',description:'Move objects. Count what is left.'},
 {id:'pattern',icon:'🔷',title:'Pattern parade',description:'What comes next in the parade?'}
];
export const additionOnly=p=>p.id!=='explorer';
export const gamesFor=p=>advanced(p)?EXPLORER_GAMES:GAMES;
// Upgrade only the active prompt in memory. Existing scores, history, drawings
// and completed questions remain untouched; ordinary next writes persist it.
export function prepareProfile(p){
 // Old capped saves point at 100 even after completion; resume at 101 without
 // inventing a completion or changing any guided/copy counts.
 if(p.traceNext==='100'&&((p.guided?.['100']||0)>0||(p.copiedNumbers?.['100']||0)>0))p.traceNext='101';
 p.ceiling=advanced(p)?200:13;
 const s=p.session;if(!additionOnly(p)||!s||s.finished)return p;
 if(!s.result&&s.game!=='subtract'&&s.question.operator==='−'){
  s.question=makeQuestion(p,s.game,s.round);s.question.id+=':addition2';s.helped=false;
 }
 return p;
}
export const freshProfile=id=>({id,name:id==='admin'?'Admin':id==='beginner'?'Beginner':'Explorer',revision:0,xp:0,lessons:0,completed:{},recent:[],history:[],session:null,drawing:[],guided:{},ceiling:id==='explorer'?200:13});
export const random=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const shuffle=(a,r)=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
export function makeQuestion(p,game,round=0){
 const r=random((p.revision+1)*7919+(p.history.length+1)*101+round*37),max=13;
 if(advanced(p))return challengeQuestion(p,game,round,r);
 const roll=n=>Math.floor(r()*n);let q;
 for(let trial=0;trial<120;trial++){
  let kind=game==='mix'?['choice','line','missing','choice','line','missing'][round%6]:game;
  const total=1+roll(max),a=roll(total+1),b=total-a,blank=kind==='missing'?roll(2):kind==='line'?roll(3):2;
  q={kind,a,b,total,blank,operator:'+',answer:[a,b,total][blank],max};
  if(!additionOnly(p)&&['missing','line'].includes(kind)&&roll(3)===0)q={...q,a:total,b,total:a,operator:'−',answer:[total,b,a][blank]};
  if(kind==='addobjects'){const total=8+roll(6),lo=Math.max(3,total-7),hi=Math.min(7,total-3),a=lo+roll(hi-lo+1),b=total-a;q={kind,a,b,total,blank:2,operator:'+',answer:total,max:13,object:['🍎','⭐','⚽'][roll(3)]};}
  if(kind==='count')q=countingQuestion(r,round);
  if(kind==='subtract'){const total=3+roll(8),remove=1+roll(Math.min(5,total));q={kind,total,remove,answer:total-remove,max:10,object:['🍎','⭐','⚽'][roll(3)]};}
  if(kind==='pattern')q=patternQuestion(r,round,p);
  q.fingerprint=JSON.stringify([q.kind,q.a,q.b,q.blank,q.count,q.total,q.remove,q.sequence,q.object,...(q.kind==='count'?[q.mode,q.items,q.layoutSeed]:[])]);
  if(!p.recent.includes(q.fingerprint))break;
 }
 if(q.kind!=='pattern')q.options=shuffle([q.answer,...shuffle(Array.from({length:q.max+1},(_,i)=>i).filter(n=>n!==q.answer),r).slice(0,2)],r);
 if(['count','addobjects'].includes(q.kind))q.options=countingOptions(q.answer,r);
 q.id=`${p.revision}:${p.history.length}:${round}`;return q;
}
export function publicState(p){const state=structuredClone(p);if(state.session?.question&&!state.session.helped&&!state.session.result)delete state.session.question.answer;return state;}
export function action(p,input,now=Date.now(),services={}){
 if(!input||input.revision!==p.revision)throw Object.assign(Error('Another screen changed this game. Reload and try again.'),{status:409});
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(typeof input.kind==='string'&&input.kind.startsWith('plan_')){
  planningAction(p,input,now);
 }else if(typeof input.kind==='string'&&input.kind.startsWith('art_')){
  artAction(p,input,now,services);
 }else if(typeof input.kind==='string'&&input.kind.startsWith('reading_')){
  readingAction(p,input,now);
 }else if(input.kind==='start'){
  if(!gamesFor(p).some(g=>g.id===input.game))fail('Choose a listed game.');
  p.session={game:input.game,round:0,correct:0,independent:0,helped:false,result:null,finished:false,started:now,question:makeQuestion(p,input.game)};
 }else if(input.kind==='hint'){
  const s=p.session;if(!s||s.finished||s.result)fail('No question to help with.');s.helped=true;
 }else if(input.kind==='answer'){
  const s=p.session;if(!s||s.finished||s.result||input.questionId!==s.question.id)fail('This question is already finished.');
  const q=s.question;if(q.kind==='pattern'?!q.options.includes(input.answer):!Number.isInteger(input.answer)||input.answer<0||input.answer>q.max)fail('Choose a valid answer.');
  if(q.kind==='subtract'&&input.removedIndices!==undefined&&(!Array.isArray(input.removedIndices)||input.removedIndices.length>q.total||new Set(input.removedIndices).size!==input.removedIndices.length||!input.removedIndices.every(i=>Number.isInteger(i)&&i>=0&&i<q.total)))fail('Invalid removed objects.');
  const ok=input.answer===q.answer,independent=ok&&!s.helped,xp=ok?(independent?10:4):0;
  s.result={ok,answer:q.answer,xp,helped:s.helped};p.xp+=xp;s.correct+=Number(ok);s.independent+=Number(independent);
  p.history.push({at:new Date(now).toISOString(),game:s.game,question:q,answer:input.answer,ok,helped:s.helped,durationMs:Math.max(0,Math.min(86400000,now-s.started))});p.history=p.history.slice(-2000);
  if(q.kind==='subtract'&&input.removedIndices!==undefined)p.history.at(-1).removedIndices=[...input.removedIndices];
  p.recent=[...p.recent,q.fingerprint].slice(-12);
 }else if(input.kind==='next'){
  const s=p.session;if(!s||s.finished||!s.result)fail('Finish this question first.');
  if(s.round===5){s.finished=true;p.lessons++;p.completed[s.game]=(p.completed[s.game]||0)+1;}
  else{s.round++;s.question=makeQuestion(p,s.game,s.round);s.helped=false;s.result=null;s.started=now;}
 }else if(input.kind==='drawing'){
  if(!validInk(input.strokes))fail('Drawing is too large or invalid.');
  p.drawing=input.strokes;
 }else if(input.kind==='trace'){
  if(input.practice!==undefined&&!['guided','copy'].includes(input.practice))fail('Choose a practice mode.');
  if(input.practice==='copy'?(!traceNumber(input.digit)||!checkCopy(numberPaths(input.digit),input.strokes).ok):!validNumberTrace(input.digit,input.strokes))fail('Finish tracing the number first.');
  // Guided practice is retained separately, never arithmetic mastery or a test.
  const counts=input.practice==='copy'?(p.copiedNumbers??={}):(p.guided??={});counts[input.digit]=(counts[input.digit]||0)+1;
  p.traceNext=nextTraceNumber(input.digit)??String(TRACE_MAX);
 }else if(input.kind==='shape'){
  if(input.practice!==undefined&&!['guided','copy'].includes(input.practice))fail('Choose a practice mode.');
  if(!Object.hasOwn(SHAPES,input.shape)||(input.practice==='copy'?!checkCopy(SHAPES[input.shape].paths,input.strokes).ok:!validGuidedShape(input.shape,input.strokes)))fail('Finish following the shape first.');
  const counts=input.practice==='copy'?(p.copiedShapes??={}):(p.shapes??={});counts[input.shape]=(counts[input.shape]||0)+1;
  p.shapeNext=nextShape(input.shape);
 }else fail('Unknown action.');
 p.ceiling=advanced(p)?200:13; // Beginner/Admin retain the parent's fixed small-number ceiling.
 p.revision++;return p;
}
