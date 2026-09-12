export const FLIGHT_MS=550;
export const READING_NAMES=['','Big letters','Little letters','Mixed letters','Simple words','Word families'];
export const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const WORD_BANK='cat hat mat pat rat sat bat cap map tap nap lap dog log fog hog sun run fun bun bug mug rug bus cup pup bed red hen pen ten net wet jet pig wig big dig fin pin sit fit hot pot fox box'.split(' ');
export function seeded(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=(a,rng)=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export const cueLine=(label,kind)=>kind==='letter'?`Hit the letter ${label.toUpperCase()}.`:`Hit the word ${label.toLowerCase()}.`;
export const nameLine=(label,kind)=>kind==='letter'?`This is ${label.toUpperCase()}.`:`This says ${label.toLowerCase()}.`;
export function challengeFor(r,index){
 if(r.mode==='aim')return null;
 const stage=r.readingLevel||1,kind=stage>=4?'word':'letter',pool=kind==='word'?WORD_BANK:LETTERS,sequence=(r.sequence||0)*5+index;
 const answer=pool[(sequence*7)%pool.length],rng=seeded(r.seed+index*331),count=stage===3||stage===5?4:3;
 let others=shuffle(pool.filter(v=>v!==answer),rng);
 if(stage===5)others.sort((a,b)=>[...a].filter((v,i)=>v!==answer[i]).length-[...b].filter((v,i)=>v!==answer[i]).length);
 const labels=shuffle([answer,...others.slice(0,count-1)],rng).map(v=>stage===2||stage===5?v.toLowerCase():stage===3&&rng()<.5?v.toLowerCase():v.toUpperCase());
 const answerIndex=labels.findIndex(v=>v.toLowerCase()===answer.toLowerCase());
 return {kind,labels,answerIndex,answer:labels[answerIndex],cue:cueLine(answer,kind)};
}
export function movingTargets(r,index,elapsed){
 const c=challengeFor(r,index),level=clamp(r.level,1,20),rng=seeded(r.seed+index*113),count=c?.labels.length||1;
 const word=c?.kind==='word',radius=count===1?Math.max(20,95-level*3.8):word?78:Math.max(42,83-level*2);
 const ax=count===1?Math.min(220,65+level*7):Math.min(word?35:52,10+level*2.3),ay=count===1?Math.min(100,25+level*4):Math.min(word?25:40,7+level*1.6);
 const speed=.0008+level*.00018;
 return Array.from({length:count},(_,i)=>{
  const x=count===1?400:count===3?[150,400,650][i]:[215,585,215,585][i],y=count===1?250:count===3?[205,290,205][i]:[140,140,365,365][i],phase=rng()*Math.PI*2;
  return {id:i,label:c?.labels[i]||'',x:x+Math.sin(elapsed*speed+phase)*ax,y:y+Math.sin(elapsed*speed*.73+phase*1.7)*ay,radius,kind:c?.kind||'aim'};
 });
}
export function aimAt(r,x,y,elapsed){
 const amplitude=r.rules===2?Math.min(17,Math.max(0,r.level-2)*1.1):0,phase=(r.seed%31)/5;
 return {x:clamp(x+amplitude*(.7*Math.sin(elapsed*.004+phase)+.3*Math.sin(elapsed*.009)),0,800),y:clamp(y+amplitude*.7*Math.sin(elapsed*.0057+phase),0,500)};
}
export function learningDefaults(id){return {level:id==='explorer'?2:1,correct:0,wrong:0,misses:0,streak:0,struggles:0};}
export const voiceLines=()=>[...LETTERS.flatMap(v=>[cueLine(v,'letter'),nameLine(v,'letter')]),...WORD_BANK.flatMap(v=>[cueLine(v,'word'),nameLine(v,'word')])];
