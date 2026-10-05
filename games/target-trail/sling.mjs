// Sling Shot: shared deterministic aiming and content for server scoring and the client.
// Canvas is 800x600 logical pixels. The child drags anywhere and lets go; only the DIRECTION matters.
// Modelled on guided practice slingshot: targets stacked in one column at the same distance, fixed power,
// so the only choice is up/down. The stone flies where the pull points (straight away from the finger),
// a full dotted arc shows the path and the target it will hit glows before letting go.
export const SLING_VERSION='sling-2026-09-26-2';
export const ANCHOR={x:150,y:420};
export const COLUMN_X=540,MAX_PULL=150,MIN_PULL=14,GROUND=560,STONES=5,ARC=70,FLIGHT_MS=900;
export const SLING_TRACK={beginner:'letters',explorer:'words',admin:'mixed'};
export const MODES={letters:['letters','numbers','pattern'],words:['math','spelling'],mixed:['letters','math','numbers','spelling','pattern']};
export function slingFeel(track){return track==='letters'?{count:3,radius:64,magnet:true,margin:70}:{count:4,radius:50,magnet:false,margin:9};}
export function seeded(seed){let a=seed|0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=(a,r)=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export function clampPull(dx,dy){const d=Math.hypot(dx,dy);if(d<=MAX_PULL)return {dx,dy};return {dx:dx*MAX_PULL/d,dy:dy*MAX_PULL/d};}
// Targets: one column, evenly spread between the prompt board and the grass.
export function columnSpots(count,radius){const top=112+radius,bottom=GROUND-8-radius,step=count>1?(bottom-top)/(count-1):0;return Array.from({length:count},(_,i)=>({x:COLUMN_X,y:Math.round(top+i*step)}));}
// Where a pull points on the target column. null = not pulled back (pulling toward the targets or too short).
export function aimPoint(dx,dy){
 const p=clampPull(dx,dy),len=Math.hypot(p.dx,p.dy),lx=-p.dx,ly=-p.dy;
 if(len<MIN_PULL||lx<=len*.12)return null;
 const y=ANCHOR.y+ly*(COLUMN_X-ANCHOR.x)/lx;return {x:COLUMN_X,y:clamp(y,-2000,2600)};
}
// The target a pull selects: nearest target in reach (magnet) or within the margin.
export function aimTarget(aim,targets,feel){
 if(!aim)return null;let best=null;for(const t of targets){const d=Math.abs(aim.y-t.y);if(!best||d<best.d)best={t,d};}
 return best&&best.d<=best.t.radius+feel.margin?best.t:null;
}
// Stone path: a lob from the pouch to the end point (the selected target's centre, or the aim point), and
// past it when nothing is hit. `t` is 0..1 at the end point.
export function flightPath(from,end,hit,step=1/60){
 const out=[],last=hit?1:1+(830-end.x)/Math.max(1,end.x-from.x);
 const at=s=>({x:from.x+(end.x-from.x)*s,y:from.y+(end.y-from.y)*s-ARC*4*s*(1-s),t:s});
 for(let i=0;i*step<last-1e-9;i++){const pt=at(i*step);out.push(pt);if(!hit&&(pt.y>GROUND||pt.y<-300||pt.x>830))return out;}
 out.push(hit?{x:end.x,y:end.y,t:1}:at(last));
 return out;
}
// Everything the client draws and the server scores for one pull.
export function slingShot(targets,feel,dx,dy){
 const aim=aimPoint(dx,dy);if(!aim)return {aim:null,target:null,path:[]};
 const target=aimTarget(aim,targets,feel),end=target?{x:target.x,y:target.y}:aim;
 return {aim,target,path:flightPath(ANCHOR,end,!!target)};
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
 const r=seeded(round.seed+index*977),feel=slingFeel(round.track),count=feel.count;
 const item=round.mode==='math'?mathItem(round.stage,r):round.mode==='numbers'?numberItem(round.stage,r):round.mode==='pattern'?patternItem(round.stage,r):round.mode==='spelling'?spellingItem(round,index,r):letterItem(round.stage,round.letters,r);
 const labels=shuffle([item.answer,...[...new Set(item.others)].filter(v=>v!==item.answer).slice(0,count-1)],r);
 const spots=columnSpots(count,feel.radius);
 return {...item,mode:round.mode,labels,answerIndex:labels.indexOf(item.answer),targets:spots.map((s,i)=>({id:i,x:s.x,y:s.y,radius:feel.radius,label:labels[i]}))};
}
export function scoreStone(round,index,dx,dy){
 const item=slingItem(round,index),shot=slingShot(item.targets,slingFeel(round.track),dx,dy);
 if(!shot.aim)return {outcome:'no-pull',hitLabel:null,answer:item.answer,end:null,points:0};
 const outcome=!shot.target?'miss':shot.target.id===item.answerIndex?'correct':'wrong-target';
 const end=shot.path.at(-1);
 return {outcome,hitLabel:shot.target?.label??null,answer:item.answer,end:{x:Math.round(end.x),y:Math.round(end.y)},points:outcome==='correct'?10:0};
}
export function slingLines(){
 const out=new Set(['Pull back and let go.','Pull back, away from the balloons.','What comes next? Hit it.','Missed. Try again next time.','Yes!','Five stones! Ready for another round?']);
 for(const c of LETTERS){out.add(`Hit the letter ${c}.`);out.add(`This is ${c}.`);}
 for(let n=0;n<=23;n++){out.add(`Hit the number ${n}.`);out.add(`This is ${n}.`);}
 for(const s of SHAPES)out.add(`Next comes ${SHAPE_NAMES[s]}.`);
 for(const a of [2,3,4,5,6,7,8,9,10])for(let b=2;b<=10;b++){out.add(`What is ${a} times ${b}?`);out.add(`${a} times ${b} is ${a*b}.`);}
 for(const w of SPELL_WORDS.flat()){out.add(`Spell ${w}. Hit the first letter.`);out.add(`What comes next in ${w}?`);for(const c of new Set(w))out.add(`${w}: ${c.toUpperCase()}.`);}
 return [...out];
}
