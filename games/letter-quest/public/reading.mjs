import {useHint} from './hints.mjs';
// Reading practice is separate from letter mastery and from game XP.
export const READING_TYPES=[
 ['decode','🔎','Word detective','Read a word. Find what it means.'],
 ['dictation','🎧','Word workshop','Hear a word. Spell it from memory.'],
 ['change','🪄','Word transformer','Change one letter to make a new word.'],
 ['act','🎬','Read and act','Follow a written instruction.'],
 ['sentence','🧩','Sentence studio','Build a sentence with word tiles.'],
 ['story','📖','Story detective','Read a tiny story. Solve its mystery.'],
 ['write','✍️','Write and remember','Write a whole word, not a letter trace.']
];
export const READING_WORDS=[
 [['cat','🐱'],['dog','🐶'],['pig','🐷'],['hen','🐔'],['sun','☀️'],['cup','☕'],['hat','🎩'],['bed','🛏️'],['map','🗺️'],['pen','🖊️'],['fox','🦊'],['bug','🐞']],
 [['ship','🚢'],['fish','🐟'],['shop','🏪'],['duck','🦆'],['sock','🧦'],['ring','💍'],['wing','🪽'],['king','🤴'],['frog','🐸'],['flag','🚩'],['drum','🥁'],['crab','🦀']],
 [['train','🚂'],['snail','🐌'],['green','🟢'],['sheep','🐑'],['beach','🏖️'],['chair','🪑'],['brush','🖌️'],['snack','🍿'],['storm','⛈️'],['stamp','📮'],['shark','🦈'],['whale','🐋']]
];
export const WORD_CHANGES=[
 [['cat','hat'],['mat','sat'],['sit','sat'],['pin','pan'],['hen','pen'],['pig','big'],['dog','log'],['cup','cut'],['map','cap'],['bug','rug'],['bed','red'],['fan','pan']],
 [['ship','shop'],['fish','dish'],['sock','rock'],['ring','wing'],['king','sing'],['back','pack'],['duck','luck'],['thin','chin'],['chop','chip'],['wish','wash'],['rush','rash'],['rich','rice']],
 [['train','brain'],['snail','snarl'],['green','greet'],['sheep','sheet'],['beach','bench'],['brush','crush'],['snack','stack'],['stamp','stomp'],['shark','share'],['whale','while'],['black','block'],['track','trick']]
];
export const READING_SENTENCES=[
 ['The cat can nap.','The pig can dig.','The dog can run.','The hen is red.','The sun is hot.','The hat is in the bag.','The fox can hop.','The bug is on the bed.'],
 ['The fish is in the pond.','The frog can jump.','The duck has a snack.','The red flag is on the ship.','The crab is on the rock.','The king has a gold ring.','The drum is in the shop.','The sock is under the bed.'],
 ['The green frog jumps into the pond.','The small snail rests on a leaf.','The shark swims past the ship.','The sheep stands beside the fence.','The train stops at the next town.','The child puts a snack in the bag.','The brush is beside the green cup.','The whale swims under the blue waves.']
];
export const READING_STORIES=[
 [
  ['Sam has a red cap. The cap is in a bag.','Where is the cap?','bag',['bed','box']],
  ['A cat sat on a mat. A dog ran past.','Who sat on the mat?','cat',['dog','pig']],
  ['The sun is hot. Ben gets a cup.','What does Ben get?','cup',['hat','pen']],
  ['The pig can dig. The hen can peck.','Who can dig?','pig',['hen','dog']],
  ['A bug is on a log. A fox is in a den.','Where is the bug?','log',['den','bed']],
  ['Dad has a pen. Mom has a map.','Who has the map?','Mom',['Dad','Sam']],
  ['The dog is wet. The cat is dry.','Who is wet?','dog',['cat','hen']],
  ['A red hat is on the bed. A cup is on the mat.','What is on the bed?','hat',['cup','map']]
 ],
 [
  ['The frog jumps in the pond. A duck swims past the frog.','Who jumps?','frog',['duck','fish']],
  ['Sam packs a snack. He puts it in his bag.','What is in the bag?','snack',['sock','flag']],
  ['The king has a ring. He puts it in a box.','Where is the ring now?','box',['shop','pond']],
  ['A crab hides under a rock. A fish swims above it.','Where is the crab?','under the rock',['above the rock','in the shop']],
  ['The red sock is wet. The blue sock is dry.','Which sock can Ben put on to stay dry?','blue sock',['red sock','both socks']],
  ['A ship has a flag. The wind makes the flag flap.','What makes the flag flap?','wind',['fish','ship']],
  ['The shop has a drum. Dad gets the drum for Sam.','Who will get the drum?','Sam',['Mom','the king']],
  ['The duck drops a snack. The frog finds it by the pond.','Who finds the snack?','frog',['duck','crab']]
 ],
 [
  ['The train stops. Sam gets off with his bag. He walks to the beach.','Where does Sam go after the train ride?','beach',['train','shop']],
  ['A sheep is cold. It goes into the barn. The barn keeps out the wind.','Why does the sheep go inside?','to get warm',['to swim','to find a train']],
  ['The sky gets dark. Rain starts to fall. Mom brings the game inside.','Why does Mom bring the game inside?','it is raining',['it is too hot','the game is over']],
  ['Ben puts a snack in his bag. At the park, he feels hungry. He opens the bag.','What will Ben probably do next?','eat his snack',['go to sleep','brush his hair']],
  ['A snail moves slowly. A rabbit runs fast. The rabbit reaches the tree first.','Who reaches the tree last?','snail',['rabbit','both together']],
  ['The brush was beside the cup. Sam moves it into a box. Then he shuts the box.','Where is the brush now?','in the box',['beside the cup','under the chair']],
  ['The shark swims past a ship. A small fish hides behind a rock until the shark is gone.','Why does the fish hide?','to stay safe',['to catch the shark','to sail the ship']],
  ['Helper gives Admin a map. Admin follows the map to the park. Explorer meets him there.','Where does Explorer meet Admin?','park',['shop','beach']]
 ]
];
export const READING_LINES={intro:'New mission! Words do things. Let us find out what they can do.',correct:'You solved it! That word just opened a new door.',wrong:'Let us look again. You can hear a clue or try another answer.',hint:'Here is some help. Learning together counts, too.',saved:'Your writing is saved. Show it to a grown-up. I do not grade your handwriting here.',done:'Mission complete! My mustache would like to borrow your brain.',skip:'A different challenge is a good idea. On we go.'};
const prompts={decode:'Read the word. Choose its picture.',act:'Read the instruction. Tap the things it asks for, in order.',story:'Read the story, then answer the question.',sentence:'Listen to the sentence. Put its words in order.'};
const objects=[{id:'red-hat',color:'#dc5f5b',thing:'hat',label:'red hat'},{id:'blue-hat',color:'#418bd2',thing:'hat',label:'blue hat'},{id:'red-cup',color:'#dc5f5b',thing:'cup',label:'red cup'},{id:'blue-cup',color:'#418bd2',thing:'cup',label:'blue cup'}];
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function readingState(p){return p.reading||{run:0,step:0,phase:'lobby',focus:'mix',skills:{},question:null,help:[],mistakes:0,results:[],history:[],draft:[],ink:[]};}
export function readingQuestion(p){
 const s=readingState(p);if(s.question)return s.question;
 const type=s.focus==='mix'?READING_TYPES[s.step%7][0]:s.focus,level=s.skills[type]?.level||1;
 const index=s.focus==='mix'?s.run-1:(s.run-1)*7+s.step,r=random(s.run*7919+s.step*997+(p.id==='beginner'?31:0));
 const pool=READING_WORDS[level-1],pair=pool[(index+(p.id==='beginner'?3:0)+(type==='dictation'?4:type==='write'?7:0))%pool.length],base={id:`reading1:${s.run}:${s.step}`,type,level};
 if(['decode','dictation','write'].includes(type)){
  const [word,picture]=pair,tiles=level===3?[...'abcdefghijklmnopqrstuvwxyz']:shuffle([...new Set([...word,...shuffle([...'abcdefghijklmnopqrstuvwxyz'],r).slice(0,4)])],r);
  return {...base,word,picture,answer:word,tiles,prompt:type==='decode'?prompts.decode:type==='write'?`Write the word ${word}. Say it as you write.`:`Build the word ${word}. Listen, then spell it.`,helpLine:`The word is ${word}.`,options:shuffle([pair,...shuffle(pool.filter(w=>w[0]!==word),r).slice(0,level===1?2:3)],r).map(([value,picture])=>({value,picture}))};
 }
 if(type==='change'){
  const [from,word]=WORD_CHANGES[level-1][index%WORD_CHANGES[level-1].length];
  return {...base,from,word,answer:word,prompt:`Change ${from} to ${word}. Replace one letter.`,helpLine:`The new word is ${word}.`,tiles:level===3?[...'abcdefghijklmnopqrstuvwxyz']:shuffle([...new Set([...from,...word,...shuffle([...'abcdefghijklmnopqrstuvwxyz'],r).slice(0,3)])],r)};
 }
 if(type==='act'){
  const first=index%4,second=(first+1+Math.floor(index/4)%3)%4,targets=level===2?[objects[first],objects[second]]:[objects[first]];
  const command=level===3?`Tap the ${objects[first].thing} that is not ${objects[first].color==='#dc5f5b'?'blue':'red'}.`:targets.map((t,i)=>`${i?'then tap':'Tap'} the ${t.label}`).join(', ')+'.';
  return {...base,command,answer:targets.map(t=>t.id).join('|'),count:targets.length,options:shuffle(objects,r),prompt:prompts.act,helpLine:command};
 }
 if(type==='sentence'){
  const sentence=READING_SENTENCES[level-1][index%8],tokens=sentence.split(' ');return {...base,sentence,answer:sentence,tiles:shuffle(tokens,r),prompt:prompts.sentence,listenLine:sentence,helpLine:sentence};
 }
 const [passage,question,answer,wrong]=READING_STORIES[level-1][index%8];return {...base,passage,question,answer,options:shuffle([answer,...wrong],r),prompt:prompts.story,helpLine:passage+' '+question};
}
export function validReadingInk(ink){return Array.isArray(ink)&&ink.length<=60&&ink.every(s=>Array.isArray(s)&&s.length>=2&&s.length<=300&&s.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=100)));}
function prepareQuestion(p){const s=p.reading;s.question=readingQuestion(p);s.cursor=0;if(s.question.type==='change')s.draft=[...s.question.from].map(c=>s.question.tiles.indexOf(c));}
function finish(p,result){const s=p.reading;s.phase='result';s.results.push({...result,question:structuredClone(s.question),help:[...s.help],mistakes:s.mistakes});
 if(s.results.length===7){const bonus=s.results.filter(r=>r.ok).length>=3?{xp:20,gems:5}:null;if(bonus){p.xp+=20;p.gems+=5;}s.history.push({run:s.run,focus:s.focus,results:structuredClone(s.results),bonus,at:new Date().toISOString()});s.history=s.history.slice(-20);result.bonus=bonus;}return result;}
