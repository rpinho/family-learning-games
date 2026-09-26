import {useHint,wasHinted} from './hints.mjs';
import {foundationQuestion,foundationAttempt} from './foundation.mjs';
// Coordinates are explicit handwriting centerlines in a 100 x 100 writing box.
// Lowercase uses manuscript forms. These are practice models, not a clinical rubric.
const parse = s => s.split('|').map(stroke => stroke.trim().split(' ').map(p => p.split(',').map(Number)));
const raw = {
 A:'20,85 50,15 80,85|33,56 67,56', B:'25,15 25,85|25,15 55,15 70,23 70,38 55,49 25,49|25,49 59,49 75,59 75,73 60,85 25,85',
 C:'78,25 66,16 43,15 27,28 20,49 25,70 42,85 65,85 78,75',D:'25,15 25,85|25,15 51,15 71,28 80,50 71,73 51,85 25,85',
 E:'25,15 25,85|25,15 75,15|25,49 65,49|25,85 75,85',F:'25,15 25,85|25,15 75,15|25,49 65,49',G:'78,25 66,16 43,15 27,28 20,49 25,70 42,85 65,85 78,75 78,52 54,52',
 H:'25,15 25,85|75,15 75,85|25,50 75,50',I:'30,15 70,15|50,15 50,85|30,85 70,85',J:'70,15 70,67 63,82 47,85 30,77 25,65',
 K:'25,15 25,85|75,15 25,53 78,85',L:'25,15 25,85 78,85',M:'18,85 18,15 50,58 82,15 82,85',N:'25,85 25,15 75,85 75,15',
 O:'50,15 30,22 20,42 20,60 30,79 50,85 70,79 80,60 80,42 70,22 50,15',P:'25,85 25,15 56,15 73,25 73,43 57,53 25,53',
 Q:'50,15 30,22 20,42 20,60 30,79 50,85 70,79 80,60 80,42 70,22 50,15|57,66 84,90',R:'25,85 25,15 56,15 73,25 73,43 57,53 25,53|52,53 80,85',
 S:'77,25 63,15 41,15 25,27 25,40 40,50 62,55 76,65 76,75 62,85 39,85 23,75',T:'20,15 80,15|50,15 50,85',U:'25,15 25,65 30,78 43,85 57,85 70,78 75,65 75,15',
 V:'20,15 50,85 80,15',W:'15,15 30,85 50,40 70,85 85,15',X:'25,15 75,85|75,15 25,85',Y:'20,15 50,50 80,15|50,50 50,85',Z:'20,15 80,15 20,85 80,85',
 a:'70,43 55,36 37,40 27,54 27,71 38,83 54,85 70,74|70,38 70,85',b:'28,15 28,85|28,49 42,38 58,38 73,51 75,67 64,82 46,85 28,76',
 c:'73,45 57,37 40,40 27,55 27,70 40,83 57,85 73,78',d:'72,48 59,38 41,38 27,51 25,68 38,82 56,85 72,75|72,15 72,85',
 e:'26,59 74,59 70,45 56,37 40,40 27,52 26,68 38,81 56,85 72,78',f:'65,19 57,14 43,18 38,30 38,85|23,40 62,40',
 g:'70,47 57,38 41,38 28,50 26,65 39,77 54,78 70,68|70,38 70,83 63,94 47,98 31,91',h:'28,15 28,85|28,51 43,38 58,38 71,49 71,85',
 i:'50,39 50,85|50,20 50,22',j:'62,39 62,82 57,94 43,97 33,90|62,20 62,22',k:'28,15 28,85|72,38 28,65 73,85',l:'50,15 50,85',
 m:'18,39 18,85|18,50 30,38 41,39 50,50 50,85|50,50 62,38 74,39 82,51 82,85',n:'28,39 28,85|28,50 42,38 57,38 72,49 72,85',
 o:'50,37 34,42 26,55 26,69 36,81 50,85 66,81 74,68 74,54 65,41 50,37',p:'28,38 28,98|28,49 42,38 59,38 73,51 74,66 62,79 46,81 28,73',
 q:'72,48 58,38 41,38 27,51 26,66 39,80 55,81 72,71|72,38 72,98',r:'32,39 32,85|32,52 46,40 58,38 70,44',
 s:'70,45 57,37 42,38 29,47 32,56 47,62 63,66 73,75 62,84 44,85 29,77',t:'45,18 45,73 50,83 61,85 70,80|25,40 68,40',
 u:'28,38 28,70 35,82 49,85 64,78 72,67|72,38 72,85',v:'25,38 50,85 75,38',w:'15,38 30,85 50,53 70,85 85,38',x:'27,38 73,85|73,38 27,85',
 y:'25,38 50,77|77,38 43,98',z:'27,38 74,38 27,85 74,85',
 0:'50,15 30,22 23,42 23,62 32,79 50,85 68,79 77,62 77,42 68,22 50,15',1:'35,30 50,15 50,85|32,85 70,85',
 2:'25,30 33,19 50,15 68,21 75,34 70,46 25,85 78,85',3:'25,23 42,15 61,17 75,29 70,42 52,49|52,49 70,55 77,69 68,82 48,85 26,77',
 4:'65,15 23,63 80,63|65,15 65,85',5:'75,15 30,15 27,48 47,43 66,48 77,63 72,77 56,85 39,84 24,77',
 6:'72,20 56,15 39,24 27,43 25,66 34,80 49,85 65,81 75,68 70,55 55,49 39,52 26,64',7:'23,15 78,15 40,85',
 8:'50,48 30,36 30,24 44,15 59,15 73,25 70,37 50,48 29,62 27,74 41,85 60,85 76,74 72,61 50,48',9:'73,43 65,23 51,15 36,19 26,32 28,48 41,57 58,55 73,43|73,30 72,63 61,80 43,85 30,80'
};
export const GLYPHS = Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,parse(v)]));
export const KINGDOMS = [
 {name:'The First Word',gem:'Jade',color:'#46bd90',icon:'📖',intro:'Every reading adventure starts with one word.'},
 {name:'Alphabet Garden',gem:'Sapphire',color:'#58b8f3',icon:'🌷',intro:'New letters. New discoveries.'},
 {name:'Letter Bridge',gem:'Amethyst',color:'#ac85ed',icon:'🌉',intro:'Build your alphabet, one bridge at a time.'},
 {name:'Word Workshop',gem:'Ruby',color:'#ee7790',icon:'🧩',intro:'Big letters meet their little partners.'},
 {name:'Story Library',gem:'Topaz',color:'#edb951',icon:'📚',intro:'A growing collection of letters and numbers.'},
 {name:'Memory Castle',gem:'Emerald',color:'#3fcdb5',icon:'🏰',intro:'Remember a letter. Build a word.'},
 {name:'Reading Rainbow',gem:'Diamond',color:'#a4d7e6',icon:'★',intro:'Small steps have brought you a long way.'}
];
export function freshProfile(id='explorer') {return {id,name:id==='beginner'?'Beginner':id==='demo'?'Explorer':id==='admin'?'Admin':'Explorer',seq:0,xp:0,gems:0,completed:0,inLesson:0,league:0,leagueBase:0,crowns:0,chests:0,skills:{},history:[],settings:{leftHanded:id!=='beginner',sound:true},revision:0};}
export function resetProgress(p){return {...freshProfile(p.id),settings:{...p.settings},revision:p.revision+1,ignoreAttemptsThroughRevision:p.ignoreAttemptsThroughRevision||0};}
export const FAMILY_NAMES=['Explorer','Beginner','Admin','Helper'];
export const WORDS=[
 ['cat','🐱',1],['dog','🐶',1],['sun','☀️',1],['hat','🎩',1],['bus','🚌',1],['pig','🐷',1],['cup','☕',1],['bed','🛏️',1],['hen','🐔',1],['fox','🦊',1],['ant','🐜',1],['bat','🦇',1],
 ['moon','🌙',2],['fish','🐟',2],['frog','🐸',2],['milk','🥛',2],['duck','🦆',2],['star','⭐',2],['book','📖',2],['tree','🌳',2],['ship','🚢',2],['crab','🦀',2],['drum','🥁',2],['flag','🚩',2],
 ['shark','🦈',3],['train','🚂',3],['snail','🐌',3],['whale','🐋',3],['grape','🍇',3],['snake','🐍',3],['robot','🤖',3],['tiger','🐯',3],['zebra','🦓',3],['lemon','🍋',3],['crown','👑',3],['chest','🧰',3]
].map(([word,picture,tier])=>({word,picture,tier}));
export const DUEL_LEVELS=[
 {id:1,name:'Friendly',icon:'📖',description:'Copy short words · two-choice clues'},
 {id:2,name:'Clever',icon:'🔤',description:'Four-letter words · smaller letter bank'},
 {id:3,name:'Boss',icon:'👑',description:'Five-letter words · tricky trails'}
];
export function recommendedDuelLevel(p){
 const recent=(p.duelHistory||[]).filter(m=>m.scoring==='single-point').slice(-2),base=1;
 if(!recent.length)return base;
 const last=recent.at(-1),level=last.difficulty||base;
 // Independence, not speed or beating a randomly accurate opponent, sets the next suggestion.
 if(recent.length===2&&recent.every(m=>m.difficulty===level&&m.independent>=4))return Math.min(3,level+1);
 if(last.independent<=1)return Math.max(1,level-1);
 return level;
}
export function questBoard(p){
 const q=p.questBook||{moves:0,words:0,matches:0,claimed:[]};
 const claimed=q.claimed||[];let chapter=0;
 while(['moves','words','matches'].every(key=>claimed.includes(`${chapter}:${key}`)))chapter++;
 return {chapter:chapter+1,quests:[
  {key:'moves',icon:'⚡',title:'Solve five challenges',description:'Correct answers in Learn or Word games.',target:5},
  {key:'words',icon:'🔤',title:'Solve three word puzzles',description:'Spell a word or find its missing letter.',target:3},
  {key:'matches',icon:'🔤',title:'Finish a word game with Rook',description:'Win, lose, or tie — play all five rounds.',target:1}
 ].map(qt=>({...qt,id:`${chapter}:${qt.key}`,progress:Math.min(qt.target,Math.max(0,(q[qt.key]||0)-chapter*qt.target)),claimed:claimed.includes(`${chapter}:${qt.key}`),gems:10}))};
}
export function claimQuest(p,id){
 const q=questBoard(p).quests.find(q=>q.id===id);
 if(!q||q.claimed||q.progress<q.target)return false;
 p.questBook.claimed.push(id);p.gems+=q.gems;p.revision++;return {gems:q.gems,title:q.title};
}
export function startAdventure(p){
 if(p.duel&&!p.duel.finished&&!p.duel.paused){p.duel.paused=true;p.revision++;}
}
export function challengeKey(c){return c.type==='name'?'name':`${c.type}:${['spell','gap'].includes(c.type)?c.word:c.char}`;}
export function expectedAnswer(c){return ['name','spell'].includes(c.type)?c.word:c.char;}
export function startDuel(p,difficulty=recommendedDuelLevel(p)){
 if(p.duel&&!p.duel.finished){if(p.duel.paused){p.duel.paused=false;p.revision++;}return p.duel;}
 if(!DUEL_LEVELS.some(d=>d.id===difficulty))throw Error('Choose a valid match level');
 p.duelMatches=(p.duelMatches||0)+1;p.revision++;
 p.duel={round:0,you:0,rook:0,finished:false,difficulty,scoring:'single-point',rounds:[],startedAt:new Date().toISOString(),seed:p.revision*7919+p.duelMatches*101};
 return p.duel;
}
export function rng(seed) {return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function shuffle(arr,r=Math.random){return [...arr].sort(()=>0).map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
const alphabet='FRANCISOETLHDMBPUKGWYVZXJQ';
export function unlocked(p){const n=Math.min(26,3+Math.floor(p.completed/2));let chars=[...alphabet.slice(0,n)];if(p.completed>=12) chars.push(...alphabet.slice(0,Math.min(26,Math.floor((p.completed-10)/2))).toLowerCase());if(p.completed>=24)chars.push(...'0123456789'.slice(0,Math.min(10,Math.floor((p.completed-22)/2))));return [...new Set([...chars,...(p.placement?.letters||[])])];}
export function skill(p,key){return p.skills[key]||{level:0,streak:0,seen:0,hits:0,last:-100};}
export function nextChallenge(p){
 const challenge=buildChallenge(p);
 // Invalidate pre-redesign tabs even when the saved revision hasn't changed.
 const guided=challenge.type==='trace'&&p.id==='beginner';
 return {...challenge,...(guided?{guided:true,level:0,probe:false}:{}),id:challenge.id+(guided?':rail1:story1':':story1')};
}
function matchRules(d){
 if(d.scoring!=='single-point'){
  d.carriedScore={rounds:d.round,you:d.you,rook:d.rook};
  d.scoring='single-point';
 }
}
export function useMatchHint(p){
 const d=p.duel;
 if(!d||d.finished||d.paused)throw Error('No active match');
 matchRules(d);
 if(d.hintedRound===d.round)return {point:'already-awarded'};
 useHint(p,`duel:${d.seed}:${d.round}`);
 d.hintedRound=d.round;d.rook++;p.revision++;
 return {point:'rook',reason:'hint'};
}
function buildChallenge(p){
 if(p.duel&&!p.duel.finished&&!p.duel.paused){
  const r=rng(p.duel.seed+p.duel.round*101+p.seq),type=['spell','gap','sequence','find','spell'][p.duel.round];
  const difficulty=p.duel.difficulty||2;
  const id=`duel2:${p.revision}:${p.seq}`,base={id,type,level:difficulty===1?1:2,probe:true,duel:true,difficulty};
  if(type==='spell'||type==='gap'){
   const used=(p.duel.rounds||[]).map(round=>round.word),pool=WORDS.filter(w=>w.tier===difficulty&&!used.includes(w.word));
   const {word,picture}=pool[Math.floor(r()*pool.length)],blank=Math.floor(r()*word.length),char=word[blank];
   const keyboard=difficulty<3?shuffle([...new Set([...word,...shuffle([...alphabet.toLowerCase()].filter(c=>!word.includes(c)),r).slice(0,difficulty===1?2:6)])],r):[...'abcdefghijklmnopqrstuvwxyz'];
   return {...base,word,picture,blank,char,memory:difficulty>1,reusable:type==='spell',options:type==='spell'?keyboard:shuffle([char,...shuffle([...alphabet.toLowerCase()].filter(c=>c!==char),r).slice(0,difficulty===3?5:difficulty===1?1:3)],r)};
  }
  if(type==='sequence'){
   const count=difficulty===3?5:3,start=Math.floor(r()*(27-count)),letters=Array.from({length:count},(_,i)=>String.fromCharCode(65+start+i)),blank=Math.floor(r()*count),char=letters[blank];
   return {...base,letters,blank,char,options:shuffle([char,...shuffle([...alphabet].filter(c=>c!==char),r).slice(0,difficulty===3?5:difficulty===1?1:3)],r)};
  }
  const pool=difficulty===1?alphabet:alphabet.toLowerCase(),char=pool[Math.floor(r()*pool.length)];
  return {...base,char,options:shuffle([char,...shuffle([...pool].filter(c=>c!==char),r).slice(0,difficulty===3?5:difficulty===1?1:3)],r)};
 }
 if(p.retryTrace&&GLYPHS[p.retryTrace]){
  const char=p.retryTrace;
  return {id:`${p.revision}:${p.seq}`,type:'trace',char,level:skill(p,`trace:${char}`).level,paths:GLYPHS[char],retry:true};
 }
 if(p.id==='explorer'&&!p.foundation?.reviewComplete){const q=foundationQuestion(p);return {...q,id:`foundation1:${p.revision}:${p.seq}`,type:'gap',word:q.word.toUpperCase(),blank:q.position,char:q.answer,focus:'uppercase-cvc',level:Math.min(2,q.stage-1)};}
 const advanced=['explorer','beginner'].includes(p.id)&&p.seq>=13;
 const hard=p.id==='explorer'&&advanced;
 const r=rng(p.seq*7919+p.completed*101+37);
 const type=p.seq>0 && p.seq%13===0?'name':advanced?['find','spell','trace','gap','sequence','trace'][p.seq%6]:p.seq%3===0?'find':'trace';
 if(type==='spell'||type==='gap'){
  const recent=p.history.filter(h=>h.key.startsWith(type+':')).slice(-4),independent=recent.filter(h=>h.ok&&!h.helped).length;
  const tier=p.id==='beginner'?1:recent.length>=3?(independent>=3?3:independent<=1?1:2):hard?2:1;
  const pool=shuffle(WORDS.filter(w=>w.tier===tier),r).sort((a,b)=>skill(p,`${type}:${a.word}`).seen-skill(p,`${type}:${b.word}`).seen);
  const {word,picture}=pool[0],blank=Math.floor(r()*word.length),char=word[blank];
  const gentle=p.id==='beginner',bank=shuffle([...new Set([...word,...shuffle([...alphabet.toLowerCase()].filter(c=>!word.includes(c)),r).slice(0,2)])],r);
  return {id:`variety6:${p.revision}:${p.seq}`,type,word,picture,blank,char,level:gentle?0:2,memory:!gentle,probe:!gentle,reusable:type==='spell',options:type==='spell'?gentle?bank:[...'abcdefghijklmnopqrstuvwxyz']:shuffle([char,...shuffle([...alphabet.toLowerCase()].filter(c=>c!==char),r).slice(0,gentle?1:3)],r)};
 }
 if(type==='sequence'){
  const start=Math.floor(r()*24),letters=[0,1,2].map(i=>String.fromCharCode(65+start+i)),blank=Math.floor(r()*3),char=letters[blank];
  return {id:`variety6:${p.revision}:${p.seq}`,type,letters,blank,char,level:2,probe:true,options:shuffle([char,...shuffle([...alphabet].filter(c=>c!==char),r).slice(0,3)],r)};
 }
 // Recognition explores independently of writing; copying failures cannot end it.
 const readyForLowercase=[...alphabet].filter(c=>skill(p,`find:${c}`).level>=2).length>=8;
 const chars=advanced&&type==='find'?[...alphabet,...(readyForLowercase?[...alphabet.toLowerCase()]:[])]:unlocked(p);
 if(type==='name'){
  const first=Math.max(0,FAMILY_NAMES.indexOf(p.name));
  const word=FAMILY_NAMES[(first+(p.familyNameRound||0))%FAMILY_NAMES.length];
  const extras=hard?shuffle([...alphabet.toLowerCase()].filter(c=>!word.toLowerCase().includes(c)),r).slice(0,2):[];
  return {id:`family2:${p.revision}:${p.seq}`,type,word,level:hard?2:0,memory:hard,probe:hard,options:shuffle([...word,...extras],r)};
 }
 const ranked=shuffle(chars,r).map(c=>({c,s:skill(p,`${type}:${c}`)})).sort((a,b)=>(a.s.level*4+a.s.seen*.5-Math.min(20,p.seq-a.s.last)*.2)-(b.s.level*4+b.s.seen*.5-Math.min(20,p.seq-b.s.last)*.2));
 const char=ranked[0].c,s=ranked[0].s;
 const level=hard&&type==='trace'?Math.max(2,s.level):advanced&&type==='find'&&s.seen===0?(p.id==='beginner'?1:2):s.level;
 const all=Object.keys(GLYPHS).filter(c=>c!==char && (/^[a-z]$/.test(char)?/^[a-z]$/:/^[0-9]$/.test(char)?/^[0-9]$/:/^[A-Z]$/).test(c));
 const found={id:`${advanced?'variety6:':''}${p.revision}:${p.seq}`,type,char,level,probe:advanced&&(type==='find'||hard&&type==='trace'),options:shuffle([char,...shuffle(all,r).slice(0,level>=2?3:1)],r),paths:GLYPHS[char]};
 // Beginner: about half of the letter finds become "tap every one" grids with
 // look-alike letters (b/d/p, M/N/W). Pattern borrowed from Duolingo ABC's
 // "tap the letter every time you see it" item.
 if(type==='find'&&p.id==='beginner'&&(p.seq*7+p.completed)%2===0)return {...found,id:`${found.id}:spot1`,spot:true,grid:spotGrid(char,r)};
 return found;
}
const CONFUSABLE={b:'dpqh',d:'bpqa',p:'qbd',q:'pgd',m:'nwh',n:'mhu',u:'nvy',w:'mvu',v:'wyu',i:'ljt',l:'itj',t:'lif',e:'cao',c:'eo',a:'odg',o:'acd',g:'qjy',h:'nbk',j:'ig',k:'hx',f:'tl',r:'nv',s:'zc',x:'kz',y:'vgj',z:'sx',
 E:'FLB',F:'EPT',L:'ITJ',M:'NWH',N:'MZH',O:'QCD',P:'RBF',R:'PBK',B:'PRD',C:'OGQ',G:'COQ',W:'MVN',V:'WYU',U:'VJO',I:'LTJ',T:'ILF',K:'XRH',X:'KYZ',Y:'VXT',Z:'NSX',S:'ZG',D:'OBP',H:'NAK',A:'HVR',J:'LUI',Q:'OGC'};
export const SPOT_TARGETS=3;
// Nine tiles: three copies of the letter plus six look-alikes (never the letter).
export function spotGrid(char,r=Math.random){
 const lower=/^[a-z]$/.test(char),digit=/^[0-9]$/.test(char);
 const pool=digit?[...'0123456789']:[...(lower?alphabet.toLowerCase():alphabet)];
 const near=[...(CONFUSABLE[char]||'')].filter(c=>c!==char);
 const extra=shuffle(pool.filter(c=>c!==char&&!near.includes(c)),r);
 const kinds=[...near,...extra].slice(0,3);
 const distractors=Array.from({length:9-SPOT_TARGETS},(_,i)=>kinds[i%kinds.length]);
 return shuffle([...Array(SPOT_TARGETS).fill(char),...distractors],r);
}
export function taskPrompt(c,showModel=false){
 if(c.foundation)return `Complete the word ${c.word.toLowerCase()}. Choose the missing letter.`;
 if(c.type==='spell')return `Spell ${c.word}. Tap the letters in order.`;
 if(c.type==='gap')return `Complete the word ${c.word}. Choose the missing letter.`;
 if(c.type==='sequence')return 'Complete the alphabet trail. Choose the missing letter.';
 if(c.type==='name')return `Build ${c.word}. Start at the left. Tap the letters in order.`;
 if(c.type==='find')return `Find ${/^[a-z]$/.test(c.char)?'little ':''}${c.char.toUpperCase()}.`;
 return `${c.level>=3&&!showModel?'Write':c.level>=2&&!showModel?'Copy':'Trace'} ${/^[a-z]$/.test(c.char)?'little ':''}${c.char.toUpperCase()}. ${c.level<2||showModel?'Start at the gold dot. Follow the arrow.':'Take your time.'}`;
}
export function visibleTaskPrompt(c,showModel=false){
 if(c.type==='spell'&&!showModel)return 'Listen to the word. Spell it using the alphabet below.';
 if(c.type==='gap'&&!showModel)return 'One letter is missing. Listen to the word and complete it.';
 if(c.type==='find'&&c.spot)return c.level===0||showModel?`Tap every ${/^[a-z]$/.test(c.char)?'little ':''}${c.char} you can see. There are ${SPOT_TARGETS}.`:`Listen. Tap every letter that matches. There are ${SPOT_TARGETS}.`;
 if(c.type==='find'&&c.level>0&&!showModel)return 'Listen, then choose the letter. Tap the speaker to hear it again.';
 if(c.type==='name'&&c.memory&&!showModel)return 'Listen, then build the family name. Two extra letters are hiding here!';
 return taskPrompt(c,showModel);
}
export function samplePath(path,spacing=2){const out=[path[0]];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));for(let j=1;j<=n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}return out;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const nearest=(p,points)=>Math.min(...points.map(q=>dist(p,q)));
const pathLength=points=>points.slice(1).reduce((sum,p,i)=>sum+dist(points[i],p),0);
export function assessTrace(paths,strokes,level=0){
 const result=assessTraceModel(paths,strokes,level);
 if(result.ok)return result;
 // B's two bowls share the middle horizontal. It only needs to be drawn once:
 // either finish the top bowl at the join, or start the bottom bowl there.
 // Each alternate retains the full visible B, stroke order and direction checks.
 if(JSON.stringify(paths)===JSON.stringify(GLYPHS.B)){
  const [stem,upper,lower]=GLYPHS.B;
  for(const model of [[stem,upper.slice(0,-1),lower],[stem,upper,lower.slice(1)]]){
   const alternate=assessTraceModel(model,strokes,level);
   if(alternate.ok)return {...alternate,model:'B-shared-middle'};
  }
 }
 // Both manuscript a variants are valid: a c-shaped curve + downstroke,
 // or a closed oval + downstroke. Do not require tracing the stem twice.
 const closedA=[[...GLYPHS.a[0],[70,43]],GLYPHS.a[1]];
 const shape=JSON.stringify(paths);
 if(shape===JSON.stringify(GLYPHS.a)||shape===JSON.stringify(closedA)){
  for(const model of [GLYPHS.a,closedA]){const alternate=assessTraceModel(model,strokes,level);if(alternate.ok)return alternate;}
 }
 return result;
}
function assessTraceModel(paths,strokes,level=0){
 if(!Array.isArray(strokes)||strokes.length!==paths.length)return {ok:false,reason:'strokes',score:0};
 let score=1;
 for(let i=0;i<paths.length;i++){
  const input=strokes[i];if(!Array.isArray(input)||input.length<2)return {ok:false,reason:'short',score:0};
  const target=samplePath(paths[i]), drawn=samplePath(input,2),tol=level<2?11:9;
  const precision=drawn.filter(p=>nearest(p,target)<=tol).length/drawn.length;
  const coverage=target.filter(p=>nearest(p,drawn)<=tol).length/target.length;
  const start=dist(input[0],target[0]),end=dist(input.at(-1),target.at(-1));
  // Ordered progression catches backwards loops as well as reversed straight lines.
  let cursor=0,ordered=true;for(const q of target){let found=false;const progressionTolerance=dist(q,target.at(-1))<=tol?tol*1.5:tol;for(let j=cursor;j<drawn.length;j++){if(dist(q,drawn[j])<=progressionTolerance){cursor=j;found=true;break;}}if(!found){ordered=false;break;}}
  // Touch-event density varies by device and drawing speed; count distance, not samples.
  const length=pathLength(input)/Math.max(.001,pathLength(paths[i]));
  score=Math.min(score,precision,coverage);
  if(precision<.8||coverage<.85||start>tol*1.5||end>tol*1.5||!ordered||length>2.1)return {ok:false,reason:start>tol*1.5||!ordered?'direction':'shape',score};
 }
 return {ok:true,score,reason:'good'};
}
export function applyAttempt(p,challenge,payload){
 // Assistance is determined on the server; clients cannot claim independent
 // mastery for the perfect, model-generated strokes in Beginner's guided mode.
 const guided=challenge.type==='trace'&&p.id==='beginner';
 if(guided)payload={...payload,helped:true};
 if(wasHinted(p,`lesson:${challenge.id}`))payload={...payload,helped:true};
 if(challenge.duel&&p.duel?.hintedRound===p.duel?.round)payload={...payload,helped:true};
 let result=challenge.type==='trace'?assessTrace(challenge.paths,payload.strokes,challenge.level):{ok:payload.answer===expectedAnswer(challenge),score:payload.answer===expectedAnswer(challenge)?1:0};
 if(challenge.foundation)foundationAttempt(p,challenge,{ok:result.ok,helped:payload.helped});
 const key=challengeKey(challenge),s={...skill(p,key)};
 if(challenge.probe&&result.ok&&!payload.helped)s.level=Math.max(s.level,challenge.level);
 if(challenge.type==='name')p.familyNameRound=(p.familyNameRound||0)+1;
 if(challenge.placement){
  const placement=p.placement||{index:0,misses:0,letters:[]};
  placement.index++;if(!result.ok)placement.misses++;
  if(!placement.letters.includes(challenge.char))placement.letters.push(challenge.char);
  p.placement=placement;
  if(result.ok&&!payload.helped)s.level=Math.max(s.level,challenge.level);
 }
 s.seen++;s.last=p.seq;if(result.ok)s.hits++;
 // Accuracy and independence govern progression. Speed is evidence, never a handwriting deadline.
 const independent=result.ok&&!payload.helped;
 s.streak=independent?s.streak+1:0;
 if(independent&&(s.streak>=2||(challenge.type==='find'&&payload.durationMs<5500&&s.streak>=1))) {s.level=Math.min(3,s.level+1);s.streak=0;}
 if(!result.ok)s.level=Math.max(0,s.level-1);
 p.skills[key]=s;p.seq++;p.revision++;
 // A failed trace gets a fresh attempt ID for the same letter and its restored guide.
 if(challenge.type==='trace'&&!result.ok)p.retryTrace=challenge.char;
 else if(!challenge.duel)delete p.retryTrace;
 const xp=result.ok?(payload.helped?8:12):2;p.xp+=xp;
 let lesson=false,chest=false;
 if(result.ok){p.inLesson++;if(p.inLesson>=5){p.inLesson=0;p.completed++;p.xp+=20;lesson=true;if(p.completed%3===0){p.chests++;chest=true;}}}
 p.history.push({at:new Date().toISOString(),key,...(challenge.word?{word:challenge.word}:{}),...(challenge.spot?{spot:true}:{}),...(guided?{practice:'guided-tracing'}:{}),ok:result.ok,helped:!!payload.helped,score:Math.round(result.score*100),durationMs:Math.round(payload.durationMs),level:s.level});
 p.history=p.history.slice(-2000);
 p.questBook??={moves:0,words:0,matches:0,claimed:[]};
 if(result.ok){p.questBook.moves++;if(['spell','gap'].includes(challenge.type))p.questBook.words++;}
 let duel,bonus=0;
 if(challenge.duel&&p.duel&&!p.duel.finished){
  const d=p.duel;matchRules(d);
  const rookOk=!independent,alreadyAwarded=d.hintedRound===d.round;
  d.you+=Number(independent);if(rookOk&&!alreadyAwarded)d.rook++;d.round++;
  const answer=expectedAnswer(challenge),rookAnswer=answer,pointReason=independent?'independent':payload.helped?'hint':'incorrect';
  d.rounds??=[];d.rounds.push({type:challenge.type,...(challenge.word?{word:challenge.word}:{}),expected:answer,answer:payload.answer,ok:result.ok,helped:!!payload.helped,rookOk,rookAnswer,pointReason});
  if(d.round>=5){
   d.finished=true;d.outcome=d.you>d.rook?'win':d.you<d.rook?'loss':'draw';bonus=d.outcome==='win'?20:d.outcome==='draw'?5:0;p.xp+=bonus;if(d.outcome==='win')p.gems+=5;
   p.questBook.matches++;
   const entry={id:d.seed,at:new Date().toISOString(),difficulty:d.difficulty||2,you:d.you,rook:d.rook,outcome:d.outcome,independent:d.rounds.filter(r=>r.ok&&!r.helped).length,rounds:d.rounds,scoring:d.scoring,...(d.carriedScore?{carriedScore:d.carriedScore}:{})};
   p.duelHistory=[...(p.duelHistory||[]),entry].slice(-30);
   p.duelStats??={played:0,wins:0,draws:0};p.duelStats.played++;p.duelStats.wins+=Number(d.outcome==='win');p.duelStats.draws+=Number(d.outcome==='draw');
  }
  duel={...d,rookOk,rookAnswer,pointReason,alreadyAwarded,bonus};
 }
 return {...result,xp:xp+(lesson?20:0)+bonus,lesson,chest,level:s.level,...(duel?{duel}:{})};
}
export function leagueRows(p){return [{name:p.name,xp:p.xp-p.leagueBase,you:true,icon:'📖'},...['Fern the fox','Pip the penguin','Luna the owl','Bram the bear'].map((name,i)=>({name,xp:[250,170,95,35][i]+p.league*35,icon:['🦊','🐧','🦉','🐻'][i]}))].sort((a,b)=>b.xp-a.xp);}
export function questRating(p){
 // Transparent game progression score, not a calibrated educational assessment or chess Elo.
 const score=400+Object.entries(p.skills).reduce((n,[key,s])=>n+Math.max(0,Math.min(3,s.level||0))*(key.startsWith('find:')?10:20),0);
 return {score,level:1+Math.floor((score-400)/100)};
}
