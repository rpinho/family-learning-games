// A saved next-chapter choice adjusts optional reading load, never the learner's skill levels.
// The caller supplies eligible words and a rebuild function so pronunciation, shuffled tiles and
// curriculum constraints stay with the existing planner. Earlier/published chapters are unaffected.
export function applyChapterChoice(plan, choice, {eligibleWords=[], shortSpell=null}={}) {
 if(!choice || !['easier','harder'].includes(choice.value) || !/^\d{4}-\d{2}-\d{2}$/.test(choice.date||'') || choice.date>=plan.date)return null;
 const result={value:choice.value,date:choice.date,changes:[]};
 if(plan.level==='reader') {
  const words=[...new Set(plan.magic||[])];
  if(choice.value==='easier') {
   if(words.length>1){plan.magic=words.slice(0,1);result.changes.push('one magic word');}
   const i=(plan.beats||[]).findIndex(b=>b.kind==='spell');
   if(i>=0){const b=plan.beats[i],replacement=shortSpell?.(b,plan);
    if(replacement && replacement.answer?.length<=b.answer?.length && replacement.id===b.id && replacement.kind===b.kind) {
     if(JSON.stringify(replacement)!==JSON.stringify(b)){plan.beats[i]=replacement;result.changes.push('shorter spell');}
    }else if(b.answer?.length && b.tiles?.length>b.answer.length) {
     // Remove the extra look-alike, retaining the original shuffled order of the answer tiles.
     const left=[...b.answer],tiles=b.tiles.filter(w=>{const at=left.indexOf(w);if(at<0)return false;left.splice(at,1);return true;});
     if(!left.length){plan.beats[i]={...b,tiles};result.changes.push('spell without extra tile');}
    }
   }
  }else {
   const next=eligibleWords.find(w=>!words.includes(w));
   // One extra independently established word; never jump to a new sound or exceed four.
   if(next && words.length<4){plan.magic=[...words,next];result.changes.push('one extra known magic word');}
  }
 }
 return result;
}
