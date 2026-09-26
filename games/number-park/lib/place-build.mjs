// Block builder (Tens & ones): read a number, then build it from base-ten
// blocks. Pattern borrowed from Sage Teacher's place-value builder: coloured
// hundreds/tens/ones blocks and a check that is itemised per column
// ("hundreds are right, too few tens"), not a bare right/wrong.
export const PLACES=[
 {key:'hundreds',value:100,one:'hundred',many:'hundreds',color:'red'},
 {key:'tens',value:10,one:'ten',many:'tens',color:'blue'},
 {key:'ones',value:1,one:'one',many:'ones',color:'green'}
];
export const BUILD_MAX_PER_PLACE=12;
export const BUILD_PROMPT_WORDS='Build this number with blocks.';
export const BUILD_PROMPT_NUMBER='Read the number. Build it with blocks.';
// Saved rounds from before the prompts were shortened.
const LEGACY_BUILD_PROMPTS=['Build this number with the blocks. Then press check.','Read the number. Build it with the blocks. Then press check.'];
export const BUILD_HINTS={
 words:'Look at each color. Add that many blocks of each kind.',
 number:'Say the number out loud. Each digit tells you how many blocks of one kind.'
};
export const placeName=(i,n)=>n===1?PLACES[i].one:PLACES[i].many;
export function placeWords(target){
 const used=target.map((n,i)=>[n,i]).filter(([n])=>n>0);
 return used.map(([n,i])=>`${n} ${placeName(i,n)}`).join(' ');
}
export const buildValue=counts=>counts.reduce((sum,n,i)=>sum+n*PLACES[i].value,0);
// Level 1: tens and ones given in words. Level 2: a two-digit numeral to
// decode. Level 3: a three-digit numeral, sometimes with a zero digit.
export function buildQuestion(level,r){
 const roll=n=>Math.floor(r()*n);let target;
 if(level<=1)target=[0,2+roll(8),1+roll(9)];
 else if(level===2)target=[0,1+roll(9),roll(10)];
 else{target=[1+roll(9),roll(10),roll(10)];if(roll(4)===0)target[1+roll(2)]=0;}
 const total=buildValue(target),show=level<=1?'words':'number';
 return {kind:'place',skill:'place',placeMode:'build',level,target,total,show,answer:total,max:999,prompt:show==='words'?BUILD_PROMPT_WORDS:BUILD_PROMPT_NUMBER};
}
export function validBuild(counts){
 return Array.isArray(counts)&&counts.length===PLACES.length&&counts.every(n=>Number.isInteger(n)&&n>=0&&n<=BUILD_MAX_PER_PLACE);
}
// First wrong check: which columns are right, and too many / too few for the
// rest. From the second wrong check on, also say how many each column needs.
export function buildFeedback(target,counts,checks=0){
 const parts=PLACES.map((place,i)=>({key:place.key,have:counts[i],need:target[i],ok:counts[i]===target[i]}));
 const ok=parts.every(p=>p.ok);
 const lines=ok?[]:parts.filter(p=>p.need>0||p.have>0).map((p,i)=>{
  const index=PLACES.findIndex(place=>place.key===p.key),label=PLACES[index].many;
  if(p.ok)return `${label[0].toUpperCase()+label.slice(1)} are right.`;
  if(checks>=1)return `The number needs ${p.need} ${placeName(index,p.need)}.`;
  return p.have>p.need?`Too many ${label}.`:`Too few ${label}.`;
 });
 return {ok,parts,lines,message:lines.join(' ')};
}
export function placeVoiceLines(){
 const lines=new Set([BUILD_PROMPT_WORDS,BUILD_PROMPT_NUMBER,...LEGACY_BUILD_PROMPTS,...Object.values(BUILD_HINTS)]);
 PLACES.forEach((place,i)=>{
  lines.add(`${place.many[0].toUpperCase()+place.many.slice(1)} are right.`);
  lines.add(`Too many ${place.many}.`);lines.add(`Too few ${place.many}.`);
  for(let n=0;n<=9;n++)lines.add(`The number needs ${n} ${placeName(i,n)}.`);
 });
 return [...lines];
}
