// Quest-style chapters for an older reader whose READING is still early (word families) but whose maths and logic
// are ahead: the chapter plays like a game. Deterministic (seeded by the date), no LLM.
//  - puzzle beats at his real level: skip counting, the 9s finger trick, a logic lock, a map route (a football
//    play card when he plays football), each shown as numbers and symbols (anything he must READ stays decodable;
//    clues are spoken TO him);
//  - a remainder beat: deal things fairly onto plates, then say how many are left over;
//  - a fork: two ways on, both fine; the one he picks decides the chapter's quest item (it goes in his spellbook).
// Interest details (both children): one or two small story touches per chapter from the household's private
// profile ("details"), e.g. pancakes, capes, McDonald's; a detail may also flavour a beat (pull-ups -> skip counting).
// Same seeded generator as plan.mjs (kept here to avoid a circular import).
function rng(seedText){let h=2166136261;for(const c of String(seedText)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

const WORD_NUM=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const say=n=>WORD_NUM[n]||String(n);
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=(a,r)=>a[Math.floor(r()*a.length)];
// Three distinct number options around an answer (always positive, answer included).
export function numOptions(ans,r,near=[]){const set=new Set([String(ans)]);for(const x of [...near,ans+1,ans-1,ans+2,ans+10,ans-2])if(set.size<3&&x>0&&x!==ans)set.add(String(x));return shuffle([...set],r);}

// Skip counting: a sequence with one gap. Pull-ups flavour: the friend counts his pull-ups on the bar.
export function skipBeat(id,r,{steps=[2,3,5,10],flavor=null}={}){
 const ok=steps.filter(st=>st*5<=50),step=pick(ok.length?ok:[2],r),start=step*(1+Math.floor(r()*Math.min(2,Math.floor(50/step)-4))),seq=Array.from({length:5},(_,i)=>start+i*step),gap=2+Math.floor(r()*2),ans=seq[gap];
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
export function lockBeat(id,r){
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
export function routeBeat(id,r,{flavor=null}={}){
 const football=flavor==='american football';
 // No two equal steps in a row ("15 plus 15 plus" says the same thing twice).
 const parts=()=>{let a;do{a=Array.from({length:2+Math.floor(r()*2)},()=>(football?5:1)*(1+Math.floor(r()*(football?4:6))));}while(a.some((x,i)=>i&&x===a[i-1]));return a;};
 let routes;do{routes=ROUTES.map(([c,e])=>({c,e,steps:parts()}));routes.forEach(x=>x.sum=x.steps.reduce((a,b)=>a+b,0));}
 while(new Set(routes.map(x=>x.sum)).size<3);
 const best=routes.reduce((a,b)=>football?(b.sum>a.sum?b:a):(b.sum<a.sum?b:a));
 return {id,kind:'puzzle',variant:football?'playcard':'route',lines:routes.map(x=>`${x.e} ${x.steps.join(' + ')}`),labels:Object.fromEntries(routes.map(x=>[x.c,x.e])),
  display:football?'Play card':'Map',answer:best.c,options:routes.map(x=>x.c),
  what:football?`an American-football huddle: a play card shows three running routes with their yards; he calls the play that gains the most yards`:`a map shows three routes to the next stop with their steps; he adds them up and picks the shortest`,
  spoken:(football?`Huddle up! Three routes on the play card. `:`Three routes on the map. `)+routes.map(x=>`${x.c[0].toUpperCase()+x.c.slice(1)}: ${x.steps.join(' plus ')}.`).join(' ')+(football?` Which one gains the most yards?`:` Which route is shortest?`),
  hint:football?`Add each route. The biggest total wins.`:`Add each route. The smallest total wins.`,done:football?`Touchdown! The ${best.c} route gains ${best.sum} yards!`:`Yes! The ${best.c} route is only ${best.sum} steps!`};
}
// Remainders with objects: deal them onto plates, then how many are left over.
export function remainderBeat(id,r,{thing=['cookies','🍪']}={}){
 let groups,total;do{groups=2+Math.floor(r()*4);total=groups*(2+Math.floor(r()*3))+1+Math.floor(r()*(groups-1));}while(total%groups===0||total>20);
 const left=total%groups;
 return {id,kind:'remainder',total,groups,thing:thing[0],emoji:thing[1],answer:String(left),options:numOptions(left,r,[left+1,groups]),
  what:`${total} ${thing[0]} must be shared fairly on ${groups} plates; he deals them round by round, and some are left over`,
  spoken:`${total} ${thing[0]}, shared fairly on ${say(groups)} plates. Tap the box to deal one onto every plate.`,ask:`${total} ${thing[0]} on ${say(groups)} plates: how many are left over?`,done:`Yes! ${say(left)} left over.`};
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
 const fresh=FORKS.filter(f=>!f.every(o=>have.includes(o.item.id)));
 const f=(fresh.length?fresh:FORKS)[(Number(String(date).replace(/-/g,''))||Math.floor(r()*99))%(fresh.length||FORKS.length)];
 return {id,kind:'fork',options:f.map(o=>({...o,reply:`${o.label[0].toUpperCase()+o.label.slice(1)}! Brave choice.`})),
  what:`a fork in the line: two ways on, ${f[0].label} or ${f[1].label}; he chooses (both are fine, both lead on to the next stop); each way hides a different treasure for his spellbook (${f[0].item.name} or ${f[1].item.name})`,
  spoken:`Two ways on! ${f[0].label[0].toUpperCase()+f[0].label.slice(1)}, or ${f[1].label}? You choose!`};
}
// The quest beats for today: two puzzles (flavoured by an interest detail when one fits), a remainder or a third
// puzzle on quieter days, and the fork. Rotates by date so no two days look the same.
export function questBeats(model,{date,details=[],have=[]}={}){
 const r=rng(`quest:${model.player}:${date}`),m=model.math||{},flav=new Set(details.map(d=>d.id));
 const food=flav.has('mcdonalds')?['chicken nuggets','🍗']:pick([['cookies','🍪'],['grapes','🍇'],['pizza bites','🍕']],r);
 const makers=[
  i=>skipBeat(i,r,{steps:[2,3,5,10,...(m.tables||[])].filter(n=>n>=2&&n<=10),flavor:flav.has('pull-ups')?'pull-ups':null}),
  i=>ninesBeat(i,r,{facts:m.factsStuck||[]}),
  i=>lockBeat(i,r),
  i=>routeBeat(i,r,{flavor:flav.has('american football')?'american football':null}),
  i=>remainderBeat(i,r,{thing:food}),
 ];
 // Interest-flavoured makers first (they are the day's details), then the rest in a date-seeded order.
 const first=[flav.has('pull-ups')?0:null,flav.has('american football')?3:null,flav.has('mcdonalds')?4:null].filter(x=>x!==null);
 const order=[...first,...shuffle([0,1,2,3,4].filter(k=>!first.includes(k)),r)].slice(0,2);
 return {puzzles:order.map((k,j)=>makers[k](`q${j+1}`)),fork:forkBeat('q3',r,{date,have})};
}
// Interest details: at most two per chapter, rotating by date; a detail pinned to a date window (Michaelmas,
// 29 September) always comes first inside its window.
export function chooseDetails(profile,{date='',max=2}={}){
 const all=(profile?.details||[]).filter(d=>d&&d.id&&d.seed);if(!all.length)return [];
 const md=String(date).slice(5),inWindow=d=>Array.isArray(d.window)&&md>=d.window[0]&&md<=d.window[1];
 const pinned=all.filter(inWindow),rest=all.filter(d=>!Array.isArray(d.window));
 const r=rng(`details:${date}`),n=Math.min(max,1+Math.floor(r()*max));
 return [...pinned,...shuffle(rest,r)].slice(0,Math.max(n,pinned.length?1:0)).slice(0,max);
}
