import {CATALOG} from './catalog.mjs';
import {fetchJSON} from './save-request.mjs';
const ids=CATALOG.map(g=>g.id),key=player=>'family-games-menu-order:'+player;
function normalize(order){
 if(!Array.isArray(order)||!order.length||order.some(id=>!ids.includes(id))||new Set(order).size!==order.length)return null;
 return [...order,...ids.filter(id=>!order.includes(id))];
}
export function createMenuCache({storage,request=player=>fetchJSON('/api/menu?player='+encodeURIComponent(player),{},2000)}={}){
 const orders=new Map(),pending=new Map();
 return {
  current(player){
   if(!orders.has(player)){let order;try{order=normalize(JSON.parse(storage?.getItem(key(player))||'null'));}catch{}orders.set(player,order||[...ids]);}
   return [...orders.get(player)];
  },
  refresh(player){
   if(pending.has(player))return pending.get(player);
   const work=Promise.resolve().then(()=>request(player)).then(result=>{
    if(result?.ready===false)return; // A restarting server has no preference evidence yet.
    const order=normalize(result?.order);if(!order)return;
    orders.set(player,order);try{storage?.setItem(key(player),JSON.stringify(order));}catch{}
   }).catch(()=>{}).finally(()=>pending.delete(player));
   pending.set(player,work);return work;
  },
 };
}
