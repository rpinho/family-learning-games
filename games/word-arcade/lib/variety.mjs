// Content exposure is shared; reading mastery remains separate for every game.
export function recentWords(p){return (p.variety?.recent||[]).slice(-10);}
export function chooseWord(p,pool,{recent=[],skills={},serial=0}={}){
 const avoid=new Set([...recent,...recentWords(p)]),eligible=pool.filter(w=>!avoid.has(w));
 const local=pool.filter(w=>!recent.includes(w));
 const candidates=eligible.length?eligible:local.length?local:pool;
 const cost=w=>(skills[w]?.seen||0)*4+(p.variety?.seen?.[w]||0);
 const least=Math.min(...candidates.map(cost)),choices=candidates.filter(w=>cost(w)===least);
 return choices[(serial*7+(p.variety?.serial||0)*11+(p.id==='beginner'?5:2))%choices.length];
}
export function rememberWord(p,word){
 if(!/^[a-z]{2,12}$/.test(word||''))return;
 const s=p.variety??={recent:[],seen:{},serial:0};
 s.recent=[...s.recent,word].slice(-16);s.seen[word]=(s.seen[word]||0)+1;s.serial++;
}
