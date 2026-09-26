// Word break: a short, always-passable letter/word checkpoint shared by the family games.
// Identical copy in every game repo (tests compare siblings). No dependencies; browser + Node.
// Content follows each child's Letter Quest progress (read on the server, never written).
export const WORD_BREAK_VERSION='word-break-2026-09-26-3';
// Speech contract for every game: speak(line, essential).
// essential=true -> CONTENT the child needs to answer (the letter/word/sentence to find). Games play it even when
// their sound toggle is off. essential=false -> praise/feedback, which obeys the toggle.
// INSTRUCTIONS (how to play) are said once per session: gate them with onceThisSession(key).
export const IDLE_REPEAT_MS=6500,IDLE_REPEATS=2;
export function onceThisSession(key,store=globalThis.sessionStorage){
 try{const k='said-once:'+key;if(store.getItem(k))return false;store.setItem(k,'1');return true;}catch{return true;}
}
export const DEFAULT_TRACK={beginner:'letters',explorer:'words',admin:'mixed'};
const LQ_ORDER='FRANCISOETLHDMBPUKGWYVZXJQ';
const LOOKALIKE={b:'dpq',d:'bpq',p:'qbd',q:'pgd',m:'nw',n:'mhu',u:'nv',w:'mv',v:'wy',i:'lj',l:'it',t:'lf',e:'ca',c:'eo',a:'od',o:'ac',g:'qj',h:'nb',j:'ig',k:'hx',f:'tl',r:'nv',s:'zc',x:'kz',y:'vg',z:'sx',
 E:'FLB',F:'EPT',L:'ITJ',M:'NWH',N:'MZH',O:'QCD',P:'RBF',R:'PBK',B:'PRD',C:'OGQ',G:'COQ',W:'MVN',V:'WYU',U:'VJO',I:'LTJ',T:'ILF',K:'XRH',X:'KYZ',Y:'VXT',Z:'NSX',S:'ZGC',D:'OBP',H:'NAK',A:'HVR',J:'LUI',Q:'OGC'};
