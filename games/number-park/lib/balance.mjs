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
const expressionSpeech=e=>[String(e.a),e.op==='×'?'times':e.op==='−'?'minus':'plus',String(e.b)];
const animalComparison=q=>`${animalName(q.answer===0?q.left:q.right)} is ${q.direction}.`;
export function balancePrompt(q){
 if(q.mode==='animals')return [q.prompt,`${animalName(q.left)}.`,`${animalName(q.right)}.`];
 return [q.prompt,'On the left.',...expressionSpeech(q.left),'On the right.',String(q.right.a),q.right.op==='×'?'times':q.right.op==='−'?'minus':'plus',q.mode==='complete'?'What number?':String(q.right.b)];
}
export function balanceFeedback(q,result){
 if(q.mode==='animals')return [animalComparison(q),q.direction==='lighter'?'The lighter side goes up.':'The heavier side goes down.'];
 if(q.mode==='complete'&&!result.ok)return ['Use this number to balance.',String(result.answer)];
 return [q.left.value===q.right.value?'Both sides are equal.':'The heavier side goes down.'];
}
export const BALANCE_HELP='Work out each side. Equal weights balance. The heavier side goes down.';
export function balanceVoiceLines(){return ['Which is lighter?','Which is heavier?','Which side is heavier?','What number makes it balance?','On the left.','On the right.','times','plus','minus','What number?','The lighter side goes up.','The heavier side goes down.','Both sides are equal.','Use this number to balance.',BALANCE_HELP,...ANIMALS.flatMap(a=>[`${animalName(a)}.`,animalLine(a),`${animalName(a)} is lighter.`,`${animalName(a)} is heavier.`])];}
