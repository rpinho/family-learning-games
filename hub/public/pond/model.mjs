// A bounded story experiment, with no scores, persistence, timers or adaptive placement.
export const INTRO={count:'Five leaves are resting on the pond. Touch each leaf and count with me.',flow:'A little stream carries a leaf into the pond. Look at the water. Which bank will it reach?'};
export const LINES=[...Object.values(INTRO),'1','2','3','4','5','Five leaves. You counted each leaf once.','The water carries the leaf to the reeds.','The water carries the leaf to the flowers.','The gate changed the stream. Now the leaf follows a different path.','You can change the gate and try the other path.','Tell someone: what changed the way the leaf moved?'];
export function createPond(mode='count'){return {mode:mode==='flow'?'flow':'count',counted:[],gate:'reeds',prediction:null,phase:'observe',trials:[],helped:false};}
export function pondAction(state,action){
 const s=structuredClone(state);
 if(action.type==='help'){s.helped=true;return s;}
 if(action.type==='count'&&s.mode==='count'&&Number.isInteger(action.id)&&action.id>=0&&action.id<5&&!s.counted.includes(action.id)){s.counted.push(action.id);if(s.counted.length===5)s.phase='done';}
 if(s.mode!=='flow')return s;
 if(action.type==='gate'&&s.phase!=='float'){s.gate=s.gate==='reeds'?'flowers':'reeds';s.prediction=null;s.phase='observe';}
 if(action.type==='predict'&&s.phase==='observe'&&['reeds','flowers'].includes(action.bank)){s.prediction=action.bank;s.phase='float';}
 if(action.type==='arrive'&&s.phase==='float'){s.trials.push({prediction:s.prediction,bank:s.gate,matched:s.prediction===s.gate});s.phase=s.trials.some(t=>t.bank==='flowers')&&s.trials.some(t=>t.bank==='reeds')?'done':'explain';}
 return s;
}
export function pondResult(s){return {kind:'pond',mode:s.mode,completed:s.phase==='done',counted:s.counted.length,trials:s.trials,helped:s.helped};}
