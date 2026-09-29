// Short listening practice inside the existing block builder. Each pair has
// the same familiar digits, but a different number of tens and ones.
export const NUMBER_NAME_PAIRS=[[13,30],[14,40],[15,50],[16,60]];
const NAMES={13:'Thirteen',30:'Thirty',14:'Fourteen',40:'Forty',15:'Fifteen',50:'Fifty',16:'Sixteen',60:'Sixty'};
export const numberNameLine=n=>`${NAMES[n]} is ${Math.floor(n/10)} ${n<20?'ten':'tens'} and ${n%10} ones.`;
export const numberNameVoiceLines=()=>Object.keys(NAMES).map(Number).map(numberNameLine);
export function numberNameReview(history,r){
 const rows=history.filter(h=>h.question?.skill==='number-name');
 const targets=NUMBER_NAME_PAIRS.flat();
 const clean=n=>rows.filter(h=>h.question.total===n).slice(-2).filter(h=>h.ok&&!h.helped).length;
 const mastered=targets.every(n=>clean(n)===2);
 const last=rows.at(-1)?.question.total;
 const pool=targets.filter(n=>n!==last&&(!mastered?clean(n)<2:true));
 // If just one target still needs practice, allow it again after another round.
 const candidates=pool.length?pool:targets.filter(n=>clean(n)<2);
 const total=candidates[Math.floor(r()*candidates.length)];
 const pair=NUMBER_NAME_PAIRS.find(pair=>pair.includes(total));
 return {mastered,question:{kind:'place',skill:'number-name',placeMode:'build',level:2,
  target:[0,Math.floor(total/10),total%10],total,contrast:pair.find(n=>n!==total),
  show:'heard',answer:total,max:99,prompt:'Build the number you hear.'}};
}
