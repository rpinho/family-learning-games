import {join} from 'node:path';
import {withSlotLock,readJSON,atomicJSON} from '../review.mjs';
import {applyChoice,payoff,markPaid,usesFlag,changesStory} from './graph.mjs';
import {graphOf,reachedChoices,routePages,pathOptions,pageLines} from '../../hub/public/book-adventure.mjs';
export const ledgerFile=(book,player)=>join(book,player,'ledger.json');
export const readLedger=async(book,player)=>await readJSON(ledgerFile(book,player))||{arc:null,flags:[],completed:[]};
export const updateLedger=(book,player,fn)=>withSlotLock(book,player,'1970-01-01',async()=>{const next=fn(await readLedger(book,player));await atomicJSON(ledgerFile(book,player),next);return next;},{waitMs:5000});
export function payoffUse(ch,flag){
 if(!flag?.id)return false;
 const routes=pathOptions(ch),onRoute=pages=>pages.some(p=>(p.say||[]).some(l=>l?.if===flag.id&&usesFlag(l,flag)&&changesStory(l)));
 return routes.length?routes.every(r=>onRoute(r.pages.map(i=>({...ch.pages[i],say:pageLines(ch.pages[i],r.choices,ch)})))):onRoute(ch.pages);
}
export const payPublished=(book,player,ch)=>ch.meta?.payoff?.used?updateLedger(book,player,l=>markPaid(l,ch.meta.payoff.id,ch.date)):Promise.resolve(null);
export async function completeAdventure(book,player,ch,input){if(!graphOf(ch))return null;
 const choices=reachedChoices(ch,input),route=routePages(ch,choices),last=ch.pages[route.at(-1)];
 if(Object.keys(choices).length!==graphOf(ch).nodes.filter(n=>n.choice).length||last?.node!==graphOf(ch).nodes.find(n=>!n.next?.length&&!n.choice)?.id)throw Object.assign(Error('Choose your way before finishing.'),{status:409});
 return updateLedger(book,player,l=>{if((l.completed||[]).includes(ch.date))return l;
  if(l.arc&&l.arc!==ch.meta.kit.id)l={arc:ch.meta.kit.id,flags:[],completed:l.completed||[],history:[...(l.history||[]),{arc:l.arc,flags:l.flags}]};
  l={...l,arc:ch.meta.kit.id};for(const p of ch.pages.filter(p=>p.choice)){const o=p.choice.options.find(o=>o.id===choices[p.node]);if(o?.sets)l={...l,...applyChoice(l,o.sets,ch.date)};}
  return {...l,completed:[...(l.completed||[]),ch.date]};});
}
export {payoff};