// Pictures a pre-reader can name; the first sound is the plain letter sound.
export const FIRST_WORDS=[['ant','🐜'],['bus','🚌'],['bed','🛏️'],['cat','🐱'],['cup','☕'],['dog','🐶'],['duck','🦆'],['egg','🥚'],['fox','🦊'],['fish','🐟'],['goat','🐐'],['gift','🎁'],['hat','🎩'],['hen','🐔'],['jam','🍯'],['kite','🪁'],['key','🔑'],['leg','🦵'],['lion','🦁'],['moon','🌙'],['milk','🥛'],['nut','🥜'],['nest','🪺'],['octopus','🐙'],['pig','🐷'],['pen','🖊️'],['queen','👸'],['rat','🐀'],['ring','💍'],['robot','🤖'],['sun','☀️'],['sock','🧦'],['tree','🌳'],['tiger','🐯'],['umbrella','☂️'],['van','🚐'],['web','🕸️'],['whale','🐋'],['yo-yo','🪀'],['zebra','🦓']];
// Look-alike word groups: the child must read the letters, not guess from shape or length.
export const WORD_GROUPS=[
 [['cat','hat','mat','bat'],['dog','log','fog','hog'],['sun','run','fun','bun'],['pig','big','wig','dig'],['hen','pen','ten','men'],['bug','mug','rug','hug'],['cap','map','tap','nap'],['pot','hot','dot','got'],['bed','red','fed','led'],['pin','fin','tin','win'],['jet','net','pet','wet'],['sit','sat','set','sip'],['cup','cap','cop','pup']],
 [['ship','shop','chip','chop'],['fish','dish','wish','with'],['frog','from','fog','flop'],['duck','dock','deck','luck'],['drum','drop','drip','trim'],['flag','flat','flap','slap'],['sock','sack','rock','lock'],['king','ring','wing','sing'],['bath','math','path','both'],['crab','grab','crib','cram'],['milk','mill','silk','mint'],['swim','slim','skim','swam']],
 [['train','brain','rain','trail'],['snail','sail','nail','snarl'],['sheep','sheet','sleep','shoot'],['beach','bench','reach','peach'],['brush','crush','blush','bush'],['shark','share','sharp','spark'],['whale','while','white','wheel'],['black','block','blank','clock'],['track','trick','truck','trace'],['stamp','stomp','stump','steam'],['green','greet','grain','queen'],['cloud','clown','proud','cold']]
];
// One shared sentence bank (word breaks, Sentence Express, Sentence studio). Fun, concrete scenes for a young
// reader with a few recurring friends (Bo the bear, Max, Mom, Dad, Cookie Buddy): soccer, robots, chess,
// dinos, rockets, pizza, silly jumps. Names sit at the start, middle or end; said/asked come early, never
// second to last; most sentences have several capitals. Level 1 stays with short, decodable and sight words.
export const SENTENCES=[
 ['Bo and Max run to the net.','Dad said Max can kick it.','Can Max hop on a big log?','Mom and Bo got a hot dog.','Max said the pup can jump.','A red bug sat on Bo.','Is Bo in the net?','Mom let Max kick the ball.','Bo and Dad dig in the mud.','Did Max win the cup?','The fox ran up to Bo and Max.','Dad asked Bo to hop up.'],
 ['Max kicks the ball past Dad.','Bo said the robot can jump.','Cookie Buddy eats six cookies.','Did Max win the chess match?','Mom asked Bo to catch the ball.','A frog jumps on Max at chess.','Dad and Max fix the rocket.','Can Bo spin on one leg?','Max kicks a goal and Bo claps.','The big dino stomps past Mom.','Bo gets a slice of hot pizza.','Is the robot in goal for Max?'],
 ['Bo asked Dad to build a rocket.','Cookie Buddy and Max bake green cookies.','Max and the robot score a goal.','Dad said the dinosaur is sleeping.','Can Bo beat Mom at chess today?','Why did the rocket zoom past Max?','Bo jumped over three sleeping sheep.','Did Cookie Buddy eat the chess queen?','Mom and Bo eat pizza by the stream.','The goalie dives but Max still scores.','Dad asked Max to clean the chess board.','A dinosaur stole the ball from Bo.']
];
// Look-alike distractor tiles for sentence levels 2-3 (never a word already in the sentence).
export const SENTENCE_DISTRACT={cat:'cot',big:'bag',hen:'pen',pig:'peg',hop:'hip',hops:'hips',run:'ran',ran:'run',sat:'sit',got:'get',get:'got',gets:'jets',red:'rod',ship:'shop',frog:'from',duck:'dock',rock:'rack',fish:'dish',log:'leg',pond:'pod',flag:'flat',drum:'drop',hill:'hall',fox:'fix',fix:'fox',wet:'wit',cup:'cap',hat:'hot',sun:'son',bus:'bun',jump:'dump',swim:'swam',shop:'chop',stop:'step',step:'stop',snack:'snake',black:'block',whale:'while',sheep:'sheet',brush:'crush',shell:'shelf',train:'trail',fast:'last',spot:'spit',smile:'mile',beach:'bench',found:'round',
 kicks:'kids',ball:'bell',past:'pest',robot:'robin',chess:'chest',match:'patch',catch:'cash',clock:'click',rocket:'pocket',spin:'spit',leg:'log',goal:'gold',claps:'clips',stomps:'stamps',slice:'slide',hot:'hat',pizza:'pinch',six:'sit',build:'built',bake:'bike',green:'greet',score:'store',sleeping:'sweeping',beat:'boat',zoom:'room',jumped:'bumped',three:'tree',queen:'green',stream:'scream',dives:'dimes',still:'spill',clean:'clear',board:'bored',stole:'stale'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=(a,r=Math.random)=>a[Math.floor(r()*a.length)];
export function shuffle(a,r=Math.random){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
// Carriage order never keeps the sentence order, and never simply rotates it.
export function scramble(words,r=Math.random){
 if(words.length<2)return [...words];
 for(let k=0;k<40;k++){const out=shuffle(words,r);const fixed=out.filter((w,i)=>w===words[i]).length;const rotated=words.some((_,n)=>n&&words.every((w,i)=>w===out[(i+n)%out.length]));if(fixed<=1&&!rotated)return out;}
 return [...words.slice(1),words[0]].reverse();
}
export const tilesOf=sentence=>sentence.replace(/[.?!,]/g,'').split(' ');
export const endMark=sentence=>/[?!]$/.test(sentence)?sentence.at(-1):'.';
// Derive letter/word levels from a Letter Quest save (read-only). Missing save -> gentle defaults.
export function literacyFrom(save,track='mixed'){
 const out={version:WORD_BREAK_VERSION,track,source:'default',letters:[...LQ_ORDER.slice(0,8)],lower:[],learning:[],wordLevel:1,sentenceLevel:1};
 if(!save||typeof save!=='object')return out;
 const done=Math.max(0,Number(save.completed)||0),n=Math.min(26,3+Math.floor(done/2));
 out.source='letter-quest';
 out.letters=[...new Set([...LQ_ORDER.slice(0,n),...(Array.isArray(save.placement?.letters)?save.placement.letters.filter(c=>/^[A-Z]$/.test(c)):[])])];
 if(done>=12)out.lower=[...LQ_ORDER.slice(0,Math.min(26,Math.floor((done-10)/2)))].map(c=>c.toLowerCase());
 const skills=save.skills&&typeof save.skills==='object'?save.skills:{};
 out.learning=[...out.letters,...out.lower].filter(c=>(skills['find:'+c]?.level??0)<3);
 const n1=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):0;
 out.wordLevel=clamp(n1(save.maze?.practiceSkills?.reading?.level)||n1(save.reading?.skills?.decode?.level)||n1(save.foundation?.stage)||1,1,3);
 out.sentenceLevel=clamp(n1(save.reading?.skills?.sentence?.level)||1,1,3);
 return out;
}
function letterItem(level,r){
 const upper=level.letters.length?level.letters:[...LQ_ORDER.slice(0,8)];
 const pool=r()<.65&&level.learning.length?level.learning:[...upper,...level.lower];
 const target=pick(pool,r),lower=/^[a-z]$/.test(target);
 if(r()<.4){
  const known=new Set(upper.map(c=>c.toLowerCase()));
  const words=FIRST_WORDS.filter(([w])=>known.has(w[0]));
  if(words.length){
   const [word,picture]=pick(words,r),answer=word[0].toUpperCase();
   const near=[...(LOOKALIKE[answer]||'')].filter(c=>c!==answer),others=shuffle(upper.filter(c=>c!==answer&&!near.includes(c)),r);
   return {kind:'first-letter',spoken:`Which letter does ${word} start with?`,picture,word,answer,options:shuffle([answer,...[...shuffle(near,r),...others].slice(0,2)],r)};
  }
 }
 const pool2=lower?'abcdefghijklmnopqrstuvwxyz':'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 const near=[...(LOOKALIKE[target]||'')].filter(c=>c!==target),filler=shuffle([...pool2].filter(c=>c!==target&&!near.includes(c)),r);
 const options=shuffle([target,...[...shuffle(near,r),...filler].slice(0,lower?3:2)],r);
 return {kind:'find-letter',spoken:lower?`Find the little letter ${target.toUpperCase()}.`:`Find the letter ${target}.`,answer:target,options};
}
function wordItem(level,r){
 const group=pick(WORD_GROUPS[level.wordLevel-1],r),answer=pick(group,r);
 return {kind:'read-word',spoken:`Find the word ${answer}.`,answer,options:shuffle(group.slice(0,level.wordLevel===1?3:4).includes(answer)?group.slice(0,level.wordLevel===1?3:4):[answer,...group.filter(w=>w!==answer).slice(0,2)],r)};
}
function sentenceItem(level,r,recent=[]){
 const bank=SENTENCES[level.sentenceLevel-1],fresh=bank.filter(s=>!recent.includes(s)),sentence=pick(fresh.length?fresh:bank,r),answer=tilesOf(sentence);
 const extra=level.sentenceLevel>=2?answer.map(w=>SENTENCE_DISTRACT[w.toLowerCase()]).find(w=>w&&!answer.some(a=>a.toLowerCase()===w)):null;
 const tiles=scramble(extra?[...answer,extra]:answer,r);
 return {kind:'sentence',spoken:sentence,sentence,answer,tiles,mark:endMark(sentence)};
}
// One short item. Beginner-style track: letters; Explorer-style: words (sentences most often).
export function wordBreakItem(level,{r=Math.random,recent=[]}={}){
 const l={...literacyFrom(null),...level};
 const track=l.track==='mixed'?(r()<.5?'letters':'words'):l.track;
 if(track==='letters')return {...letterItem(l,r),track};
 return {...(r()<.6?sentenceItem(l,r,recent):wordItem(l,r)),track};
}
export const WORD_BREAK_FEEDBACK=['Yes!','Try again.','Great reading!'];
export function wordBreakLines(){
 const lines=new Set(WORD_BREAK_FEEDBACK);
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){lines.add(`Find the letter ${c}.`);lines.add(`Find the little letter ${c}.`);}
 for(const [w] of FIRST_WORDS)lines.add(`Which letter does ${w} start with?`);
 for(const g of WORD_GROUPS.flat())for(const w of g)lines.add(`Find the word ${w}.`);
 for(const s of SENTENCES.flat())lines.add(s);
 return [...lines];
}
// ---------- Browser UI ----------
const CSS=`dialog.wb{border:0;border-radius:28px;padding:0;max-width:min(94vw,760px);width:94vw;background:#fffaf0;color:#17324a;box-shadow:0 20px 60px #0005;font-family:ui-rounded,'Avenir Next',system-ui,sans-serif}
dialog.wb:focus{outline:none}
.wb-choice:focus:not(:focus-visible),.wb-hear:focus:not(:focus-visible){outline:none}
dialog.wb::backdrop{background:#10284099;backdrop-filter:blur(3px)}
.wb-card{padding:22px 22px 26px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.wb-top{display:flex;width:100%;justify-content:space-between;align-items:center}
.wb-eyebrow{margin:0;font-weight:900;letter-spacing:.18em;font-size:.85rem;color:#c0521f}
.wb-hear{border:0;background:#e9f1f7;border-radius:50%;width:64px;height:64px;font-size:1.9rem;cursor:pointer}
.wb-picture{font-size:clamp(4rem,14vw,7rem);line-height:1}
.wb-built{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:62px;align-items:center}
.wb-slot{min-width:70px;height:58px;border-bottom:4px solid #9fb5c6;display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:800;padding:0 6px}
.wb-slot.filled{border-color:#2f9b64;color:#1b6b43}
.wb-mark{font-size:2rem;font-weight:900}
.wb-choices{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.wb-choice{border:3px solid #cddbe6;background:#fff;color:#17324a;border-radius:20px;min-width:110px;min-height:110px;font-size:clamp(3rem,10vw,4.6rem);font-weight:850;cursor:pointer;padding:6px 18px;box-shadow:0 5px 0 #cddbe6;touch-action:manipulation;font-family:inherit}
.wb-words .wb-choice{font-size:clamp(1.7rem,6vw,2.5rem);min-height:78px;min-width:96px}
.wb-choice.right{background:#dff7e7;border-color:#2f9b64;box-shadow:0 5px 0 #2f9b64}
.wb-choice.used{visibility:hidden}
.wb-choice.wiggle{animation:wb-wiggle .45s}
.wb-choice.glow{animation:wb-glow 1.2s ease-in-out infinite;border-color:#f0a020}
@keyframes wb-wiggle{0%,100%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(10px)}60%{transform:translateX(-7px)}80%{transform:translateX(5px)}}
@keyframes wb-glow{0%,100%{box-shadow:0 0 0 0 #f0a02066}50%{box-shadow:0 0 0 12px #f0a02000}}
.wb-done{font-size:2.4rem;font-weight:900;color:#1b6b43;margin:0}
@media (prefers-reduced-motion:reduce){.wb-choice.wiggle,.wb-choice.glow{animation:none}}
@media (max-height:560px){.wb-card{gap:10px;padding:14px}.wb-choice{min-height:84px;min-width:90px}.wb-picture{font-size:3.6rem}}`;
function styles(doc){
 if(doc.__wordBreakStyles)return;doc.__wordBreakStyles=true;
 try{const sheet=new CSSStyleSheet();sheet.replaceSync(CSS);doc.adoptedStyleSheets=[...doc.adoptedStyleSheets,sheet];}
 catch{const s=doc.createElement('style');s.textContent=CSS;doc.head.append(s);}
}
function chime(ok){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;const c=chime.ctx??=new C();void c.resume();const t=c.currentTime;(ok?[523,659,784]:[196]).forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(0,t+i*.1);g.gain.linearRampToValueAtTime(ok?.08:.06,t+i*.1+.01);g.gain.exponentialRampToValueAtTime(.001,t+i*.1+.25);o.connect(g).connect(c.destination);o.start(t+i*.1);o.stop(t+i*.1+.3);});}catch{}}
const recentKey=player=>'word-break-recent:'+player;
function readRecent(player){try{return JSON.parse(localStorage.getItem(recentKey(player))||'[]').slice(-6);}catch{return [];}}
function remember(player,item){try{const r=readRecent(player);r.push(item.sentence||item.answer);localStorage.setItem(recentKey(player),JSON.stringify(r.slice(-6)));}catch{}}
export async function fetchWordLevel(url,fallbackTrack='mixed'){
 try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(4000)});if(r.ok){const j=await r.json();if(j&&j.track)return j;}}catch{}
 return literacyFrom(null,fallbackTrack);
}
// Opens the checkpoint and resolves once the child answers. Wrong taps wiggle; after two, the answer glows.
// effects: false (or a function returning false) mutes the chimes when the game's effects toggle is off.
export function wordBreak({player='admin',level,speak=()=>{},log=()=>{},reason='',doc=globalThis.document,r=Math.random,item,effects=true}={}){
 const ding=ok=>{if(typeof effects==='function'?effects():effects)chime(ok);};
 styles(doc);
 const lvl=level||literacyFrom(null,DEFAULT_TRACK[player]||'mixed'),q=item||wordBreakItem(lvl,{r,recent:readRecent(player)}),started=Date.now();
 const d=doc.createElement('dialog');d.className='wb';d.dataset.kind=q.kind;d.setAttribute('aria-label',q.track==='letters'?'Letter break':'Word break');
 const card=doc.createElement('div');card.className='wb-card';d.append(card);
 const top=doc.createElement('div');top.className='wb-top';const eyebrow=doc.createElement('p');eyebrow.className='wb-eyebrow';eyebrow.textContent=q.track==='letters'?'LETTER BREAK':'WORD BREAK';
 const hear=doc.createElement('button');hear.type='button';hear.className='wb-hear';hear.textContent='🔊';hear.setAttribute('aria-label','Hear it again');hear.onclick=()=>{speak(q.spoken,true);nudge();};top.append(eyebrow,hear);card.append(top);
 if(q.picture){const p=doc.createElement('div');p.className='wb-picture';p.textContent=q.picture;p.setAttribute('aria-hidden','true');card.append(p);}
 let built,slots=[];
 if(q.kind==='sentence'){built=doc.createElement('div');built.className='wb-built';slots=q.answer.map(()=>{const s=doc.createElement('span');s.className='wb-slot';built.append(s);return s;});const m=doc.createElement('span');m.className='wb-mark';m.textContent=q.mark;built.append(m);card.append(built);}
 const choices=doc.createElement('div');choices.className='wb-choices'+(q.kind==='sentence'||q.kind==='read-word'?' wb-words':'');card.append(choices);
 let misses=0,missesHere=0,step=0,finished=false,idle=null,repeats=0;
 // Gentle idle repeat: say the question again after ~6 s without a tap, at most twice.
 const nudge=()=>{clearTimeout(idle);if(finished||repeats>=IDLE_REPEATS)return;idle=setTimeout(()=>{if(finished||!d.isConnected)return;repeats++;speak(q.spoken,true);nudge();},IDLE_REPEAT_MS);};
 return new Promise(resolve=>{
  const finish=()=>{finished=true;clearTimeout(idle);ding(true);remember(player,q);
   const done=doc.createElement('p');done.className='wb-done';done.textContent=q.kind==='sentence'?'Great reading!':'Yes!';card.append(done);speak(q.kind==='sentence'?'Great reading!':'Yes!',false);
   const result={kind:q.kind,track:q.track,answer:q.sentence||q.answer,misses,ms:Date.now()-started,reason};log(result);
   setTimeout(()=>{try{d.close();}catch{}d.remove();resolve(result);},q.kind==='sentence'?1500:1000);};
  const wrong=b=>{misses++;missesHere++;ding(false);b.classList.remove('wiggle');void b.offsetWidth;b.classList.add('wiggle');
   if(missesHere>=2){const want=q.kind==='sentence'?q.answer[step]:q.answer;const right=[...choices.children].find(x=>x.dataset.value===want&&!x.classList.contains('used'));right?.classList.add('glow');speak(q.spoken,true);}
   else speak('Try again.',false);};
  const list=q.kind==='sentence'?q.tiles:q.options;
  for(const value of list){const b=doc.createElement('button');b.type='button';b.className='wb-choice';b.textContent=value;b.dataset.value=value;b.setAttribute('aria-label',value);
   b.onclick=()=>{if(finished||b.classList.contains('used'))return;
    nudge();
    if(q.kind==='sentence'){if(value!==q.answer[step])return wrong(b);b.classList.remove('glow');b.classList.add('used');slots[step].textContent=value;slots[step].classList.add('filled');step++;missesHere=0;[...choices.children].forEach(x=>x.classList.remove('glow'));if(step===q.answer.length)finish();return;}
    if(value!==q.answer)return wrong(b);b.classList.remove('glow');b.classList.add('right');finish();};
   choices.append(b);}
  d.addEventListener('cancel',e=>e.preventDefault());
  // Focus the dialog itself: showModal() would otherwise focus (and ring) the first button, which looks pre-chosen.
  d.tabIndex=-1;d.autofocus=true;doc.body.append(d);try{d.showModal();}catch{d.setAttribute('open','');}try{d.focus({preventScroll:true});}catch{}
  ding(true);setTimeout(()=>{if(!finished)speak(q.spoken,true);nudge();},350);
 });
}