export function readingAction(p,input){
 const old=readingState(p);
 if(input.kind==='start'){
  const replacing=!['lobby','complete'].includes(old.phase);
  if(replacing&&input.replace!==true)throw Error('Resume your current reading mission first');
  const focus=input.focus||'mix';if(focus!=='mix'&&!READING_TYPES.some(t=>t[0]===focus))throw Error('Choose a reading mission');
  if(input.level!==undefined&&![1,2,3].includes(input.level))throw Error('Choose a starting level');
  if(replacing&&old.results.length<7)old.history=[...old.history,{run:old.run,focus:old.focus,unfinished:true,results:structuredClone(old.results),question:old.question,draft:old.draft,ink:old.ink,help:old.help,at:new Date().toISOString()}].slice(-20);
  p.reading={...structuredClone(old),run:old.run+1,step:0,phase:'question',focus,question:null,help:[],mistakes:0,results:[],draft:[],ink:[]};
  if(input.level)for(const [type] of READING_TYPES)if(focus==='mix'||focus===type)p.reading.skills[type]={...(p.reading.skills[type]||{}),level:input.level,streak:0};
  prepareQuestion(p);p.revision++;return {kind:'start',line:READING_LINES.intro};
 }
 const s=p.reading;if(!s)throw Error('Start a reading mission first');
 if(input.kind==='next'){
  if(s.phase!=='result')throw Error('Finish this activity first');
  s.step++;s.phase=s.step===7?'complete':'question';s.question=null;s.help=[];s.mistakes=0;s.draft=[];s.ink=[];
  if(s.phase==='question')prepareQuestion(p);p.revision++;return {kind:s.phase==='complete'?'complete':'next',line:s.phase==='complete'?READING_LINES.done:undefined};
 }
 if(s.phase!=='question'||input.questionId!==s.question.id)throw Error('This reading activity changed. Reload to continue.');const q=s.question;
 if(input.kind==='help'){
  if(!['read','show'].includes(input.help))throw Error('Choose a hint');
  if(!s.help.includes(input.help)){if(!s.help.length)useHint(p,`reading:${q.id}`);s.help.push(input.help);p.revision++;}return {kind:'help',line:input.help==='read'?q.helpLine:READING_LINES.hint};
 }
 if(input.kind==='draft'){
  if(!Array.isArray(input.draft)||input.draft.length>20||!input.draft.every(n=>Number.isInteger(n)&&n>=0&&n<(q.tiles?.length||q.options?.length||0)))throw Error('Invalid reading tiles');
  if(q.type==='sentence'&&new Set(input.draft).size!==input.draft.length)throw Error('A word tile can only be used once');
  if(!['dictation','change','sentence','act'].includes(q.type))throw Error('No tiles in this activity');
  s.draft=input.draft;p.revision++;return {kind:'draft'};
 }
 if(input.kind==='position'){
  if(q.type!=='change'||!Number.isInteger(input.position)||input.position<0||input.position>=q.from.length)throw Error('Choose a letter in the word');s.cursor=input.position;p.revision++;return {kind:'position'};
 }
 if(input.kind==='ink'){
  if(q.type!=='write'||!validReadingInk(input.ink))throw Error('Invalid writing sample');s.ink=input.ink;p.revision++;return {kind:'ink'};
 }
 if(input.kind==='skip'){p.revision++;return finish(p,{kind:'skip',ok:false,independent:false,xp:0,line:READING_LINES.skip});}
 if(input.kind!=='answer')throw Error('Unknown reading action');
 if(!Number.isFinite(input.durationMs)||input.durationMs<0||input.durationMs>86400000)throw Error('Invalid reading timing');
 if(q.type==='write'){
  if(!s.ink.length)throw Error('Write something first, or choose a different activity');
  p.revision++;return finish(p,{kind:'writing',ok:false,independent:false,xp:0,ink:structuredClone(s.ink),durationMs:input.durationMs,line:READING_LINES.saved});
 }
 const built=['dictation','change'].includes(q.type)?s.draft.map(i=>q.tiles[i]).join(''):q.type==='sentence'?s.draft.map(i=>q.tiles[i]).join(' '):q.type==='act'?s.draft.map(i=>q.options[i].id).join('|'):input.answer;
 if(typeof built!=='string'||built.length>200)throw Error('Choose or build an answer');
 if(q.type==='decode'&&!q.options.some(o=>o.value===built)||q.type==='story'&&!q.options.includes(built))throw Error('Choose one of the answers');
 const ok=built===q.answer,independent=ok&&!s.help.length&&!s.mistakes,skill=s.skills[q.type]??={level:q.level,streak:0,tried:0,independent:0};
 skill.tried=(skill.tried||0)+1;p.revision++;
 if(!ok){s.mistakes++;skill.level=Math.max(1,skill.level-1);skill.streak=0;if(s.mistakes>=2&&!s.help.includes('show'))s.help.push('show');return {kind:'incorrect',ok:false,answer:built,line:READING_LINES.wrong};}
 skill.independent=(skill.independent||0)+Number(independent);skill.streak=independent?(skill.streak||0)+1:0;if(skill.streak>=2){skill.level=Math.min(3,skill.level+1);skill.streak=0;}
 const xp=independent?12:6;p.xp+=xp;p.questBook??={moves:0,words:0,matches:0,claimed:[]};p.questBook.moves++;p.questBook.words++;
 return finish(p,{kind:'correct',ok:true,independent,xp,answer:built,durationMs:input.durationMs,line:READING_LINES.correct});
}
export function readingVoiceLines(){const lines=[...Object.values(READING_LINES),...Object.values(prompts)];
 for(let level=1;level<=3;level++)for(const [type] of READING_TYPES)for(let index=0;index<24;index++){
  const p={id:'explorer',reading:{...readingState({}),run:index+1,focus:type,skills:{[type]:{level}}}};const q=readingQuestion(p);lines.push(q.prompt,q.helpLine,...(q.listenLine?[q.listenLine]:[]));
 }
 return [...new Set(lines)];}
