import {gameStore} from './game-store.mjs';
import {freshBlocks,blocksAct,spellingOrder} from './public/word-blocks/model.mjs';
import {SENTENCES,SETS} from './public/word-blocks/content.mjs';
import {FAMILIES} from './public/word-families.mjs';

const allowed=new Set([...Object.values(FAMILIES).flat(),...SETS.flatMap(s=>s.words),'the','a','was']);
export function wordBlocksService({data,players,clock=Date.now}){
 return gameStore({data,name:'word-blocks',players,fresh:freshBlocks,validate:p=>{
  if(p.schema!==1||!Number.isSafeInteger(p.revision)||p.revision<0||!p.words||!p.progress||['spelling','sentences','coins'].some(a=>!p.progress[a]))throw Error('Unknown save');
 },update:(p,input)=>blocksAct(p,input,{now:clock(),compact:input.compact===true,known:[],practice:{words:{}},words:spellingOrder(),sentences:SENTENCES,allowed})});
}
