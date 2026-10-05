// Quest-style chapters for an older reader whose READING is still early (word families) but whose maths and logic
// are ahead: the chapter plays like a game. Deterministic (seeded by the date), no LLM.
//  - puzzle beats at his real level: skip counting, the 9s finger trick, a logic lock, a map route (a football
//    play card when he plays football), each shown as numbers and symbols (anything he must READ stays decodable;
//    clues are spoken TO him);
//  - a fair-share beat: deal things equally onto plates, then say how many on each (no remainders, 2026-10-01);
//  - a fork: two ways on, both fine; the one he picks decides the chapter's quest item (it goes in his spellbook).
// Interest details (both children): one or two small story touches per chapter from the household's private
// profile ("details"); an optional theme can flavour a beat without adding private facts.
// Same seeded generator as plan.mjs (kept here to avoid a circular import).
import {missingBeatProps} from '../hub/public/book-scene.mjs';
function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const say=n=>WORD_NUM[n]||String(n);
const plural=n=>{const w=say(n);return w.endsWith('x')?w+'es':w+'s';};
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=(a,r)=>a[Math.floor(r()*a.length)];
// Three distinct number options around an answer (always positive, answer included).
export function numOptions(ans,r,near=[]){const set=new Set([String(ans)]);for(const x of [...near,ans+1,ans-1,ans+2,ans+10,ans-2])if(set.size<3&&x>0&&x!==ans)set.add(String(x));return shuffle([...set],r);}

