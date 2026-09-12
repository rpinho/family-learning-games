// Parent-directed lowercase practice. Uppercase scores never seed this track.
export const LOWERCASE_STAGES=['Big-to-little pairs','Three letter choices','Four letter choices','Listen without a big-letter clue','Look-alike letters','Different print styles'];
const LETTERS='asmotifnrcuphbdgkelwyvzxjq';
const CONFUSABLE=['bdpq','mnhr','iltfj','ceoa','uvwy','szxg'];
export function lowerState(p){return p.lowercase||{stage:1,streak:0,misses:0,serial:0,skills:{},recent:[]};}
export function lowerReady(p){const s=lowerState(p);return [...LETTERS].every(c=>(s.skills[c]?.audioHits||0)>=2);}
export function lowerQuestion(p){
 const s=lowerState(p),stage=s.stage,n=s.serial;
 const pool=[...LETTERS.slice(0,stage===1?8:stage===2?16:26)];
 const ranked=pool.map((c,i)=>({c,rank:(s.skills[c]?.[stage>=4?'audioHits':'hits']||0)*10+(s.skills[c]?.seen||0)*.2+(s.recent.includes(c)?50:0),tie:(i+n*7)%pool.length})).sort((a,b)=>a.rank-b.rank||a.tie-b.tie);
 const char=ranked[0].c,count=stage===1?2:stage===2?3:4;
 const similar=CONFUSABLE.find(g=>g.includes(char))||'aeio',others=[...new Set([...(stage>=5?similar:''),...LETTERS.slice(n%26)+LETTERS.slice(0,n%26)])].filter(c=>c!==char);
 const choices=[char,...others.slice(0,count-1)],offset=n%choices.length,options=choices.slice(offset).concat(choices.slice(0,offset));
 return {char,options,stage,upperCue:stage<=3?char.toUpperCase():null,font:stage===6&&n%2?'Georgia, serif':'inherit',prompt:`Find little ${char.toUpperCase()}.`};
}
export function lowerAttempt(p,q,{ok,helped=false}){
 const s=p.lowercase??=structuredClone(lowerState(p)),c=q.char,skill=s.skills[c]??={seen:0,hits:0,audioHits:0,errors:0};
 skill.seen++;if(ok&&!helped){skill.hits++;if(!q.upperCue)skill.audioHits++;}if(!ok)skill.errors++;
 s.serial++;s.recent=[...s.recent,c].slice(-3);
 if(ok&&!helped){s.streak++;s.misses=0;if(s.streak>=3){s.stage=Math.min(6,s.stage+1);s.streak=0;}}
 else {s.streak=0;if(!ok){s.misses++;if(s.misses>=2){s.stage=Math.max(1,s.stage-1);s.misses=0;}}}
 return s;
}
