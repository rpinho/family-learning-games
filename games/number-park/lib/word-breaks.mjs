// Where Number Park takes a word break (the item itself comes from the shared word-break.mjs).
// Rounds: after question 3 and when the round ends, before the finish screen; never on a wind-down round.
// Free play (trace/shape done, Plan & Play success, Guess My Drawing): at most once per cooldown.
export const BREAK_EVENT='number-park-word-break';
export const BREAK_COOLDOWN_MS=90000;
export const roundMark=s=>`${s.game}:${s.began??'legacy'}`;
export function roundSnapshot(player,s){return s?{key:player+':'+roundMark(s),round:s.round,finished:!!s.finished,windDown:!!s.windDown}:null;}
// prev/cur are snapshots. Only a live transition inside the same round counts (never a reload or resume).
export function roundBreak(prev,cur){
 if(!prev||!cur||prev.key!==cur.key||prev.finished)return null;
 if(cur.finished)return cur.windDown?null:'round-end';
 if(prev.round===2&&cur.round===3)return 'round-mid';
 return null;
}
export function freeBreakDue(now,last,cooldown=BREAK_COOLDOWN_MS){return now-last>=cooldown;}
export function requestWordBreak(reason,target=globalThis){try{target.dispatchEvent(new CustomEvent(BREAK_EVENT,{detail:{reason}}));}catch{}}
