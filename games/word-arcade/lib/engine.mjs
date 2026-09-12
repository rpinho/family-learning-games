import {shortPrompt} from './speech-plan.mjs';
import {SHORT_FEEDBACK} from './voice.mjs';
import {FOUNDATION_WORDS,foundationQuestion,foundationAttempt} from './foundation.mjs';
import {lowerQuestion,lowerAttempt,lowerState} from './lowercase.mjs';
import {BUILDER_STARTERS,builderState,builderQuestion,builderAttempt} from './builder.mjs';
import {arcadeQuestion,arcadeAttempt} from './arcade-curriculum.mjs';
import {chooseWord,rememberWord} from './variety.mjs';
export const VERSION='word-arcade-2026-09-11-flight-rhymes-1';
export const GAMES=[
 ['blaster','Letter Blaster','SPELLING','Blast the missing letter. Power your starship.','🚀','#48dfec'],
 ['orbit','Orbit Builder','SPELLING','Connect drifting letters. Fly your word through space.','✦','#ffcc73'],
 ['flashcards','Flashcard Rally','READING & SPELLING','Flip a card. Build your answer. Race to the finish.','⚑','#b899ff'],
 ['asteroids','Word Asteroids','READING','Read the signal. Find its picture in space.','☄️','#7dabff'],
 ['wordoku','Wordoku','LETTER LOGIC','One of each letter in every row and column.','▦','#ffb95b'],
 ['rhyme','Rhyme Blaster','WORD FAMILIES','Hear the word. Blast its moving rhyme.','🪐','#ff8fc8'],
 ['transform','Word Reactor','WORD BUILDING','Change one letter. Transform the whole word.','⚗️','#bd9aff'],
 ['sort','Cargo Sorter','WORD FAMILIES','Read the ending. Send the cargo to its dock.','📦','#49e6be'],
 ['beats','Word Beats','LISTENING','Hear a word. Tap once for each syllable.','🥁','#ffc761'],
 ['cipher','Secret Signals','DECODING','Crack the symbol code to reveal a word.','◈','#63d4fc'],
 ['builder','Word Builder','SPELLING','Assemble a word to launch your rocket.','🛠️','#f9a9db'],
 ['train','Sentence Express','SENTENCES','Put the carriages in order. Send the train.','🚂','#6de4cb'],
 ['search','Word Radar','WORD SEARCH','Find a hidden word across or down the grid.','⌕','#bcacff'],
 ['pixel','Pixel Studio','CREATIVE PLAY','Paint with light. Make letters, pictures, anything.','🎨','#ffa776']
].map(([id,name,category,description,icon,color])=>({id,name,category,description,icon,color}));
export const WORDS=[
 [['cat','🐈'],['dog','🐕'],['sun','☀️'],['hat','🎩'],['pig','🐖'],['cup','☕'],['bed','🛏️'],['fox','🦊'],['map','🗺️'],['hen','🐔'],['pen','🖊️'],['bug','🐞'],['bat','🦇'],['web','🕸️'],['van','🚐'],['bus','🚌'],['ant','🐜'],['egg','🥚'],['red','🟥'],['leg','🦵'],['net','🥅'],['pot','🍲'],['bag','👜'],['ram','🐏']],
 [['ship','🚢'],['fish','🐟'],['frog','🐸'],['crab','🦀'],['duck','🦆'],['drum','🥁'],['ring','💍'],['flag','🚩'],['sock','🧦'],['shop','🏪'],['king','🤴'],['wing','🪽']],
 [['train','🚂'],['snail','🐌'],['sheep','🐑'],['shark','🦈'],['chair','🪑'],['whale','🐋'],['beach','🏖️'],['brush','🖌️'],['green','🟢'],['storm','⛈️'],['bread','🍞'],['clock','🕰️']]
];
const FAMILIES=[['at','cat','hat','bat','mat'],['og','dog','log','fog','jog'],['an','pan','fan','can','man'],['ig','pig','big','wig','dig'],['op','hop','mop','top','pop'],['ug','bug','rug','mug','hug'],['et','pet','net','jet','wet'],['in','pin','fin','win','bin'],['ag','bag','tag','rag','wag'],['ip','lip','zip','dip','tip'],['ot','pot','hot','dot','cot'],['am','jam','ham','ram','dam']];
const CHANGES=[['cat','hat'],['dog','log'],['pin','pan'],['map','cap'],['sun','fun'],['bed','red'],['ship','shop'],['fish','dish'],['ring','king'],['frog','from'],['snail','snarl'],['train','brain']];
const BEATS=[['cat',1],['rabbit',2],['banana',3],['dog',1],['tiger',2],['elephant',3],['sun',1],['rocket',2],['dinosaur',3],['cup',1],['pencil',2],['butterfly',3]];
const SENTENCES=[['The cat can nap.','I see a dog.','The sun is hot.','A pig can dig.'],['The frog is on a log.','Dad has a red hat.','The duck can swim fast.','A crab is in the sand.'],['The sheep sleeps under the tree.','I put my brush in the box.','The train stops at the red light.','The little snail hides from the rain.']];
export const LINES=['Welcome to Word Arcade. I am Nova. Pick a game and let us play.','Nice! Your engines are getting stronger.','That word has places to be. Launch it!','Mission control approves. Very fancy flying.','A little help is part of learning.','Not quite. You can try again.','Eight missions complete. Your ship deserves a snack.','Read the word, then choose its picture.','Read the word. Choose a word that rhymes.','Read the ending. Choose the matching cargo dock.','Follow the code key. Build the secret word.','Each row and column needs one of each letter. Tap an empty square, then a letter.','Paint anything you like. Your art is saved, not graded.','Find the word across or down. Tap its letters in order.','Tap once for each syllable. Then check your beat.','Build the sentence. Tap the words in order.','Your progress is saved. Come back whenever you like.'];
export function fresh(id){if(!['explorer','beginner','admin'].includes(id))throw Error('Unknown player');return {id,name:id==='admin'?'Admin':id==='beginner'?'Beginner':'Explorer',revision:0,xp:0,games:{},serial:0,session:null,art:Array(64).fill(0)};}
export const INSTRUCTIONS={asteroids:'Read the word, then choose its picture.',wordoku:'Each row and column needs one of each letter. Tap an empty square, then a letter.',rhyme:'Listen to the word. Find a word that rhymes.',sort:'Read the ending. Choose the matching cargo dock.',cipher:'Follow the code key. Build the secret word.',pixel:'Paint anything you like. Your art is saved, not graded.'};
const rotate=(a,n)=>a.slice(n%a.length).concat(a.slice(0,n%a.length));
const options=(a,n)=>rotate([...new Set(a)],n).reverse();
export function question(game,level,n){
 if(['orbit','flashcards'].includes(game)){const fake={id:'admin',drills:{[game+':words']:{stage:level,serial:n,recent:[],skills:{},wins:[],misses:0}}};return arcadeQuestion(fake,game,WORDS);}
 const pool=WORDS[level-1], [word,picture]=pool[n%pool.length], q={id:`${game}:${n}`,game,level,word,picture,answer:'',prompt:'',help:'',options:[],tiles:[],model:null};
 if(game==='lowercase'){const lower=lowerQuestion({lowercase:{...lowerState({}),serial:n,stage:level}});Object.assign(q,lower,{answer:lower.char,prompt:lower.prompt,help:`Big ${lower.char.toUpperCase()} pairs with little ${lower.char.toUpperCase()}.`});}
 if(game==='blaster'){const pos=n%word.length;q.position=pos;q.display=[...word].map((c,i)=>i===pos?'_':c).join(' ');q.answer=word[pos];q.options=options([q.answer,...'aeioubcdfghmnprst'.split('').filter(c=>c!==q.answer).slice(n%8,n%8+3)],n);q.prompt=`Complete the word ${word}. Blast the missing letter.`;q.help=`The word is ${word}. The missing letter is ${q.answer.toUpperCase()}.`;}
 if(game==='asteroids'){q.prompt=INSTRUCTIONS.asteroids;q.answer=word;q.options=options([word,...rotate(pool.map(x=>x[0]).filter(x=>x!==word),n*7).slice(0,3)],n);q.pictures=Object.fromEntries(pool);q.help=`The word is ${word}.`;}
 if(game==='wordoku'){const letters=['m','a','s','t'],grid=Array.from({length:16},(_,i)=>letters[(Math.floor(i/4)+i%4+n)%4]);const holes=rotate(Array.from({length:16},(_,i)=>i),n).slice(0,level*2+2);q.model=grid;q.grid=grid.map((c,i)=>holes.includes(i)?'':c);q.tiles=letters;q.answer=grid.join('');q.prompt=INSTRUCTIONS.wordoku;q.help='Use the highlighted model. Every row and column has all four letters.';}
 if(game==='rhyme'){const family=FAMILIES[n%FAMILIES.length];q.word=family[1+(Math.floor(n/FAMILIES.length)%4)];q.answer=family[1+((Math.floor(n/FAMILIES.length)+1)%4)];q.options=options([q.answer,...rotate(FAMILIES.filter(f=>f!==family),n).slice(0,level+1).map(f=>f[1])],n);q.prompt=shortPrompt(q);q.help=`${q.word} rhymes with ${q.answer}.`;}
 if(game==='transform'){const pair=CHANGES[(n+(level-1)*4)%CHANGES.length];q.from=pair[0];q.word=pair[1];q.answer=pair[1];q.tiles=options([...pair[0],...pair[1],'e','s'],n);q.prompt=`Change ${pair[0]} into ${pair[1]}. Replace one letter.`;q.help=`Build the word ${pair[1]}.`;}
 if(game==='sort'){const f=FAMILIES[n%FAMILIES.length];q.word=f[1+(Math.floor(n/FAMILIES.length)%4)];q.answer=f[0];q.options=options([f[0],...rotate(FAMILIES.filter(x=>x!==f),n).slice(0,level+1).map(x=>x[0])],n);q.prompt=INSTRUCTIONS.sort;q.help=`${q.word} belongs with words ending in ${f[0]}.`;}
 if(game==='beats'){const b=BEATS[n%BEATS.length];q.word=b[0];q.answer=String(b[1]);q.prompt=`Listen to ${b[0]}. Tap once for each syllable, then check.`;q.help=`${b[0]} has ${b[1]} ${b[1]===1?'syllable':'syllables'}.`;}
 if(game==='cipher'){q.tiles=options([...word,'e','r','s'],n);const symbols=['◆','●','▲','■','★','☾','✚','⬟'];q.key=Object.fromEntries(q.tiles.map((c,i)=>[symbols[i],c]));q.code=[...word].map(c=>Object.keys(q.key).find(k=>q.key[k]===c));q.answer=word;q.prompt=INSTRUCTIONS.cipher;q.help=`The secret word is ${word}.`;}
 if(game==='builder'){q.tiles=options([...word,...(level===1?'ae':level===2?'aert':'aeornt')],n);q.answer=word;q.prompt=`Build the word ${word}. Tap the letters in order.`;q.help=`The word is ${word}.`;}
 if(game==='train'){q.word=SENTENCES[level-1][n%4];q.tiles=rotate(q.word.split(' '),1);q.answer=q.word;q.prompt=`Build this sentence. ${q.word}`;q.help=q.word;}
 if(game==='search'){q.size=6;const chars='abcdefghijklmnopqrstuvwxyz';q.grid=Array.from({length:36},(_,i)=>chars[(i*7+n)%26]);q.path=Array.from({length:word.length},(_,i)=>n%2===0?(n%6)*6+i:i*6+n%6);q.path.forEach((j,i)=>q.grid[j]=word[i]);q.answer=q.path.join(',');q.prompt=`Find the word ${word}. Tap its letters in order, across or down.`;q.help=`Find ${word}. Follow the highlighted path.`;}
 return q;
}
export function act(p,input){
 if(!input||input.revision!==p.revision)throw Error('Your game changed in another tab. Refresh to continue.');
 const s=p.session;let result={kind:input.kind};
 if(input.kind==='start'){
  if(!GAMES.some(g=>g.id===input.game))throw Error('Choose a game');if(input.focus!==undefined&&!['words','lowercase'].includes(input.focus))throw Error('Choose a practice focus');
  if(s?.game==='builder'&&!p.builder)p.builder=builderState(p);
  if(!p.variety&&s?.q?.word)rememberWord(p,s.q.word);
  p.serial++;const level=input.level===undefined?(p.games[input.game]?.level||1):input.level;if(![1,2,3].includes(level))throw Error('Invalid level');
  if(input.mode!==undefined&&!['practice','arcade'].includes(input.mode))throw Error('Choose a flight mode');
  if(input.deck!==undefined&&!['words','letters','spelling'].includes(input.deck))throw Error('Choose a deck');
  p.session={game:input.game,focus:input.focus||'words',mode:input.mode||'practice',deck:input.deck||'words',run:p.serial,round:0,level,score:0,correct:0,assisted:0,phase:'question',help:false,misses:0,draft:[],results:[],started:Date.now()};
  if(input.game==='pixel'){p.session.phase='art';}else setup(p);result.line=p.session.q?.prompt||INSTRUCTIONS.pixel;
 }else if(input.kind==='art'){
  if(s?.game!=='pixel'||!Array.isArray(input.pixels)||input.pixels.length!==64||input.pixels.some(x=>!Number.isInteger(x)||x<0||x>7))throw Error('Invalid painting');p.art=[...input.pixels];
 }else{
  if(!s||!s.q||input.questionId!==s.q.id)throw Error('This mission is no longer active.');const q=s.q;
  if(input.kind==='next'){if(s.phase!=='result')throw Error('Finish this round first');s.round++;if(s.round===8){s.phase='complete';const g=p.games[s.game]||{};p.games[s.game]={...g,level:s.level,played:(g.played||0)+1,best:Math.max(g.best||0,s.score)};result.line=LINES[6];}else {setup(p);result.line=s.q.prompt;}}
  else if(s.phase!=='question')throw Error('Already submitted');
  else if(input.kind==='help'){s.help=true;result.line=q.help;}
  else if(input.kind==='draft'){
   const d=input.draft;if(!Array.isArray(d)||d.length>36||d.some(x=>typeof x!=='string'||x.length>30))throw Error('Invalid draft');
   if(['builder','cipher','transform','wordoku','orbit','flashcards'].includes(s.game)&&d.some(x=>x!==''&&!q.tiles.includes(x)))throw Error('Invalid letter');
   if(s.game==='train'&&d.some(x=>!q.tiles.includes(x)))throw Error('Invalid carriage');
   if(s.game==='train'&&d.some(x=>d.filter(t=>t===x).length>q.tiles.filter(t=>t===x).length))throw Error('Carriage already used');
   if(s.game==='search'&&d.some(x=>!/^\d+$/.test(x)||+x>35))throw Error('Invalid radar position');
   if(s.game==='wordoku'&&(d.length!==16||q.grid.some((x,i)=>x&&d[i]!==x)))throw Error('Keep the given letters');
   if(s.game==='beats'&&d.some(x=>x!=='beat'))throw Error('Invalid beat');s.draft=[...d];
  }else if(input.kind==='answer'){
   if(!Number.isFinite(input.durationMs)||input.durationMs<0||input.durationMs>86400000)throw Error('Invalid duration');
   s.activeMs=(s.activeMs||0)+input.durationMs;
   let answer=input.answer;
   if(['builder','cipher','transform','wordoku','orbit'].includes(s.game)||s.game==='flashcards'&&s.deck==='spelling')answer=s.draft.join('');
   if(s.game==='train')answer=s.draft.join(' ');
   if(s.game==='search')answer=s.draft.join(',');
   if(s.game==='beats')answer=String(s.draft.length);
   if(typeof answer!=='string'||answer.length>200)throw Error('Choose an answer');
   let ok=answer===q.answer;
   if(s.game==='search'){const path=s.draft.map(Number);ok=path.length===q.word.length&&path.map(i=>q.grid[i]).join('')===q.word&&path.every((x,i)=>!i||(x===path[i-1]+1&&Math.floor(x/6)===Math.floor(path[i-1]/6))||x===path[i-1]+6);}
   if(s.game==='wordoku'){const d=s.draft;ok=d.length===16&&d.every(x=>q.tiles.includes(x))&&Array.from({length:4},(_,r)=>new Set(d.slice(r*4,r*4+4)).size===4&&new Set([0,1,2,3].map(c=>d[c*4+r])).size===4).every(Boolean);}
   if(s.game==='blaster'&&s.focus==='lowercase')lowerAttempt(p,q,{ok,helped:s.help||s.misses>0});
   if(s.game==='builder')builderAttempt(p,q,{ok,helped:s.help||s.misses>0});
   if(q.foundation)foundationAttempt(p,q,{ok,helped:s.help||s.misses>0});
   if(!ok){s.misses++;s.level=Math.max(1,s.level-1);s.streak=0;if(s.misses>=2)s.help=true;result={kind:'wrong',line:LINES[5],ok:false,answer};}
   else{const independent=!s.help&&!s.misses,points=independent?100:40;s.score+=points;s.correct++;s.assisted+=Number(!independent);s.streak=independent?(s.streak||0)+1:0;if(s.streak>=2){s.level=Math.min(3,s.level+1);s.streak=0;}const literacy=!['wordoku','cipher'].includes(s.game);p.xp+=literacy?(independent?12:6):0;s.phase='result';s.results.push({q,answer,independent,points,misses:s.misses,help:s.help,durationMs:input.durationMs});result={kind:'correct',ok:true,independent,points,line:LINES[1+(s.round%3)]};}
   if(s.game==='builder')s.level=p.builder.stage;
   if(['orbit','flashcards'].includes(s.game))s.level=arcadeAttempt(p,q,{ok,helped:s.help||s.misses>0});
  }else throw Error('Unknown action');
 }
 p.revision++;return result;
}
function setup(p){
 const s=p.session;
 if(!p.variety&&s.q?.word)rememberWord(p,s.q.word);
 if(s.game==='builder'){s.q=builderQuestion(p,WORDS);s.level=s.q.level;}
 else if(['orbit','flashcards'].includes(s.game)){s.q=arcadeQuestion(p,s.game,WORDS,s.deck||'words');s.level=s.q.level;}
 else{
  const level=s.game==='asteroids'&&s.focus==='words'?1:s.level,n=(s.run-1)*8+s.round+(p.id==='beginner'?3:0);
  s.q=question(s.game,level,n);
  if(['asteroids','rhyme','sort'].includes(s.game)){
   const candidates=Array.from({length:144},(_,i)=>question(s.game,level,n+i));
   const word=chooseWord(p,[...new Set(candidates.map(q=>q.word))],{serial:n});
   s.q=candidates.find(q=>q.word===word);
  }
  if(s.game==='asteroids'&&s.focus==='words')s.q.printCase='upper';
  if(s.game==='blaster'&&s.focus==='lowercase'){const lower=lowerQuestion(p);Object.assign(s.q,lower,{focus:'lowercase',level:lower.stage,answer:lower.char,help:`Big ${lower.char.toUpperCase()} pairs with little ${lower.char.toUpperCase()}.`});}
  if(s.game==='blaster'&&s.focus==='words'){const q=foundationQuestion(p);Object.assign(s.q,q,{level:q.stage});}
 }
 rememberWord(p,s.q.word);
 s.q.id=`${s.run}:${s.round}`;s.phase='question';s.help=false;s.misses=0;s.draft=s.game==='wordoku'?[...s.q.grid]:s.game==='transform'?[...s.q.from]:[];
}
export function voiceLines(){const all=new Set([...LINES,...SHORT_FEEDBACK,...FAMILIES.flatMap(f=>f.slice(1).map(w=>`The word is ${w}.`))]);for(const g of GAMES)for(let l=1;l<=3;l++)for(let n=0;n<120;n++){const q=question(g.id,l,n);if(q.prompt){all.add(q.prompt);all.add(shortPrompt(q));}if(q.help)all.add(q.help);}for(const word of [...new Set([...FOUNDATION_WORDS,...BUILDER_STARTERS,...WORDS.flat().map(x=>x[0])])]){all.add(`Build the word ${word}. Tap the letters in order.`);all.add(`Yes! ${word}.`);all.add(`The word is ${word}.`);for(const c of word.toUpperCase())all.add(`The word is ${word}. The missing letter is ${c}.`);}for(const c of 'abcdefghijklmnopqrstuvwxyz'){all.add(`Find little ${c.toUpperCase()}.`);all.add(`Big ${c.toUpperCase()} pairs with little ${c.toUpperCase()}.`);all.add(`The letter ${c.toUpperCase()}.`);all.add(`Letter ${c.toUpperCase()}.`);}return [...all];}
