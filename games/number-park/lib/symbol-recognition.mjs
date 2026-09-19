import {drawingVector,inkStats,recognizeDrawing,DOODLES,PICTURE_LABELS} from './doodle.mjs';
import {sunFeatures,flowerFeatures,bareTreeFeatures,peopleGroupFeatures} from './picture-features.mjs';
export const GUESS_MODES=['auto','letters','words','numbers','pictures'];
export const UPPER=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],LOWER=UPPER.map(x=>x.toLowerCase()),DIGITS=[...'0123456789'];
export const MAX_GUESS_NUMBER=999999;
export const KNOWN_WORDS=['ROOK','CASTLE'];
const numberLabel=x=>/^\d{1,6}$/.test(x)&&Number(x)<=MAX_GUESS_NUMBER&&String(Number(x))===x;
const wordLabel=x=>/^[A-Za-z]{2,12}$/.test(x);
const prettyWord=x=>x[0].toUpperCase()+x.slice(1).toLowerCase();
const prettyNumber=x=>Number(x).toLocaleString('en-US');
export const validArtLabel=x=>typeof x==='string'&&(PICTURE_LABELS.includes(x)||x==='something else'||/^[A-Za-z]$/.test(x)||wordLabel(x)||numberLabel(x));
export const labelName=x=>/^[A-Z]$/.test(x)?'Uppercase '+x:/^[a-z]$/.test(x)?'Lowercase '+x:numberLabel(x)?'Number '+prettyNumber(x):wordLabel(x)?'Word '+prettyWord(x):x;
export const guessLine=x=>/^[A-Za-z]$/.test(x)?'Is it the letter '+x.toUpperCase()+'?':numberLabel(x)?'Is it '+prettyNumber(x)+'?':wordLabel(x)?'Does it say '+prettyWord(x)+'?':x==='two people'?'Are they two people?':'Is it a '+x+'?';
export const labelLine=x=>/^[A-Za-z]$/.test(x)?'The letter '+x.toUpperCase()+'.':numberLabel(x)?prettyNumber(x)+'.':wordLabel(x)?'You wrote '+prettyWord(x)+'.':'Thanks for telling me!';
export const guessVoiceLines=x=>wordLabel(x)&&!KNOWN_WORDS.includes(x.toUpperCase())?['I see the word.',...[...x.toUpperCase()].map(c=>'Letter '+c+'.')]:numberLabel(x)&&Number(x)>100?['I see the number.',...[...x].map(c=>c)]:[guessLine(x)];
export const labelVoiceLines=x=>wordLabel(x)&&!KNOWN_WORDS.includes(x.toUpperCase())?['You wrote a word.',...[...x.toUpperCase()].map(c=>'Letter '+c+'.')]:numberLabel(x)&&Number(x)>100?['You wrote a big number.',...[...x].map(c=>c)]:[labelLine(x)];
export const symbolVoiceLines=()=>[...UPPER.flatMap(x=>[guessLine(x),labelLine(x),'Letter '+x+'.']),...Array.from({length:101},(_,n)=>guessLine(String(n))),...DIGITS,...KNOWN_WORDS.flatMap(x=>[guessLine(x),labelLine(x)]),'Could it be one of these?','Try drawing the digits with a little space between them.','I see the word.','You wrote a word.','I see the number.','You wrote a big number.'];
export function symbolScores(ink,model,mode='auto'){
 const v=drawingVector(ink);if(!v)return [];
 const norm=Math.sqrt(v.reduce((s,x)=>s+x*x,0)),best=new Map();
 for(const e of model.examples){if(mode==='numbers'&&!/^\d$/.test(e.label)||['letters','words'].includes(mode)&&!/^[A-Za-z]$/.test(e.label))continue;let dot=0;for(let i=0;i<v.length;i++)dot+=v[i]*e.vector[i];const score=dot/(norm*e.norm);if(score>(best.get(e.label)||0))best.set(e.label,score);}
 return [...best].map(([label,score])=>({label,score})).sort((a,b)=>b.score-a.score);
}
// Separate left-to-right printed characters. Connected cursive and touching
// characters remain deliberately out of scope; each group is read on its own.
export function symbolGroups(ink){
 const b=inkStats(ink);if(!b)return [];
 const spans=ink.filter(s=>s.length).map(s=>({ink:[s],...inkStats([s])})).sort((a,b)=>a.x-b.x),groups=[];
 for(const s of spans){
  const g=groups.at(-1),right=s.x+s.w,overlap=g?Math.min(g.right,right)-Math.max(g.left,s.x):-Infinity,narrow=g?Math.min(g.right-g.left,s.w):0;
  // Strokes within one character substantially overlap along x. A tiny touch
  // between two one-stroke characters (a common closed-top 44) stays split.
  const endpointTouch=g&&g.ink.some(stroke=>stroke.length&&s.ink[0]?.length&&[stroke[0],stroke.at(-1)].some(a=>[s.ink[0][0],s.ink[0].at(-1)].some(z=>Math.hypot(a[0]-z[0],a[1]-z[1])<=Math.max(1.5,b.h*.025))));
  const joins=g&&(overlap>=Math.max(.75,narrow*.12)||narrow<1.5&&overlap>=-.75||endpointTouch);
  if(joins){g.ink.push(...s.ink);g.left=Math.min(g.left,s.x);g.right=Math.max(g.right,right);}else groups.push({ink:s.ink,left:s.x,right});
 }
 // Ignore a free-standing comma or dot between full-height glyphs. Dots that
 // belong to i/j overlap their stem and are already in that glyph's group.
 return groups.map(g=>g.ink).filter((g,i,a)=>{const s=inkStats(g);return a.length<3||s.h>=b.h*.2||s.w>=b.h*.12||g.reduce((n,x)=>n+x.length,0)>=5;});
}
export const digitGroups=symbolGroups;
function identityChoices(group,model,kind){
 const by=new Map();
 for(const item of symbolScores(group,model,kind)){const label=kind==='words'?item.label.toUpperCase():item.label;if(item.score>(by.get(label)||0))by.set(label,item.score);}
 const b=inkStats(group),stroke=group.length===1&&group[0];
 if(b&&stroke?.length>4&&Math.hypot(stroke[0][0]-stroke.at(-1)[0],stroke[0][1]-stroke.at(-1)[1])<=Math.max(b.w,b.h)*.22){const round=kind==='words'?'O':'0';by.set(round,Math.max(.82,by.get(round)||0));}
 if(kind==='numbers'&&b&&stroke?.length>8){
  const top=stroke.reduce((best,p,i)=>p[1]<stroke[best][1]?i:best,0),left=stroke.reduce((best,p,i)=>p[0]<stroke[best][0]?i:best,0),start=stroke[0],end=stroke.at(-1);
  const four=start[1]>=b.y+b.h*.72&&start[0]>=b.x+b.w*.3&&start[0]<=b.x+b.w*.8&&top<stroke.length*.55&&left>top&&end[0]>=b.x+b.w*.7&&end[1]>=b.y+b.h*.35&&end[1]<=b.y+b.h*.78;
  if(four)by.set('4',Math.max(.86,by.get('4')||0));
 }
 return [...by].map(([label,score])=>({label,score})).sort((a,b)=>b.score-a.score);
}
function readSequence(groups,model,kind){
 const choices=groups.map(g=>identityChoices(g,model,kind));
 const solid=choices.every(c=>c[0]?.score>=.74&&c[0].score-(c[1]?.score||0)>=.025);
 return {solid,label:solid?choices.map(c=>c[0].label).join(''):null,choices,similarity:choices.length?Math.min(...choices.map(c=>c[0]?.score||0)):0};
}
function knownWord(sequence){
 const matches=KNOWN_WORDS.filter(word=>word.length===sequence.choices.length).map(word=>{
  const scores=sequence.choices.map((choices,i)=>choices.find(x=>x.label===word[i])?.score||0);
  const tops=sequence.choices.filter((choices,i)=>choices[0]?.label===word[i]).length;
  return {word,scores,tops,average:scores.reduce((n,x)=>n+x,0)/scores.length};
 }).filter(x=>x.scores.every(score=>score>=.45)&&x.average>=.72&&x.tops>=x.scores.length-1).sort((a,b)=>b.average-a.average);
 return matches[0]&&(!matches[1]||matches[0].average-matches[1].average>=.025)?matches[0]:null;
}
export function recognizeArt(ink,pictureModel,symbolModel,mode='auto'){
 if(!GUESS_MODES.includes(mode))throw Error('Choose a guessing mode.');
 const version='art-symbols-7',b=inkStats(ink);
 if(!b||!drawingVector(ink))return {label:null,candidates:[],reason:'more-ink',model:version,mode};
 const picture=mode==='auto'||mode==='pictures'?recognizeDrawing(ink,pictureModel):null;
 const groups=symbolGroups(ink),sequences=[];
 if(['auto','numbers'].includes(mode)&&groups.length>=2&&groups.length<=6)sequences.push({kind:'numbers',...readSequence(groups,symbolModel,'numbers')});
 if(['auto','words'].includes(mode)&&groups.length>=2&&groups.length<=12)sequences.push({kind:'words',...readSequence(groups,symbolModel,'words')});
 const wordSequence=sequences.find(x=>x.kind==='words'),numberSequence=sequences.find(x=>x.kind==='numbers'),known=wordSequence&&knownWord(wordSequence);
 if(known)return {label:known.word,candidates:[known.word],reason:'guess',model:version,mode,similarity:known.average,segmented:true,sequence:'known-word'};
 const sequence=(mode==='words'?[wordSequence]:mode==='numbers'?[numberSequence]:[]).filter(x=>x?.solid&&validArtLabel(x.label)).sort((a,b)=>b.similarity-a.similarity)[0];
 if(sequence)return {label:sequence.label,candidates:[sequence.label],reason:'guess',model:version,mode,similarity:sequence.similarity,segmented:true,sequence:sequence.kind};
 const group=picture&&peopleGroupFeatures(ink);
 if(group)return {label:'family picture',candidates:['family picture','two people','family portrait'],reason:'guess',model:version,mode,evidence:group,similarity:picture.similarity};
 const tree=picture?.candidateScores?.[0]?.label==='tree'&&picture.candidateScores[0].score>=.75&&bareTreeFeatures(ink);
 if(tree)return {label:'tree',candidates:['tree'],reason:'guess',model:version,mode,evidence:tree,similarity:picture.similarity};
 const flower=picture?.candidateScores?.find(x=>x.label==='flower'&&x.score>=.70&&x.score>=picture.candidateScores[0].score-.05)&&flowerFeatures(ink);
 if(flower)return {label:'flower',candidates:['flower'],reason:'guess',model:version,mode,evidence:flower,similarity:picture.similarity};
 const sun=picture?.candidateScores?.find(x=>x.label==='sun'&&x.score>=.62)&&sunFeatures(ink);
 if(sun)return {label:'sun',candidates:['sun'],reason:'guess',model:version,mode,evidence:sun,similarity:picture.similarity};
 if(mode==='pictures')return {...picture,mode};
 if(mode==='auto'){
  const autoSequence=[numberSequence,wordSequence].filter(x=>x?.solid&&validArtLabel(x.label)).sort((a,b)=>b.similarity-a.similarity)[0];
  if(autoSequence)return {label:autoSequence.label,candidates:[autoSequence.label],reason:'guess',model:version,mode,similarity:autoSequence.similarity,segmented:true,sequence:autoSequence.kind};
 }
 if(mode==='numbers'&&groups.length>6)return {label:null,candidates:[],reason:'number-range',model:version,mode};
 if(mode==='numbers'&&sequences[0]?.choices.every(c=>c[0]?.score>=.68)){
  let combos=[{label:'',score:0}];for(const c of sequences[0].choices)combos=combos.flatMap(a=>c.slice(0,3).map(b=>({label:a.label+b.label,score:a.score+b.score}))).sort((a,b)=>b.score-a.score).slice(0,9);
  return {label:null,candidates:combos.map(c=>c.label).filter(validArtLabel).slice(0,4),reason:'unsure',model:version,mode,segmented:true};
 }
 if(mode==='words')return {label:null,candidates:[],reason:'unsure',model:version,mode,segmented:groups.length>1};
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
  for(const label of family){if((mode==='numbers'?!/^\d$/.test(label):['letters','words'].includes(mode)?!/^[A-Za-z]$/.test(label):false))continue;if(!candidates.includes(label))candidates.push(label);}
 }
 const identity=x=>/^[A-Za-z]$/.test(x)?'letter:'+x.toUpperCase():x;
 const next=scores.find(x=>identity(x.label)!==identity(top.label));
 const confident=top.score>=.75&&top.score-(next?.score||0)>=.035&&new Set(candidates.map(identity)).size===1&&b.length/Math.max(b.w,b.h)<30;
 const caseAmbiguous=confident&&candidates.length>1&&/^[A-Za-z]$/.test(top.label);
 // Retain raw case candidates in the log; the spoken guess is letter identity,
 // not evidence that the child wrote a particular upper/lowercase form.
 return {label:confident?(caseAmbiguous?top.label.toUpperCase():top.label):null,candidates:top.score>=.62?candidates:[],caseAmbiguous,reason:confident?'guess':'unsure',similarity:top.score,model:version,mode};
}
