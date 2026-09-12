export const COUNT_OBJECTS=[['🍎','apples'],['⭐','stars'],['🐟','fish'],['🍓','strawberries'],['⚽','soccer balls'],['🦋','butterflies']];
const shuffled=(a,r)=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
export function countingQuestion(r,round){
 const pick=n=>Math.floor(r()*n),targetIndex=pick(COUNT_OBJECTS.length),[object,noun]=COUNT_OBJECTS[targetIndex];
 const mode=['scatter','groups','only'][round%3];
 const count=mode==='only'?7+pick(4):6+pick(8);
 const other=COUNT_OBJECTS[(targetIndex+1+pick(5))%6];
 const items=Array.from({length:count},()=>({object,noun}));
 if(mode==='only')items.push(...Array.from({length:1+pick(Math.min(3,13-count))},()=>({object:other[0],noun:other[1]})));
 return {kind:'count',mode,count,answer:count,max:13,object,noun,items:shuffled(items,r),layoutSeed:pick(100),prompt:mode==='only'?`Count only the ${noun}.`:'Tap and count.'};
}
export function countingOptions(answer,r){
 const start=Math.max(0,Math.min(10,answer-1));
 return shuffled(Array.from({length:4},(_,i)=>start+i),r);
}
