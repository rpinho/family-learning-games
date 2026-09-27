// Digit worth (Tens & ones). A tutor's session reports showed the older player
// answering a digit's face value (the 9 in 90 is "9") and missing "which digit is in
// the ones/hundreds place", while building numbers from blocks was solid. Two
// question modes, mixed into the block builder:
//  worth: one digit is lit; pick what it is worth (7 / 70 / 700 / 7,000).
//  which: "Which digit is in the tens place?"; tap that digit in the numeral.
// A miss shows the column: place names under the digits and the digit as blocks.
export const WORTH_PLACES=['ones','tens','hundreds','thousands']; // index = place from the right
const PLACE_ONE=['one','ten','hundred','thousand'];
export const WORTH_HELP='Look at the place name under each digit.';
export const worthPrompt=digit=>`What is this ${digit} worth?`;
export const whichPrompt=place=>`Which digit is in the ${WORTH_PLACES[place]} place?`;
export const worthExplain=(digit,place)=>`This ${digit} is in the ${WORTH_PLACES[place]} place. It is worth ${digit*10**place}.`;
export const worthUnits=(digit,place)=>`${digit} ${digit===1?PLACE_ONE[place]:WORTH_PLACES[place]}`;
export const formatWorth=n=>n>=1000?n.toLocaleString('en-US'):String(n);
// Level 1: two digits. Level 2: three digits. Level 3: four digits (sometimes three).
export function worthLength(level,roll){return level<=1?2:level===2?3:roll(4)===0?3:4;}
// Lit places lean on tens and hundreds (the misses); the ones digit, whose worth is its face value, is rare.
const WEIGHTS={2:[1,4],3:[1,4,4],4:[1,3,3,3]};
function pickPlace(length,r){
 const w=WEIGHTS[length],total=w.reduce((a,b)=>a+b,0);let x=r()*total;
 for(let i=0;i<w.length;i++){x-=w[i];if(x<0)return i;}
 return w.length-1;
}
function shuffle(values,r){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
// "Which" needs one clear answer, so its digits never repeat. "Worth" may repeat a digit (in 77 only the lit
// 7 counts). The first digit and the target digit are never 0.
function makeDigits(length,mode,lit,r){
 for(let trial=0;trial<60;trial++){
  const digits=mode==='which'?shuffle([0,1,2,3,4,5,6,7,8,9],r).slice(0,length):Array.from({length},()=>Math.floor(r()*10));
  if(digits[0]!==0&&digits[lit]!==0)return digits;
 }
 return [4,3,2,1].slice(-length);
}
export function worthQuestion(level,r){
 const roll=n=>Math.floor(r()*n),length=worthLength(level,roll),mode=roll(3)===0?'which':'worth',place=pickPlace(length,r);
 const lit=length-1-place,digits=makeDigits(length,mode,lit,r),digit=digits[lit],total=Number(digits.join(''));
 const base={kind:'place',skill:'worth',placeMode:mode,level,digits,total,lit,place,digit,explain:worthExplain(digit,place)};
 if(mode==='which')return {...base,answer:lit,options:digits.map((_,i)=>i),max:length-1,prompt:whichPrompt(place)};
 // Every choice is the same digit at a different size, so only the place decides.
 const options=shuffle(Array.from({length:length===2?3:4},(_,k)=>digit*10**k),r);
 return {...base,answer:digit*10**place,options,max:9000,prompt:worthPrompt(digit)};
}
export function worthVoiceLines(){
 const lines=new Set([WORTH_HELP]);
 for(let d=1;d<=9;d++){lines.add(worthPrompt(d));for(let p=0;p<4;p++)lines.add(worthExplain(d,p));}
 for(let p=0;p<4;p++)lines.add(whichPrompt(p));
 return [...lines];
}
