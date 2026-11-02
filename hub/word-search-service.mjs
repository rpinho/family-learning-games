import {gameStore} from './game-store.mjs';
import {freshSearch,searchAct,boardErrors,boardRule} from './word-search-model.mjs';

// Authored, generic picture words. No external packs or personal vocabulary.
export const SEARCH_WORDS=Object.freeze(['cat','hen','fish','sun','cup','fox','map','pin','tin','pot','mop','rug','mug','bun','net','pen','hat','bat','dog','log'].map(word=>word.toUpperCase()));
export function wordSearchService({data,players,clock=Date.now,timeZone='UTC'}){
 return gameStore({data,name:'word-search',players,fresh:freshSearch,validate:p=>{
  if(p.schema!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!Number.isSafeInteger(p.completed)||p.completed<0)throw Error('Unknown save');
  const b=p.current;if(!b)return;
  const rule=boardRule(p.completed-(b.phase==='finish'?1:0));
  if(boardErrors(b).length||b.targets.some(t=>!SEARCH_WORDS.includes(t.word))||new Set(b.targets.map(t=>t.word)).size!==b.targets.length||!Array.isArray(b.found)||new Set(b.found).size!==b.found.length||b.found.some(w=>!b.targets.some(t=>t.word===w))||b.phase!==(b.found.length===b.targets.length?'finish':'play')||b.size!==rule.size||b.targets.length!==rule.count||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||b.phase==='finish'&&p.completed===0)throw Error('Unknown board');
 },update:(p,input,player)=>{
  const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(clock());
  const at=p.completed*2%SEARCH_WORDS.length,words=[...SEARCH_WORDS.slice(at),...SEARCH_WORDS.slice(0,at)];
  return searchAct(p,input.type==='open'?{type:'start'}:input,{date,words,player});
 }});
}
