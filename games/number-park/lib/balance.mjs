import {roundRecap} from './recap.mjs';
import {STORY_OPENING,storyLine,PLACES as STORY_PLACES} from './story.mjs';
import {weightVoiceLines} from './balance-weights.mjs';
// Rounded illustrative adult weights, not a claim that every animal weighs the same.
// Species ranges: https://animaldiversity.org/accounts/ and
// https://animals.sandiegozoo.org/animals/ (fox, cat, panda, lion, elephant, etc.).
export const ANIMALS=[
 ['mouse','🐁',0.025],['hamster','🐹',0.12],['hedgehog','🦔',0.8],
 ['rabbit','🐇',2],['cat','🐈',4],['fox','🦊',6],['beagle','🐕',10],
 ['African penguin','🐧',3.5],['turkey','🦃',8],['koala','🐨',9],
 ['badger','🦡',12],['sheep','🐑',70],['pig','🐖',150],['giant panda','🐼',100],
 ['lion','🦁',190],['gorilla','🦍',160],['horse','🐎',500],['cow','🐄',650],
 ['giraffe','🦒',1000],['African elephant','🐘',5000]
].map(([name,emoji,kg])=>({name,emoji,kg}));
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const shuffle=(a,r)=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
export const evaluate=e=>e.op==='×'?e.a*e.b:e.op==='−'?e.a-e.b:e.a+e.b;
export const expression=(a,op,b)=>({a,op,b,value:evaluate({a,op,b})});
export const expressionText=e=>`${e.a} ${e.op} ${e.b}`;
const animalName=a=>`${/^[aeiou]/i.test(a.name)?'An':'A'} ${a.name}`;
export const animalLine=a=>`${animalName(a)} is about ${a.kg} kg.`;
export const sideAnswer=(left,right)=>left>right?0:left===right?1:2;
export function animalPairs(level){
 const [lo,hi]=[[10,Infinity],[4,10],[1.5,4],[1.15,2],[1,1.55]][level-1];
 return ANIMALS.flatMap((a,i)=>ANIMALS.slice(i+1).filter(b=>{
  const ratio=Math.max(a.kg,b.kg)/Math.min(a.kg,b.kg);return ratio>lo&&ratio<=hi;
 }).map(b=>[a,b]));
}
function multiply(level,r){
 const roll=n=>Math.floor(r()*n);
 const a=level>=5?21+roll(29):level===4?11+roll(9):2+roll(level===1?4:9);
 const b=level>=5?3+roll(7):2+roll(level===1?4:8);
 return expression(a,'×',b);
}
function sumTo(value,r){
 const a=Math.floor(value*(0.25+r()*0.5));return expression(a,'+',value-a);
}
export function balanceQuestion(level,round,r){
 const mode=['animals','compare','complete'][round%3],base={kind:'balance',skill:'balance',level,mode,max:1000};
 let q;
 if(mode==='animals'){
  const [left,right]=shuffle(pick(animalPairs(level),r),r);
  // Each round has one of each direction; lighter is never underrepresented.
  const direction=round%6===0?'lighter':'heavier';
  q={...base,left:{...left},right:{...right},direction,prompt:`Which is ${direction}?`,
   answer:direction==='heavier'?Number(right.kg>left.kg):Number(right.kg<left.kg),options:[0,1]};
 }else{
  let left=multiply(level,r);
  if(r()<0.35)left=sumTo(10+Math.floor(r()*([0,30,60,90,490,990][level])),r);
  if(mode==='compare'){
   const relation=Math.floor(r()*3),offset=relation===1?0:(relation===0?-1:1)*(1+Math.floor(r()*(level>=4?20:5)));
   const right=sumTo(Math.max(1,left.value+offset),r);
   q={...base,left,right,prompt:'Which side is heavier?',answer:sideAnswer(left.value,right.value),options:[0,1,2]};
  }else{
   const right=sumTo(left.value,r),answer=right.b;
   const near=[answer-1,answer+1,answer-10,answer+10,answer+2].filter(n=>n>=0&&n<=1000);
   q={...base,left,right,prompt:'What number makes it balance?',answer,options:shuffle([answer,...new Set(near)].slice(0,4),r)};
  }
 }
 q.fingerprint=JSON.stringify(['balance',mode,q.direction,q.left,q.right]);return q;
}
// Never reveal the physical result before the child's answer, including after Help.
export function balanceTilt(q,result){
 if(!result)return 0;
 const left=q.mode==='animals'?q.left.kg:q.left.value;
 const right=q.mode==='animals'?q.right.kg:q.mode==='complete'?q.right.a+(result.picked??result.answer):q.right.value;
 return left===right?0:left>right?-10:10;
}
export function balanceExplanation(q,result){
 if(q.mode==='animals')return `${animalLine(q.left)} ${animalLine(q.right)} ${animalComparison(q)}`;
 if(q.mode==='complete')return `${expressionText(q.left)} = ${q.left.value}. ${q.right.a} + ${result.answer} = ${q.left.value}.`;
 return `${expressionText(q.left)} = ${q.left.value}. ${expressionText(q.right)} = ${q.right.value}.`;
}
const animalComparison=q=>`${animalName(q.answer===0?q.left:q.right)} is ${q.direction}.`;
export const ANIMAL_PROMPT='Place an animal on each pan. Which pan do you think will go down? You can guess, then weigh them.';
export const animalPrompt=q=>`${animalName(q.left)} and ${animalName(q.right).toLowerCase()}. ${ANIMAL_PROMPT}`;
export const balanceObservationPrompt=q=>q.kinderBalance?'Who weighs more? Watch the scale, then tap the animal.':q.direction==='lighter'?'Which is lighter? Watch the scale, then tap the lighter animal.':'Which is heavier? Watch the scale, then tap the heavier animal.';
export const ANIMAL_OBSERVE='Watch the scale settle. The heavier pan goes down and the lighter pan goes up.';
const totalPrompt=w=>`The left pan weighs ${w.target}. Can you make the other side ${w.target}?`;
export function weightPrompt(w){
 if(w.mode==='free')return `Can you make each pan weigh ${w.target}? Drag weights onto both pans.`;
 const pair=w.label.match(/^(\d+) \+ (\d+)$/);
 if(pair&&w.target<=50)return `${Math.min(Number(pair[1]),Number(pair[2]))} plus ${Math.max(Number(pair[1]),Number(pair[2]))} is ${w.target}. Can you make the other side ${w.target}?`;
 const product=w.label.match(/^(\d+) × (\d+)$/);
 if(product)return `${product[1]} times ${product[2]} is ${w.target}. Can you make the other side ${w.target}?`;
 return totalPrompt(w);
}
export function balancePrompt(q){
 if(q.weights)return [weightPrompt(q.weights)];
 if(q.mode==='animals')return [animalPrompt(q)];
 return [q.mode==='complete'?'Work out the left side, then choose the missing number to make the scale balance.':'Work out both sides. Which side will go down, or will they balance?'];
}
export function balanceFeedback(q,result){
 if(q.weights&&result.draft)return ['Both pans have the same weight. You made the scale balance.'];
 if(q.mode==='animals')return [`${animalComparison({...q,answer:result.answer??q.answer})} ${q.direction==='lighter'?'The lighter pan goes up.':'The heavier pan goes down.'}`];
 if(q.mode==='complete'&&!result.ok)return ['Use the number shown to make both sides equal.'];
 return [q.left.value===q.right.value?'Both sides are equal. The pans are level.':'The heavier pan goes down. Watch the scale settle.'];
}
export const BALANCE_LEGACY_HELP='Work out each side. Equal weights balance. The heavier side goes down.';
export function balanceFinishVoiceLines(){
 const lines=new Set([STORY_OPENING,...STORY_PLACES.map((_,i)=>storyLine(i,'mission'))]);
 for(const player of ['explorer','beginner'])for(let correct=0;correct<=6;correct++)for(let independent=0;independent<=correct;independent++)for(const windDown of [false,true])for(const line of roundRecap({game:String(player).split('_')[0]==='beginner'?'balance-k':'balance',player,correct,independent,windDown}).lines)lines.add(line);
 return [...lines];
}
export const BALANCE_HELP='Place an animal on each pan, guess if you like, then weigh them. Watch which pan goes down.';
export function balanceVoiceLines(){
 const lines=[balanceObservationPrompt({kinderBalance:true}),balanceObservationPrompt({direction:'lighter'}),balanceObservationPrompt({direction:'heavier'}),...balanceFinishVoiceLines(),BALANCE_LEGACY_HELP,'Both pans have the same weight. You made the scale balance.',...weightVoiceLines(),ANIMAL_PROMPT,ANIMAL_OBSERVE,BALANCE_HELP,...balancePrompt({mode:'complete'}),...balancePrompt({mode:'compare'}),'Use the number shown to make both sides equal.','Both sides are equal. The pans are level.','The heavier pan goes down. Watch the scale settle.'];
 for(const a of ANIMALS)for(const direction of ['lighter','heavier'])lines.push(`${animalName(a)} is ${direction}. The ${direction} pan goes ${direction==='lighter'?'up':'down'}.`);
 // Exhaustive current puzzle domain, rather than samples from a seeded generator.
 for(let target=47;target<=200;target++)lines.push(totalPrompt({target}));
 const freeTargets=new Set(Array.from({length:189},(_,i)=>i+12));
 for(let a=21;a<=49;a++)for(let b=6;b<=9;b++)freeTargets.add(a*b);
 for(const target of freeTargets)lines.push(weightPrompt({mode:'free',target}));
 for(let target=12;target<=50;target++)for(let a=3;a<=Math.floor(target/2);a++)lines.push(weightPrompt({mode:'fixed',target,label:`${a} + ${target-a}`}));
 for(let a=6;a<=9;a++)for(let b=2;b<=5;b++)lines.push(weightPrompt({mode:'fixed',target:a*b,label:`${a} × ${b}`}));
 for(let a=21;a<=49;a++)for(let b=6;b<=9;b++)lines.push(weightPrompt({mode:'fixed',target:a*b,label:`${a} × ${b}`}));
 for(const left of ANIMALS)for(const right of ANIMALS)if(left.name!==right.name)lines.push(animalPrompt({left,right}));
 return [...new Set(lines)];
}
