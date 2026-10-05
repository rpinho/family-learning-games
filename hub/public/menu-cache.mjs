import {CATALOG} from './catalog.mjs';
import {fetchJSON} from './save-request.mjs';
const ids=CATALOG.map(g=>g.id),key=player=>'family-games-menu-order:'+player,homeKey=player=>'family-games-home-order:'+player,nudgeKey=player=>'family-games-home-nudge:'+player;
// The smart home list may name shortcut cards too; the page keeps only cards it knows (home-shortcuts.mjs).
const homeList=list=>Array.isArray(list)&&list.length&&list.length<=40&&list.every(id=>typeof id==='string'&&/^[a-z0-9-]{1,40}$/.test(id))&&new Set(list).size===list.length?[...list]:null;
function normalize(order){
 if(!Array.isArray(order)||!order.length||order.some(id=>!ids.includes(id))||new Set(order).size!==order.length)return null;
 return [...order,...ids.filter(id=>!order.includes(id))];
}
export function createMenuCache({storage,request=player=>fetchJSON('/api/menu?player='+encodeURIComponent(player),{},2000)}={}){
 const orders=new Map(),homes=new Map(),nudges=new Map(),families=new Map(),pending=new Map();
 return {
  current(player){
   if(!orders.has(player)){let order;try{order=normalize(JSON.parse(storage?.getItem(key(player))||'null'));}catch{}orders.set(player,order||[...ids]);}
   return [...orders.get(player)];
  },
  home(player){
   if(!homes.has(player)){let list=null;try{list=homeList(JSON.parse(storage?.getItem(homeKey(player))||'null'));}catch{}homes.set(player,list);}
   const list=homes.get(player);return list?[...list]:null;
  },
  // The day's nudge card in that list (Today keeps it off the first row), from the same visit as the list.
  nudge(player){
   if(!nudges.has(player)){let id=null;try{id=storage?.getItem(nudgeKey(player))||null;}catch{}nudges.set(player,/^[a-z0-9-]{1,40}$/.test(id||'')?id:null);}
   return nudges.get(player);
  },
  familyOrder(player){
   if(!families.has(player)){let list=null;try{list=homeList(JSON.parse(storage?.getItem('family-games-home-families:'+player)||'null'));}catch{}families.set(player,list);}
   const list=families.get(player);return list?[...list]:null;
  },
  refresh(player){
   if(pending.has(player))return pending.get(player);
   const work=Promise.resolve().then(()=>request(player)).then(result=>{
    if(result?.ready===false)return; // A restarting server has no preference evidence yet.
    const order=normalize(result?.order);if(!order)return;
    orders.set(player,order);try{storage?.setItem(key(player),JSON.stringify(order));}catch{}
    const home=homeList(result?.home);if(home){const familyOrder=homeList(result?.familyOrder);families.set(player,familyOrder);try{if(familyOrder)storage?.setItem('family-games-home-families:'+player,JSON.stringify(familyOrder));else storage?.removeItem('family-games-home-families:'+player);}catch{}homes.set(player,home);const nudge=typeof result?.nudge==='string'&&home.includes(result.nudge)?result.nudge:null;nudges.set(player,nudge);try{storage?.setItem(homeKey(player),JSON.stringify(home));if(nudge)storage?.setItem(nudgeKey(player),nudge);else storage?.removeItem(nudgeKey(player));}catch{}}
   }).catch(()=>{}).finally(()=>pending.delete(player));
   pending.set(player,work);return work;
  },
 };
}