// Skip counting: a sequence with one gap. Pull-ups flavour: the friend counts his pull-ups on the bar.
export function skipBeat(id,r,{steps=[2,3,5,10],flavor=null,max=50}={}){
 const ok=steps.filter(st=>st*5<=max),step=pick(ok.length?ok:[2],r),start=step*(1+Math.floor(r()*Math.max(1,Math.min(max>50?6:2,Math.floor(max/step)-4)))),seq=Array.from({length:5},(_,i)=>start+i*step),gap=2+Math.floor(r()*2),ans=seq[gap];
 const said=seq.map((n,i)=>i===gap?'what':String(n)).join(', ');
 const display=seq.map((n,i)=>i===gap?'?':String(n)).join(', ');
 const pull=flavor==='pull-ups';
 return {id,kind:'puzzle',variant:'skip',step,display,answer:String(ans),options:numOptions(ans,r,[ans+step,ans-1]),
  what:pull?`on the training bar he does pull-ups while a friend counts them by ${say(step)}s; one number in the count is missing and he finds it`:`a path of stepping stones is numbered by ${say(step)}s; one stone has lost its number and he finds it`,
  spoken:pull?`Pull-ups! We count them by ${say(step)}s: ${said}. Which number is missing?`:`The stones count by ${say(step)}s: ${said}. Which number is missing?`,
  hint:`Count by ${say(step)}s from ${say(start)}.`,done:`Yes! ${ans}!`};
}
// The 9s trick: nine times n with the finger trick as the hint.
export function ninesBeat(id,r,{facts=[]}={}){
 const stuck=facts.map(f=>String(f).split('x').map(Number)).filter(([a,b])=>a===9||b===9).map(([a,b])=>a===9?b:a).filter(n=>n>=2&&n<=10);
 const n=stuck.length?pick(stuck,r):2+Math.floor(r()*8),ans=9*n;
 return {id,kind:'puzzle',variant:'nines',display:`9 × ${n}`,answer:String(ans),options:numOptions(ans,r,[ans+9,ans-9,ans+1]),
  what:`a wizard's number lock needs nine times ${say(n)}; he uses the nines finger trick (fold down finger ${say(n)}: the fingers before it are the tens, the fingers after it are the ones)`,
  spoken:`The wizard lock asks: nine times ${say(n)}. Use the finger trick!`,
  hint:`Fold down finger ${say(n)}. ${say(n-1)} fingers before it, ${say(10-n)} after it.`,done:`Yes! ${ans}! The lock clicks open.`};
}
// A logic lock: "twenty-something, and even" rules out the other two numbers.
export function lockBeat(id,r,{floor=null}={}){
 // (with a math floor: a three-digit lock, "four-hundred-and-something, ends in 5…")
 if(floor?.placeValueDigits>=3){const h=1+Math.floor(r()*9),t=Math.floor(r()*10),o=Math.floor(r()*10),ans=h*100+t*10+o,opts=shuffle([ans,ans+10<1000?ans+10:ans-10,ans+(o<9?1:-1)].map(String),r);
  return {id,kind:'puzzle',variant:'lock',display:`🔒 ${h}??`,answer:String(ans),options:opts,what:`a logic lock opens with one three-digit number; three clues (hundreds, tens, ones) rule out the others`,
   spoken:`The lock opens with one number. It has ${h} hundreds, ${t} tens and ${o} ones. Which number?`,hint:`${h} hundreds, ${t} tens, ${o} ones: write ${h}, then ${t}, then ${o}.`,done:`Yes! ${ans}! Click, the lock opens.`};}
 const tens=1+Math.floor(r()*3),ones=Math.floor(r()*10),ans=tens*10+ones,even=ans%2===0;
 const other=ans+(ones<9?1:-1),far=tens<3?ans+10:ans-10;
 const band=['','ten-something','twenty-something','thirty-something'][tens];
 return {id,kind:'puzzle',variant:'lock',display:`🔒 ${tens}?`,answer:String(ans),options:shuffle([String(ans),String(other),String(far)],r),
  what:`a logic lock opens with one number; he hears two clues (it is ${band}, and it is ${even?'even':'odd'}) and rules out the other numbers`,
  spoken:`The lock opens with one number. Clue one: it is ${band}. Clue two: it is ${even?'even':'odd'}. Which number?`,
  hint:`${band}: it starts with ${tens}. ${even?'Even':'Odd'}: ${even?'it splits into two equal groups':'one is left over when you make pairs'}.`,done:`Yes! ${ans}! Click, the lock opens.`};
}
// Map routes: three coloured routes with their steps; the shortest wins (football: the play that gains the most yards).
const ROUTES=[['blue','🟦'],['green','🟩'],['red','🟥']];
export function routeBeat(id,r,{flavor=null,long=false}={}){
 const football=flavor==='american football',maze=flavor==='labyrinth';
 // No two equal steps in a row ("15 plus 15 plus" says the same thing twice).
 const parts=()=>{let a;do{a=Array.from({length:(long?3:2)+Math.floor(r()*2)},()=>(football?5:1)*(1+Math.floor(r()*(football?4:long?9:6))));}while(a.some((x,i)=>i&&x===a[i-1]));return a;};
 let routes;do{routes=ROUTES.map(([c,e])=>({c,e,steps:parts()}));routes.forEach(x=>x.sum=x.steps.reduce((a,b)=>a+b,0));}
 while(new Set(routes.map(x=>x.sum)).size<3);
 const best=routes.reduce((a,b)=>football?(b.sum>a.sum?b:a):(b.sum<a.sum?b:a));
 return {id,kind:'puzzle',variant:football?'playcard':'route',lines:routes.map(x=>`${x.e} ${x.steps.join(' + ')}`),labels:Object.fromEntries(routes.map(x=>[x.c,x.e])),
  display:football?'Play card':maze?'Labyrinth':'Map',answer:best.c,options:routes.map(x=>x.c),...(maze?{flavor:'labyrinth'}:{}),
  what:football?`an American-football huddle: a play card shows three running routes with their yards; he calls the play that gains the most yards`:maze?`his paper labyrinth has three coloured paths to the star, each with its steps; he adds them up in his head and picks the shortest way through`:`a map shows three routes to the next stop with their steps; he adds them up and picks the shortest`,
  spoken:(football?`Huddle up! Three routes on the play card. `:maze?`Three paths through the labyrinth. `:`Three routes on the map. `)+routes.map(x=>`${x.c[0].toUpperCase()+x.c.slice(1)}: ${x.steps.join(' plus ')}.`).join(' ')+(football?` Which one gains the most yards?`:maze?` Which path reaches the star in the fewest steps?`:` Which route is shortest?`),
  hint:football?`Add each route. The biggest total wins.`:`Add each route. The smallest total wins.`,done:football?`Touchdown! The ${best.c} route gains ${best.sum} yards!`:maze?`Yes! The ${best.c} path is only ${best.sum} steps to the star!`:`Yes! The ${best.c} route is only ${best.sum} steps!`};
}
// Remainders with objects: deal them onto plates, then how many are left over.
// (thing = [spoken plural, drawn library prop id]: the picture shows that prop, never an emoji)
export function remainderBeat(id,r,{thing=['cookies','cookie']}={}){
 let groups,total;do{groups=2+Math.floor(r()*4);total=groups*(2+Math.floor(r()*3))+1+Math.floor(r()*(groups-1));}while(total%groups===0||total>20);
 const left=total%groups;
 return {id,kind:'remainder',total,groups,thing:thing[0],prop:thing[1],answer:String(left),options:numOptions(left,r,[left+1,groups]),
  what:`${total} ${thing[0]} must be shared fairly on ${groups} plates; he deals them round by round, and some are left over`,
  spoken:`${total} ${thing[0]}, shared fairly on ${say(groups)} plates. Tap the basket to deal one onto every plate.`,ask:`${total} ${thing[0]} on ${say(groups)} plates: how many are left over?`,done:`Yes! ${say(left)} left over.`};
}
// Equal sharing with drawn things (no remainder): deal them from the basket onto the plates, then how many on each.
// parent decision is equal sharing only, so the quest shares fairly instead of dealing a remainder.) The size is a
// step past the hardest fair share he has done in Number Park, at most 36 things on at most 6 plates.
export const SHARES=[{total:12,groups:3},{total:16,groups:4},{total:18,groups:3},{total:20,groups:4},{total:24,groups:4},{total:24,groups:6},{total:25,groups:5},{total:27,groups:3},{total:28,groups:4},{total:30,groups:5},{total:30,groups:6},{total:32,groups:4},{total:36,groups:6}];
export function shareBeat(id,r,{thing=['cookies','cookie'],shares=[],floor=null}={}){
 const done=(shares||[]).filter(s=>s?.total&&s?.groups),top=done.reduce((m,s)=>Math.max(m,s.total),0);
 const span=([lo,hi])=>lo+Math.floor(r()*(hi-lo+1)),fg=floor?.share?span(floor.share.groups):0,fe=floor?.share?span(floor.share.each):0;
 const pool=SHARES.filter(s=>top?s.total>top&&s.total<=top+12:s.total<=20&&s.total>=12),{total,groups}=floor?.share?{total:fg*fe,groups:fg}:pick(pool.length?pool:SHARES.slice(4,9),r),each=total/groups;
 return {id,kind:'share',total,groups,thing:thing[0],prop:thing[1],basket:'snack-basket',answer:String(each),options:numOptions(each,r,[each+1,each-1]),
  what:`${total} ${thing[0]} must be shared fairly on ${groups} plates, the same on every plate; he deals them round by round from the basket and says how many are on each plate`,
  spoken:`${total} ${thing[0]}, shared fairly on ${say(groups)} plates. Tap the basket to deal one onto every plate.`,ask:`How many ${thing[0]} on each plate?`,done:`Yes! ${cap(say(each))} on every plate.`};
}
const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
// A times fact he knows is a fact he can turn round: the facts he is still stuck on first, then his tables (3 to 9).
// avoid: products already used in the chapter (the NO! never repeats the division he just did).
function factPair(r,facts=[],avoid=[]){const stuck=(facts||[]).map(f=>String(f).split('x').map(Number)).filter(([a,b])=>a>=3&&b>=3&&a<=10&&b<=10&&!avoid.includes(a*b));
 if(stuck.length&&r()<0.7)return shuffle(pick(stuck,r),r);let a,b,k=0;do{a=4+Math.floor(r()*6);b=4+Math.floor(r()*6);}while(((a===b&&r()<0.7)||avoid.includes(a*b))&&k++<50);return [a,b];}
