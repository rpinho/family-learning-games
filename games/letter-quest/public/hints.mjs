export const HINT_CAPACITY=2;
export const HINT_REFILL_MS=90000;
export function hintState(p,now=Date.now()){
 const saved=p.hintBank||{tokens:HINT_CAPACITY,at:now,grants:[]};
 const elapsed=Math.max(0,now-saved.at),refills=Math.floor(elapsed/HINT_REFILL_MS);
 const tokens=Math.min(HINT_CAPACITY,saved.tokens+refills);
 const at=tokens===HINT_CAPACITY?now:saved.at+refills*HINT_REFILL_MS;
 return {tokens,at,grants:[...saved.grants],waitSeconds:tokens?0:Math.ceil((HINT_REFILL_MS-Math.max(0,now-at))/1000)};
}
export const hintLabel=p=>{const s=hintState(p);return `Show me · ${s.tokens}/${HINT_CAPACITY}${s.tokens?'':` · ${s.waitSeconds}s`}`;};
export const wasHinted=(p,key)=>!!p.hintBank?.grants.includes(key);
export function useHint(p,key,now=Date.now()){
 if(wasHinted(p,key))return false;
 const s=hintState(p,now);
 if(!s.tokens)throw Object.assign(Error(`No hints left. One returns in ${s.waitSeconds} seconds. Try it yourself or replay the instruction.`),{status:429});
 s.tokens--;s.grants.push(key);s.grants=s.grants.slice(-128);delete s.waitSeconds;p.hintBank=s;return true;
}
