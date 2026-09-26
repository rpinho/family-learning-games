// FROZEN copy of sling-2026-09-26-1 (free 2D pull, power by distance, scattered balloons).
// Only used by the server to score shots from pages still running that old code until they refresh.
// Do not edit.
// Canvas is 800x600 logical pixels. The child pulls the pouch back from the anchor and lets go.
export const SLING_VERSION='sling-2026-09-26-1';
export const ANCHOR={x:150,y:430};
export const MAX_PULL=150,POWER=6.2,GRAVITY=900,GROUND=560,STONES=5;
export const SLING_TRACK={beginner:'letters',explorer:'words',admin:'mixed'};
export const MODES={letters:['letters','numbers','pattern'],words:['math','spelling'],mixed:['letters','math','numbers','spelling','pattern']};
// Forgiving for a five-year-old: bigger targets, wider hit margin and a full aiming arc.
export function slingFeel(track){return track==='letters'?{radius:56,margin:22,preview:1}:{radius:46,margin:10,preview:.6};}
export function seeded(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=(a,r)=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export function clampPull(dx,dy){const d=Math.hypot(dx,dy);if(d<=MAX_PULL)return {dx,dy};return {dx:dx*MAX_PULL/d,dy:dy*MAX_PULL/d};}
// Stone path for a pull (pouch offset from the anchor). Stops at the ground or the screen edge.
export function flightPath(dx,dy,step=1/120){
 const p=clampPull(dx,dy),vx0=-p.dx*POWER,vy0=-p.dy*POWER,out=[];
 for(let t=0;t<=3;t+=step){const x=ANCHOR.x+vx0*t,y=ANCHOR.y+vy0*t+GRAVITY*t*t/2;out.push({x,y,t});if(x>830||x<-30||y>GROUND||y<-400)break;}
 return out;
}
export function firstHit(path,targets,margin){for(const pt of path)for(const t of targets)if(Math.hypot(pt.x-t.x,pt.y-t.y)<=t.radius+margin)return {target:t,point:pt};return null;}
// Target spots on the right half, spaced so arcs can separate them.
export function targetSpots(count,radius,r){
 // Keep balloons fully on screen and below the prompt board.
 const spots=[],right=800-radius-16,top=120+radius,bottom=GROUND-radius-70;for(let k=0;k<400&&spots.length<count;k++){const x=440+r()*(right-440),y=top+r()*(bottom-top);if(spots.every(s=>Math.hypot(s.x-x,s.y-y)>radius*2.35))spots.push({x:Math.round(x),y:Math.round(y)});}
 while(spots.length<count)spots.push({x:470+spots.length*90,y:top+spots.length*70});
 return spots;
}
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOOK={B:'PRD',D:'OBP',P:'RBF',R:'PBK',E:'FLB',F:'EPT',L:'ITJ',I:'LTJ',T:'ILF',M:'NWH',N:'MZH',W:'MVN',V:'WYU',O:'QCD',C:'OGQ',G:'COQ',Q:'OGC',U:'VJO',K:'XRH',X:'KYZ',Y:'VXT',Z:'NSX',S:'ZGC',H:'NAK',A:'HVR',J:'LUI'};
export const SHAPES=['🔴','🔵','🟡','🟢','⭐','🔺','🟪','❤️'];
export const SHAPE_NAMES={'🔴':'red','🔵':'blue','🟡':'yellow','🟢':'green','⭐':'star','🔺':'triangle','🟪':'purple','❤️':'heart'};
export const SPELL_WORDS=[['cat','dog','sun','pig','hen','bug','cup','fox','map','bed'],['ship','fish','frog','duck','drum','flag','sock','king','crab','milk'],['train','snail','sheep','beach','brush','shark','whale','black','truck','clock']];
export function spellingWords(stage){return SPELL_WORDS[clamp(stage,1,3)-1];}
function mathItem(stage,r){
 const tables=stage===1?[2,5,10]:stage===2?[3,4,2,5]:[6,7,8,9,3,4],a=tables[Math.floor(r()*tables.length)],b=2+Math.floor(r()*9),answer=a*b;
 const near=[...new Set([answer+a,answer-a,a*(b+1)===answer+a?answer+b:a*(b+1),answer+1,answer-1,answer+10,(a+1)*b].filter(v=>v>0&&v!==answer))];
 return {prompt:`${a} × ${b} = ?`,spoken:`What is ${a} times ${b}?`,answer:String(answer),others:shuffle(near,r).map(String),name:`${a} times ${b} is ${answer}.`};
}
function numberItem(stage,r){
 const max=stage===1?5:stage===2?10:20,answer=Math.floor(r()*(max+1-(stage===1?1:0)))+(stage===1?1:0);
 const near=[...new Set([answer+1,answer-1,answer+2,answer-2,stage>1?answer+10:answer+3].filter(v=>v>=0&&v<=Math.max(max,answer+3)&&v!==answer))];
 return {prompt:'',spoken:`Hit the number ${answer}.`,answer:String(answer),others:shuffle(near,r).map(String),name:`This is ${answer}.`};
}
function letterItem(stage,letters,r){
 const pool=(letters?.length?letters:[...'FRANCISO']).filter(c=>/^[A-Z]$/.test(c)),answer=pool[Math.floor(r()*pool.length)];
 return {prompt:'',spoken:`Hit the letter ${answer}.`,answer,others:shuffle([...(LOOK[answer]||''),...shuffle([...LETTERS].filter(c=>c!==answer),r)].filter(c=>c!==answer),r),name:`This is ${answer}.`};
}
export const PATTERNS=[[0,1],[0,0,1],[0,1,1],[0,1,2]];
function patternItem(stage,r){
 const kinds=PATTERNS.slice(0,stage===1?1:stage===2?3:4),unit=kinds[Math.floor(r()*kinds.length)],picks=shuffle(SHAPES,r).slice(0,3),shown=5+(unit.length===3?1:0);
 const seq=Array.from({length:shown},(_,i)=>picks[unit[i%unit.length]]),answer=picks[unit[shown%unit.length]];
 return {prompt:seq.join(' ')+' ?',spoken:'What comes next? Hit it.',answer,others:shuffle([...picks.filter(s=>s!==answer),...SHAPES.filter(s=>!picks.includes(s))],r),name:`Next comes ${SHAPE_NAMES[answer]}.`};
}
// Spelling: each stone is the next letter of the current word; the word carries across stones.
export function spellingStep(round,index){
 const words=round.words||spellingWords(round.stage),start=round.wordOffset||0;let left=index,w=start;
 while(left>=words[w%words.length].length){left-=words[w%words.length].length;w++;}
 const word=words[w%words.length];return {word,position:left};
}
function spellingItem(round,index,r){
 const {word,position}=spellingStep(round,index),answer=word[position];
 const near=[...'bdpqmnwuvaeiou'].filter(c=>c!==answer),others=shuffle([...shuffle(near,r).slice(0,3),...shuffle([...'abcdefghijklmnopqrstuvwxyz'].filter(c=>c!==answer),r)],r).filter(c=>c!==answer);
 return {prompt:[...word].map((c,i)=>i<position?c:'_').join(' '),spoken:position===0?`Spell ${word}. Hit the first letter.`:`What comes next in ${word}?`,answer,others,name:`${word}: ${answer.toUpperCase()}.`,word,position};
}
// The item for stone `index` of a round, fully determined by the saved round.
export function slingItem(round,index){
 const r=seeded(round.seed+index*977),feel=slingFeel(round.track),count=round.track==='letters'?3:4;
 const item=round.mode==='math'?mathItem(round.stage,r):round.mode==='numbers'?numberItem(round.stage,r):round.mode==='pattern'?patternItem(round.stage,r):round.mode==='spelling'?spellingItem(round,index,r):letterItem(round.stage,round.letters,r);
 const labels=shuffle([item.answer,...[...new Set(item.others)].filter(v=>v!==item.answer).slice(0,count-1)],r);
 const spots=targetSpots(count,feel.radius,r);
 return {...item,mode:round.mode,labels,answerIndex:labels.indexOf(item.answer),targets:spots.map((s,i)=>({id:i,x:s.x,y:s.y,radius:feel.radius,label:labels[i]}))};
}
export function scoreStone(round,index,dx,dy){
 const item=slingItem(round,index),feel=slingFeel(round.track),path=flightPath(dx,dy),hit=firstHit(path,item.targets,feel.margin);
 const outcome=!hit?'miss':hit.target.id===item.answerIndex?'correct':'wrong-target';
 return {outcome,hitLabel:hit?.target.label??null,answer:item.answer,end:hit?.point||path.at(-1),points:outcome==='correct'?10:0};
}
export function slingLines(){
 const out=new Set(['Pull back and let go.','What comes next? Hit it.','Missed. Try again next time.','Yes!','Five stones! Ready for another round?']);
 for(const c of LETTERS){out.add(`Hit the letter ${c}.`);out.add(`This is ${c}.`);}
 for(let n=0;n<=23;n++){out.add(`Hit the number ${n}.`);out.add(`This is ${n}.`);}
 for(const s of SHAPES)out.add(`Next comes ${SHAPE_NAMES[s]}.`);
 for(const a of [2,3,4,5,6,7,8,9,10])for(let b=2;b<=10;b++){out.add(`What is ${a} times ${b}?`);out.add(`${a} times ${b} is ${a*b}.`);}
 for(const w of SPELL_WORDS.flat()){out.add(`Spell ${w}. Hit the first letter.`);out.add(`What comes next in ${w}?`);for(const c of new Set(w))out.add(`${w}: ${c.toUpperCase()}.`);}
 return [...out];
}