// Mental division in a real place: things packed into boxes (a bakery's rolls in boxes of four).
export function divideBeat(id,r,{facts=[],things='rolls',into='boxes',avoid=[]}={}){
 const [d,q]=factPair(r,facts,avoid),c=d*q;
 return {id,kind:'puzzle',variant:'divide',display:`${c} ÷ ${d}`,answer:String(q),options:numOptions(q,r,[q+1,q-1,d]),
  what:`${c} ${things} go into ${into} of ${d}; he works out in his head how many ${into} they fill (${c} divided by ${d})`,
  spoken:`${c} ${things} go into ${into} of ${say(d)}. How many ${into}? ${c} divided by ${say(d)}.`,hint:`How many ${plural(d)} make ${c}? Count up in ${plural(d)}.`,done:`Yes! ${cap(say(q))} ${into}.`};
}
// Times facts in a real place: trays of muffins.
export function timesBeat(id,r,{facts=[],things='muffins',groups='trays',avoid=[]}={}){
 const [a,b]=factPair(r,facts,avoid),ans=a*b;
 return {id,kind:'puzzle',variant:'times',display:`${a} × ${b}`,answer:String(ans),options:numOptions(ans,r,[ans+a,ans-b,ans+1]),
  what:`${a} ${groups} with ${b} ${things} on each; he works out how many ${things} in his head (${a} times ${b})`,
  spoken:`${cap(say(a))} ${groups}, ${say(b)} ${things} on each. What is ${say(a)} times ${say(b)}?`,hint:`Count in ${plural(b)}, ${say(a)} times.`,done:`Yes! ${ans} ${things}!`};
}
// The NO! beat as a division mix-up: a friend insists 24 ÷ 4 is 5; he says NO! and gives the right share.
export function divideNoBeat(id,r,{facts=[],who=null,whoName='a friend',avoid=[]}={}){
 const [d,q]=factPair(r,facts,avoid),c=d*q,wrong=q+(r()<0.5?1:-1);
 return {id,kind:'no',what:`${whoName} insists "${c} ÷ ${d} = ${wrong}" and wants to put that on the order slip; he says NO! and fixes it`,who,whoName,
  claim:`${c} divided by ${say(d)} is ${say(wrong)}!`,display:`${c} ÷ ${d} = ${wrong}`,ask:`Can I write ${say(wrong)} on the order slip? Can I? Please?`,wrong:String(wrong),right:String(q),options:shuffle([String(q),String(wrong),String(q+(wrong>q?-1:1)*2)],r),
  ifYes:`Oops! That does not share out fairly. Hmm.`,caught:`You said NO! ${c} divided by ${say(d)} is ${say(q)}, not ${say(wrong)}.`,fixSpoken:`What is ${c} divided by ${say(d)}?`,hint:`How many ${plural(d)} make ${c}?`};
}
// never a chessboard drawn over the painted scene: pieces are named aloud, their values shown and said.
export const PIECE_VALUES={pawn:1,knight:3,bishop:3,rook:5,queen:9};
const an=w=>/^[aeiou]/.test(w)?'an':'a';
// Captured pieces: how many points?
export function chessPointsBeat(id,r){
 const kinds=['queen','rook','bishop','knight','pawn'];let got;do{got=shuffle(kinds,r).slice(0,2+Math.floor(r()*2));}while(got.reduce((a,k)=>a+PIECE_VALUES[k],0)<8);
 got.sort((a,b)=>PIECE_VALUES[b]-PIECE_VALUES[a]);const vals=got.map(k=>PIECE_VALUES[k]),ans=vals.reduce((a,b)=>a+b,0);
 const list=got.map(k=>`${an(k)} ${k}`),said=list.length>2?list.slice(0,-1).join(', ')+' and '+list.at(-1):list.join(' and ');
 return {id,kind:'puzzle',variant:'points',display:vals.join(' + '),answer:String(ans),options:numOptions(ans,r,[ans+1,ans-1,ans+3]),pieces:got,
  what:`in the chess game he captured ${said}; he adds up their points in his head (${got.map(k=>`${k} ${PIECE_VALUES[k]}`).join(', ')})`,
  spoken:`You captured ${said}. ${got.map(k=>`${cap(an(k))} ${k} is worth ${say(PIECE_VALUES[k])}`).filter((x,i,a)=>a.indexOf(x)===i).join('. ')}. How many points?`,
  hint:'Add the points, the biggest first.',done:`Yes! ${ans} points!`};
}
// The pieces captured in a real game at the family table (2026-10-01: drawn on the floor beside the board, the painted
// pieces at their real size, no card over the picture): Dad's captures are his cream pieces, his are Dad's dark ones.
// Who is ahead, and by how many points? The answer is a side and a number ("me:3"); values are his to know (hint).
export function chessCapturesBeat(id,r,{many=false}={}){
 const kinds=['queen','rook','bishop','knight','pawn'],side=()=>shuffle(kinds,r).slice(0,(many?2:1)+Math.floor(r()*2)).sort((a,b)=>PIECE_VALUES[b]-PIECE_VALUES[a]),sum=a=>a.reduce((x,k)=>x+PIECE_VALUES[k],0);
 let dad,me;do{dad=side();me=side();}while(sum(dad)===sum(me)||Math.abs(sum(dad)-sum(me))>5);
 const diff=Math.abs(sum(me)-sum(dad)),ahead=sum(me)>sum(dad)?'me':'dad',other=ahead==='me'?'dad':'me',ans=`${ahead}:${diff}`;
 const opts=[ans,`${other}:${diff}`,`${ahead}:${diff+(diff>1&&r()<0.5?-1:1)}`];
 const list=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a.at(-1):a[0];
 return {id,kind:'puzzle',variant:'captures',captures:{dad,hero:me},answer:ans,options:shuffle(opts,r),
  what:`a chess game at the table: Dad captured his ${list(dad)}, he captured Dad's ${list(me)}; the captured pieces stand beside the board and he works out who is ahead and by how many points`,
  spoken:`Dad captured your ${list(dad)}. You captured his ${list(me)}. Who is ahead, and by how many points?`,
  hint:'A queen is nine, a rook five, a bishop or a knight three, a pawn one.',done:ahead==='me'?`Yes! You are ${say(diff)} ${diff===1?'point':'points'} ahead.`:`Yes! Dad is ${say(diff)} ${diff===1?'point':'points'} ahead. Time to win them back!`};
}
// Who is ahead, and by how much? Two sides with different pieces (never equal).
export function chessAheadBeat(id,r){
 const kinds=['queen','rook','bishop','knight','pawn'],side=()=>shuffle(kinds,r).slice(0,2+Math.floor(r()*2)).sort((a,b)=>PIECE_VALUES[b]-PIECE_VALUES[a]),sum=a=>a.reduce((x,k)=>x+PIECE_VALUES[k],0);
 let w,b;do{w=side();b=side();}while(sum(w)===sum(b)||Math.abs(sum(w)-sum(b))>6);
 const ahead=sum(w)>sum(b)?'cream':'dark',ans=Math.abs(sum(w)-sum(b));const names=a=>a.map(k=>`${an(k)} ${k}`).join(' and ');
 return {id,kind:'puzzle',variant:'ahead',display:'Who is ahead?',lines:[`⚪ ${w.map(k=>PIECE_VALUES[k]).join(' + ')}`,`⚫ ${b.map(k=>PIECE_VALUES[k]).join(' + ')}`],answer:String(ans),options:numOptions(ans,r,[ans+1,ans+2]),sides:{cream:w,dark:b},ahead,
  what:`cream has ${names(w)}, dark has ${names(b)}; he adds each side's points and works out how many points ${ahead} is ahead`,
  spoken:`Cream has ${names(w)}: ${w.map(k=>say(PIECE_VALUES[k])).join(' plus ')}. Dark has ${names(b)}: ${b.map(k=>say(PIECE_VALUES[k])).join(' plus ')}. How many points is ${ahead} ahead?`,
  hint:'Add each side, then take the smaller from the bigger.',done:`Yes! ${cap(ahead)} is ${say(ans)} ahead.`};
}
// The fork: two ways on (both fine); the chosen way gives the chapter's quest item.
export const FORKS=[
 [{id:'cave',emoji:'🐉',label:'the Dragon Cave',item:{id:'dragon-scale',name:'a dragon scale',emoji:'🐉'}},{id:'lake',emoji:'💎',label:'the Crystal Lake',item:{id:'crystal',name:'a glowing crystal',emoji:'💎'}}],
 [{id:'tower',emoji:'🗼',label:'the Wizard Tower',item:{id:'wand',name:'a silver wand',emoji:'🪄'}},{id:'woods',emoji:'🌲',label:'the Dark Woods',item:{id:'owl-feather',name:'an owl feather',emoji:'🪶'}}],
 [{id:'bridge',emoji:'🌉',label:'the Rope Bridge',item:{id:'compass',name:'a star compass',emoji:'🧭'}},{id:'tunnel',emoji:'🚇',label:'the Secret Tunnel',item:{id:'lantern',name:'a magic lantern',emoji:'🏮'}}],
 [{id:'mountain',emoji:'🏔️',label:'the Snowy Peak',item:{id:'snow-star',name:'a snow star',emoji:'❄️'}},{id:'desert',emoji:'🏜️',label:'the Sand Dunes',item:{id:'sun-stone',name:'a sun stone',emoji:'☀️'}}],
 [{id:'castle',emoji:'🏰',label:'the Old Castle',item:{id:'key-of-rooms',name:'a castle key',emoji:'🗝️'}},{id:'ship',emoji:'⛵',label:'the Pirate Ship',item:{id:'spyglass',name:'a spyglass',emoji:'🔭'}}],
];
export function forkBeat(id,r,{date='',have=[]}={}){
 // Ways whose treasures are both new first, then ways with one new treasure (never two things he already has).
 const none=FORKS.filter(f=>!f.some(o=>have.includes(o.item.id))),fresh=none.length?none:FORKS.filter(f=>!f.every(o=>have.includes(o.item.id)));
 const f=(fresh.length?fresh:FORKS)[(Number(String(date).replace(/-/g,''))||Math.floor(r()*99))%(fresh.length||FORKS.length)];
 return {id,kind:'fork',options:f.map(o=>({...o,reply:`${o.label[0].toUpperCase()+o.label.slice(1)}! Brave choice.`})),
  what:`a fork in the line: two ways on, ${f[0].label} or ${f[1].label}; he chooses (both are fine, both lead on to the next stop); each way hides a different treasure for his spellbook (${f[0].item.name} or ${f[1].item.name})`,
  spoken:`Two ways on! ${f[0].label[0].toUpperCase()+f[0].label.slice(1)}, or ${f[1].label}? You choose!`};
}
// The quest beats for today: two puzzles (flavoured by an interest detail when one fits), exact sharing or another
// puzzle on quieter days, and the fork. Rotates by date so no two days look the same.
export function questBeats(model,{date,details=[],have=[],floor=null}={}){
 const r=rng(`quest:${model.player}:${date}`),m=model.math||{},flav=new Set(details.map(d=>d.id));
 const food=flav.has('mcdonalds')?['chicken nuggets','chicken-nugget']:pick([['cookies','cookie'],['grapes','grape'],['pizza slices','pizza-slice']],r);
 const makers=[
  i=>skipBeat(i,r,{steps:(floor?.tables||[2,3,5,10,...(m.tables||[])]).filter(n=>n>=2&&n<=10),flavor:flav.has('pull-ups')?'pull-ups':null,max:floor?.tables?100:50}),
  i=>ninesBeat(i,r,{facts:m.factsStuck||[]}),
  i=>lockBeat(i,r,{floor}),
  i=>routeBeat(i,r,{flavor:flav.has('american football')?'american football':null}),
  // (equal sharing, never a remainder: see shareBeat)
  i=>shareBeat(i,r,{thing:food,shares:m.hardShares,floor}),
 ];
 // Interest-flavoured makers first (they are the day's details), then the rest in a date-seeded order.
 const first=[flav.has('pull-ups')?0:null,flav.has('american football')?3:null,flav.has('mcdonalds')?4:null].filter(x=>x!==null);
 const order=[...first,...shuffle([0,1,2,3,4].filter(k=>!first.includes(k)),r)].slice(0,2);
 return {puzzles:order.map((k,j)=>makers[k](`q${j+1}`)),fork:forkBeat('q3',r,{date,have})};
}
// Interest details: at most two per chapter, rotating by date; a detail pinned to a date window (Michaelmas,
// 29 September) always comes first inside its window.
export function chooseDetails(profile,{date='',max=2,avoid=new Set()}={}){
 const all=(profile?.details||[]).filter(d=>d&&d.id&&d.seed&&!avoid.has(d.id));if(!all.length)return [];
 const md=String(date).slice(5),inWindow=d=>Array.isArray(d.window)&&md>=d.window[0]&&md<=d.window[1];
 const pinned=all.filter(inWindow),rest=all.filter(d=>!Array.isArray(d.window));
 const r=rng(`details:${date}`),n=Math.min(max,1+Math.floor(r()*max));
 return [...pinned,...shuffle(rest,r)].slice(0,Math.max(n,pinned.length?1:0)).slice(0,max);
}
// Every thing a game page draws must be a DRAWN library prop (the plates, the basket, the nuggets, what he counts).
// A thing without a drawing is swapped for a drawn one; a game whose plates or basket are missing becomes a number
// lock (never shipped with placeholder shapes). Returns notes for the log.
export function drawnBeats(plan,library,{countThings=[]}={}){
 const notes=[],has=id=>!!library?.props?.[id],r=rng(`drawn:${plan.player}:${plan.date}`);
 const FOODS=[['chicken nuggets','chicken-nugget'],['cookies','cookie'],['grapes','grape'],['pizza slices','pizza-slice']];
 plan.beats=(plan.beats||[]).map(b=>{const miss=missingBeatProps(b,library);if(!miss.length)return b;
  if(b.kind==='count'){const alt=countThings.find(([id])=>has(id));if(alt){const [thing,things,emoji]=alt;notes.push(`count: no drawing of ${miss.join(', ')}, counting ${things} instead`);
    return {...b,thing,things,emoji,spoken:`Tap each one to count the ${things}.`,ask:`How many ${things}?`,what:String(b.what||'').replace(b.things,things)};}}
  if(b.kind==='remainder'&&has('plate')&&has('snack-basket')){const alt=FOODS.find(([,id])=>has(id));
   if(alt){notes.push(`remainder: no drawing of ${miss.join(', ')}, sharing ${alt[0]} instead`);const n=remainderBeat(b.id,()=>0.5,{thing:alt});return {...b,...n,total:b.total,groups:b.groups,answer:b.answer,options:b.options,
    what:b.what.replace(b.thing,alt[0]),spoken:b.spoken.replace(b.thing,alt[0]),ask:b.ask.replace(b.thing,alt[0])};}}
  notes.push(`${b.kind}: no drawing of ${miss.join(', ')}, a number lock instead`);return lockBeat(b.id,r);});
 return notes;
}
