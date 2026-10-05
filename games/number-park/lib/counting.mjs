export const COUNT_OBJECTS=[['🍎','apples'],['⭐','stars'],['🐟','fish'],['🍓','strawberries'],['⚽','soccer balls'],['🦋','butterflies']];
const shuffled=(a,r)=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
export function countingQuestion(r,round,{stretch=false}={}){
 const pick=n=>Math.floor(r()*n),targetIndex=pick(COUNT_OBJECTS.length),[object,noun]=COUNT_OBJECTS[targetIndex];
 // A gentle counting-only extension; mixed-object filtering stays at its old size.
 const extended=stretch&&r()<1/3,max=extended?16:13;
 const mode=extended?['scatter','groups'][round%2]:['scatter','groups','only'][round%3];
 const count=extended?14+pick(3):mode==='only'?7+pick(4):6+pick(8);
 const other=COUNT_OBJECTS[(targetIndex+1+pick(5))%6];
 const items=Array.from({length:count},()=>({object,noun}));
 if(mode==='only')items.push(...Array.from({length:1+pick(Math.min(3,13-count))},()=>({object:other[0],noun:other[1]})));
 return {kind:'count',mode,count,answer:count,max,object,noun,items:shuffled(items,r),layoutSeed:pick(100),prompt:mode==='only'?`Count only the ${noun}.`:'Tap and count.'};
}
export function countingOptions(answer,r,max=13){
 const start=Math.max(0,Math.min(max-3,answer-1));
 return shuffled(Array.from({length:4},(_,i)=>start+i),r);
}
