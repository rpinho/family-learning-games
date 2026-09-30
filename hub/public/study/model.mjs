export const DEPTH=['tree','tower','mill'];export const behindTower='mill';export const crossesRiver=choice=>choice==='bridge';
export function place(order,id){return !DEPTH.includes(id)||order.includes(id)||order.length>=3?order:[...order,id];}
export const ordered=order=>order.length===3&&order.every((id,i)=>id===DEPTH[i]);
export function swap(order,a,b){if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=order.length||b>=order.length)return order;const out=[...order];[out[a],out[b]]=[out[b],out[a]];return out;}
