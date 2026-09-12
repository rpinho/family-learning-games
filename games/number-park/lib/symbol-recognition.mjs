import {drawingVector,inkStats,recognizeDrawing,DOODLES} from './doodle.mjs';
import {sunFeatures,flowerFeatures} from './picture-features.mjs';
export const GUESS_MODES=['auto','letters','numbers','pictures'];
export const UPPER=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],LOWER=UPPER.map(x=>x.toLowerCase()),DIGITS=[...'0123456789'];
export const validArtLabel=x=>typeof x==='string'&&(DOODLES.includes(x)||x==='something else'||/^[A-Za-z]$/.test(x)||/^\d{1,3}$/.test(x)&&Number(x)<=100&&String(Number(x))===x);
export const labelName=x=>/^[A-Z]$/.test(x)?'Uppercase '+x:/^[a-z]$/.test(x)?'Lowercase '+x:/^\d{1,3}$/.test(x)?'Number '+x:x;
export const guessLine=x=>/^[A-Za-z]$/.test(x)?'Is it the letter '+x.toUpperCase()+'?':/^\d{1,3}$/.test(x)?'Is it '+x+'?':'Is it a '+x+'?';
export const labelLine=x=>/^[A-Za-z]$/.test(x)?'The letter '+x.toUpperCase()+'.':/^\d{1,3}$/.test(x)?x:'Thanks for telling me!';
export const symbolVoiceLines=()=>[...UPPER.flatMap(x=>[guessLine(x),labelLine(x)]),...Array.from({length:101},(_,n)=>guessLine(String(n))),'Could it be one of these?','Try a number from zero to one hundred.'];
export function symbolScores(ink,model,mode='auto'){
 const v=drawingVector(ink);if(!v)return [];
 const norm=Math.sqrt(v.reduce((s,x)=>s+x*x,0)),best=new Map();
 for(const e of model.examples){if(mode==='numbers'&&!/^\d$/.test(e.label)||mode==='letters'&&!/^[A-Za-z]$/.test(e.label))continue;let dot=0;for(let i=0;i<v.length;i++)dot+=v[i]*e.vector[i];const score=dot/(norm*e.norm);if(score>(best.get(e.label)||0))best.set(e.label,score);}
 return [...best].map(([label,score])=>({label,score})).sort((a,b)=>b.score-a.score);
}
// Only separate non-overlapping left-to-right digits. Never claim to read words,
// connected cursive numbers or expressions. Each group is independently read.
export function digitGroups(ink){
 const b=inkStats(ink);if(!b)return [];
 const spans=ink.filter(s=>s.length).map(s=>({ink:[s],...inkStats([s])})).sort((a,b)=>a.x-b.x),groups=[];
 for(const s of spans){const g=groups.at(-1);if(g&&s.x<=g.right+Math.max(1,b.h*.08)){g.ink.push(...s.ink);g.right=Math.max(g.right,s.x+s.w);}else groups.push({ink:s.ink,right:s.x+s.w});}
 return groups.map(g=>g.ink);
}
export function recognizeArt(ink,pictureModel,symbolModel,mode='auto'){
 if(!GUESS_MODES.includes(mode))throw Error('Choose a guessing mode.');
 const version='art-symbols-4',b=inkStats(ink);
 if(!b||!drawingVector(ink))return {label:null,candidates:[],reason:'more-ink',model:version,mode};
 const picture=mode==='auto'||mode==='pictures'?recognizeDrawing(ink,pictureModel):null;
 const flower=picture?.candidateScores?.find(x=>x.label==='flower'&&x.score>=.70&&x.score>=picture.candidateScores[0].score-.05)&&flowerFeatures(ink);
 if(flower)return {label:'flower',candidates:['flower'],reason:'guess',model:version,mode,evidence:flower,similarity:picture.similarity};
 const sun=picture?.candidateScores?.find(x=>x.label==='sun'&&x.score>=.62)&&sunFeatures(ink);
 if(sun)return {label:'sun',candidates:['sun'],reason:'guess',model:version,mode,evidence:sun,similarity:picture.similarity};
 if(mode==='pictures')return {...picture,mode};
 if(mode!=='letters'){
  const groups=digitGroups(ink);
  if(groups.length>=2&&groups.length<=3){
   const choices=groups.map(g=>symbolScores(g,symbolModel,'numbers'));
   const solid=choices.every(c=>c[0]?.score>=.78&&c[0].score-(c[1]?.score||0)>=.035);
   if(solid){const label=choices.map(c=>c[0].label).join('');if(validArtLabel(label))return {label,candidates:[label],reason:'guess',model:version,mode,similarity:Math.min(...choices.map(c=>c[0].score)),segmented:true};if(mode==='numbers')return {label:null,candidates:[],reason:'number-range',model:version,mode};}
   if(mode==='numbers'&&choices.every(c=>c[0]?.score>=.68)){
    let combos=[{label:'',score:0}];for(const c of choices)combos=combos.flatMap(a=>c.slice(0,3).map(b=>({label:a.label+b.label,score:a.score+b.score}))).sort((a,b)=>b.score-a.score).slice(0,9);
    return {label:null,candidates:combos.map(c=>c.label).filter(validArtLabel).slice(0,4),reason:'unsure',model:version,mode,segmented:true};
   }
  }
 }
 const scores=symbolScores(ink,symbolModel,mode);
 if(mode==='auto'){
  scores.push(...(picture.candidateScores||[]));
  scores.sort((a,b)=>b.score-a.score);
 }
 const top=scores[0];
 const candidates=scores.filter(x=>x.score>=Math.max(.62,top.score-.07)).slice(0,4).map(x=>x.label);
 // Keep plausible picture alternatives visible when letter prototypes also fit.
 if(mode==='auto')for(const x of scores.filter(x=>DOODLES.includes(x.label)&&x.score>=Math.max(.65,top.score-.07)).slice(0,2))if(!candidates.includes(x.label))candidates.push(x.label);
 if(mode==='auto'){const digit=scores.find(x=>/^\d$/.test(x.label));if(digit&&digit.score>=Math.max(.70,top.score-.10)&&!candidates.includes(digit.label))candidates.push(digit.label);}
 // A stroke cannot determine whether the writer intended I/l/1 or O/o/0.
 // Surface that ambiguity instead of pretending a high similarity is certainty.
 const round=['O','o','0','circle'],vertical=['I','l','1'];
 if(round.includes(top.label)||vertical.includes(top.label)){
  const family=round.includes(top.label)?round:vertical;
  for(const label of family){if((mode==='numbers'?!/^\d$/.test(label):mode==='letters'?!/^[A-Za-z]$/.test(label):false))continue;if(!candidates.includes(label))candidates.push(label);}
 }
 const identity=x=>/^[A-Za-z]$/.test(x)?'letter:'+x.toUpperCase():x;
 const next=scores.find(x=>identity(x.label)!==identity(top.label));
 const confident=top.score>=.75&&top.score-(next?.score||0)>=.035&&new Set(candidates.map(identity)).size===1&&b.length/Math.max(b.w,b.h)<30;
 const caseAmbiguous=confident&&candidates.length>1&&/^[A-Za-z]$/.test(top.label);
 // Retain raw case candidates in the log; the spoken guess is letter identity,
 // not evidence that the child wrote a particular upper/lowercase form.
 return {label:confident?(caseAmbiguous?top.label.toUpperCase():top.label):null,candidates:top.score>=.62?candidates:[],caseAmbiguous,reason:confident?'guess':'unsure',similarity:top.score,model:version,mode};
}
