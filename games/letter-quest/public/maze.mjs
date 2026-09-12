import {useHint} from './hints.mjs';
import {mazeTheme} from './maze-themes.mjs';
import {mazeLearning,mazeLearningLines} from './maze-learning.mjs';
import {AT_WORDS,EXTRA_WORDS,familyNameQuestion,familyNameVoiceLines,practiceWord} from './maze-curriculum.mjs';
import {WORDS,taskPrompt} from './engine.mjs';
import {mazeSkill,mazeSkillState,recordMazeSkill} from './maze-skills.mjs';
import {BLEND_WORDS,BLEND_PROMPT,READ_PROMPT,phonicsVoiceLines} from './phonics.mjs';
export const MAZE_LINES={intro:'Welcome to the labyrinth! Solve a puzzle at each new turn. Your answer wakes up the magic compass.',locked:'A puzzle guards this turn. Solve it to discover the way out.',correct:'The compass is awake! Follow the golden arrow.',wrong:'Not quite. Try another answer. Nothing is lost.',hint:'Here is a clue. Tap the glowing answer, and we will find our way together.',wall:'A wall! Very solid. My mustache checked.',won:'We escaped! I was never worried. Except for all the times I was worried.',forward:'Go straight ahead.',right:'Turn right, then go forward.',left:'Turn left, then go forward.',back:'Turn around, then go forward.'};
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
export const MAZE_WORDS=[...WORDS.filter(w=>w.tier<=2),...AT_WORDS,...EXTRA_WORDS].filter((w,i,all)=>all.findIndex(v=>v.word===w.word)===i);
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shuffle=(items,r)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function mazeState(p){return p.maze||{level:1,position:null,direction:0,solved:[],visited:[],tasks:{},failures:{},hints:[],ability:p.id==='beginner'?1:2,streak:0,moves:0,done:false,history:[]};}
const cache=new Map();
export function mazeBoard(p){
 const s=mazeState(p),rooms=Math.min(p.id==='beginner'?4:6,(p.id==='beginner'?3:4)+Math.floor((s.level-1)/3)),size=rooms*2+1,seed=2717+s.level*7919+(p.id==='beginner'?71:0),key=`${size}:${seed}`;
 if(cache.has(key))return cache.get(key);
 const r=random(seed),grid=Array.from({length:size},()=>Array(size).fill(1)),stack=[[1,size-2]],seen=new Set([`${1},${size-2}`]);grid[size-2][1]=0;
 while(stack.length){const [x,z]=stack.at(-1),next=shuffle(dirs,r).map(([dx,dz])=>[x+dx*2,z+dz*2,dx,dz]).find(([nx,nz])=>nx>0&&nz>0&&nx<size-1&&nz<size-1&&!seen.has(`${nx},${nz}`));
  if(!next){stack.pop();continue;}const [nx,nz,dx,dz]=next;grid[z+dz][x+dx]=0;grid[nz][nx]=0;seen.add(`${nx},${nz}`);stack.push([nx,nz]);
 }
 // Extend the old exit corridor through the north boundary. Existing interior
 // cells, saved positions, puzzles and seeds remain intact.
 const board={size,grid,start:(size-2)*size+1,exit:size-2,seed,level:s.level,theme:mazeTheme(s.level)};
 // A tiny DFS can occasionally be one unbranched snake. Add one crossing in
 // that case, so every labyrinth genuinely offers a choice of routes.
 if(!grid.some((row,z)=>row.some((v,x)=>!v&&mazeOpen(board,z*size+x).length>=3))){
  outer:for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++)if(grid[z][x]){
   for(const [a,c] of [[[x-1,z],[x+1,z]],[[x,z-1],[x,z+1]]])if(grid[a[1]][a[0]]===0&&grid[c[1]][c[0]]===0&&(mazeOpen(board,a[1]*size+a[0]).length>=2||mazeOpen(board,c[1]*size+c[0]).length>=2)){grid[z][x]=0;break outer;}
  }
 }
 grid[0][size-2]=0;
 if(cache.size>80)cache.delete(cache.keys().next().value);cache.set(key,board);return board;
}
export function mazeOpen(board,pos){const x=pos%board.size,z=Math.floor(pos/board.size);return dirs.map(([dx,dz],direction)=>({direction,position:(z+dz)*board.size+x+dx})).filter(({position})=>position>=0&&position<board.size**2&&board.grid[Math.floor(position/board.size)][position%board.size]===0);}
export function mazeRoute(board,pos){
 const queue=[[pos]],seen=new Set([pos]);
 while(queue.length){const path=queue.shift(),current=path.at(-1);if(current===board.exit)return path;for(const n of mazeOpen(board,current))if(!seen.has(n.position)){seen.add(n.position);queue.push([...path,n.position]);}}
 return [];
}
export function mazeGate(p){const s=mazeState(p),b=mazeBoard(p),pos=s.position??b.start;if(s.review||s.done||pos===b.exit||s.solved.includes(pos))return false;const exits=mazeOpen(b,pos);return pos===b.start||exits.length>=3||exits.length===2&&(exits[0].direction+2)%4!==exits[1].direction;}
export function mazeQuestion(p){
 const s=mazeState(p),b=mazeBoard(p),pos=s.position??b.start;
 if(s.review)return s.review.question;
 if(s.tasks[pos])return s.tasks[pos];
 const serial=s.practiceSerial||0,r=random(b.seed+pos*3571),scheduled=['name','gap','word','name','blend','find'][serial%6];
 // Reserve alternating word slots for recall. Never consume missing-letter
 // slots: a growing review queue must not crowd out the other activities.
 const due=s.blendReviews?.find(x=>x.due<=serial),type=due&&scheduled==='word'&&Math.floor(serial/6)%2===1?'read':scheduled;
 const level=mazeSkillState(s,mazeSkill(type)||'reading').level,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',count=level===1?2:4;
 const id=`maze1:${s.level}:${pos}`,base={id,type,level};
 if(type==='name')return {...base,...familyNameQuestion(p.id,s.nameSerial||0)};
 if(type==='blend'){
  const word=BLEND_WORDS[(s.blendSerial||0)%BLEND_WORDS.length],w=MAZE_WORDS.find(w=>w.word===word);
  return {...base,...w,answer:word,options:[word],prompt:BLEND_PROMPT};
 }
 if(type==='read'){
  const w=MAZE_WORDS.find(w=>w.word===due.word),others=MAZE_WORDS.filter(x=>x.tier===1&&x.picture&&x.word!==w.word);
  const choices=shuffle([w,...shuffle(others,r).slice(0,count-1)],r);
  return {...base,...w,answer:w.word,options:choices.map(x=>x.word),pictures:Object.fromEntries(choices.map(x=>[x.word,x.picture])),prompt:READ_PROMPT,delayedCheck:true};
 }
 if(type==='gap'||type==='word'){
  const pool=MAZE_WORDS.filter(w=>w.tier<=(level===3?2:1)),reviewWord=s.reviewWords?.[0],repeat=reviewWord&&s.solved.length%3===2,reviewItem=MAZE_WORDS.find(w=>w.word===reviewWord),w=repeat&&reviewItem?reviewItem:practiceWord(s.wordSerial||0,pool,s.recentWords||[]),blank=level===1?0:Math.floor(r()*w.word.length),answer=type==='word'?w.word:w.word[blank];
  return {...base,...w,blank,answer,prompt:type==='word'?`Find the word ${w.word}.`:taskPrompt({type:'gap',word:w.word}),options:type==='word'?shuffle([answer,...shuffle(pool.filter(t=>t.word!==answer).map(t=>t.word),r).slice(0,count-1)],r):shuffle([answer,...shuffle([...alphabet.toLowerCase()].filter(c=>c!==answer),r).slice(0,count-1)],r)};
 }
 const char=alphabet[Math.floor(r()*24)],letters=[char,String.fromCharCode(char.charCodeAt(0)+1),String.fromCharCode(char.charCodeAt(0)+2)],blank=Math.floor(r()*3),answer=type==='find'?(level===3?char.toLowerCase():char):letters[blank];
 return {...base,char:answer,answer,letters,blank,prompt:taskPrompt({type,char:answer}),options:shuffle([answer,...shuffle([...(level===3&&type==='find'?alphabet.toLowerCase():alphabet)].filter(c=>c!==answer),r).slice(0,count-1)],r)};
}
export function mazeClue(p){const s=mazeState(p),b=mazeBoard(p),pos=s.position??b.start;if(s.review||mazeGate(p)||s.done)return null;const next=mazeRoute(b,pos)[1],absolute=mazeOpen(b,pos).find(n=>n.position===next)?.direction;if(absolute===undefined)return null;const turn=(absolute-s.direction+4)%4,key=['forward','right','back','left'][turn];return {absolute,turn,key,line:MAZE_LINES[key]};}
function initialize(p){if(!p.maze){p.maze=structuredClone(mazeState(p));const b=mazeBoard(p);p.maze.position=b.start;p.maze.direction=mazeOpen(b,b.start)[0].direction;p.maze.visited=[b.start];}return p.maze;}
export function mazeAction(p,input){
 if(!['enter','turn','forward','answer','hint','next','retry','sound'].includes(input.kind))throw Error('Unknown maze move');
 const fresh=!p.maze,s=initialize(p),b=mazeBoard(p);
 if(input.kind==='enter'){if(mazeGate(p))s.tasks[s.position]??=mazeQuestion(p);if(fresh)p.revision++;return {kind:'enter',line:MAZE_LINES.intro};}
 if(input.kind==='next'){
  if(!s.done)throw Error('Escape this labyrinth first');
  const {level,ability,history,reviewWords=[],practiceSerial=0,nameSerial=0,wordSerial=0,recentWords=[],practiceSkills,skillGates,blendSerial=0,blendReviews=[]}=s;p.maze={...structuredClone(mazeState({id:p.id})),level:level+1,ability,history,reviewWords,practiceSerial,nameSerial,wordSerial,recentWords,practiceSkills,skillGates,blendSerial,blendReviews};const n=mazeBoard(p);p.maze.position=n.start;p.maze.direction=mazeOpen(n,n.start)[0].direction;p.maze.visited=[n.start];p.revision++;return {kind:'next',line:MAZE_LINES.intro};
 }
 if(s.done)throw Error('This labyrinth is complete');
 if(s.review){
  if(input.kind!=='retry')throw Error('Look at the word, then try the gate again.');
  const review=s.review;
  if(input.questionId!==review.question.id)throw Error('The maze puzzle changed. Reload to continue.');
  if(s.position!==review.gate&&!mazeOpen(b,s.position).some(n=>n.position===review.gate))throw Error('The return path is blocked.');
  s.position=review.gate;s.direction=review.direction;s.review=null;s.lastLearning=null;p.revision++;
  return {kind:'retry',question:review.question,helped:true,line:review.question.prompt};
 }
 if(input.kind==='retry')throw Error('There is no puzzle to retry.');
 if(input.kind==='turn'){
  if(![-1,1,2].includes(input.turn))throw Error('Choose left or right');s.direction=(s.direction+input.turn+4)%4;p.revision++;return {kind:'turn'};
 }
 if(input.kind==='forward'){
  if(mazeGate(p))return {kind:'locked',line:MAZE_LINES.locked};
  const n=mazeOpen(b,s.position).find(n=>n.direction===s.direction);if(!n)return {kind:'wall',line:MAZE_LINES.wall};
  s.previousPosition=s.position;s.position=n.position;s.lastLearning=null;s.moves++;if(!s.visited.includes(s.position))s.visited.push(s.position);p.revision++;
  if(s.position===b.exit){s.done=true;p.xp+=40;p.gems+=10;s.history.push({level:s.level,theme:b.theme.id,moves:s.moves,solved:s.solved.length,hints:s.hints.length,ability:s.ability,at:new Date().toISOString()});s.history=s.history.slice(-30);return {kind:'won',xp:40,gems:10,line:MAZE_LINES.won};}
  if(mazeGate(p))s.tasks[s.position]??=mazeQuestion(p);
  return {kind:mazeGate(p)?'gate':'move'};
 }
 if(!mazeGate(p))throw Error('This turn is already unlocked');
 const q=s.tasks[s.position]??=mazeQuestion(p);
 if(input.questionId!==q.id)throw Error('The maze puzzle changed. Reload to continue.');
 if(input.kind==='sound'){
  if(q.type!=='blend'||!Number.isInteger(input.index)||input.index<0||input.index>=q.word.length)throw Error('Choose a sound stone.');
  s.blendSteps??={};const heard=s.blendSteps[s.position]??=[];
  if(!heard.includes(input.index)){heard.push(input.index);p.revision++;}
  return {kind:'sound',index:input.index,letter:q.word[input.index],guided:true};
 }
 if(input.kind==='hint'){if(!s.hints.includes(s.position)){useHint(p,`maze:${q.id}`);s.hints.push(s.position);p.revision++;}return {kind:'hint',line:MAZE_LINES.hint};}
 if(typeof input.answer!=='string'||!q.options.includes(input.answer))throw Error('Choose one of the puzzle answers');
 if(q.type==='blend'&&(s.blendSteps?.[s.position]?.length||0)!==q.word.length)throw Error('Tap all three sound stones first.');
 const correct=input.answer===q.answer,helped=['name','blend'].includes(q.type)||s.hints.includes(s.position)||(s.failures[s.position]||0)>0;
 const adaptation=recordMazeSkill(s,q,correct,helped);
 p.revision++;
 if(!correct){
  const gate=s.position,first=!s.failures[gate],previous=s.previousPosition;
  s.failures[gate]=(s.failures[gate]||0)+1;s.streak=0;
  const steppedBack=first&&Number.isInteger(previous)&&s.visited.includes(previous)&&mazeOpen(b,gate).some(n=>n.position===previous);
  s.review={gate,direction:s.direction,question:q,learning:mazeLearning(q),steppedBack};
  if(steppedBack){s.position=previous;s.setbacks=(s.setbacks||0)+1;}
  if(s.failures[gate]>=2&&!s.hints.includes(gate))s.hints.push(gate);
  if(q.word)s.reviewWords=[...(s.reviewWords||[]).filter(w=>w!==q.word),q.word].slice(-6);
  return {kind:'incorrect',ok:false,question:q,helped,adaptation,steppedBack,learning:s.review.learning,line:steppedBack?'One step back. Let’s learn it together.':'Let’s learn it together.'};
 }
 s.solved.push(s.position);const xp=helped?6:10;p.xp+=xp;
 s.lastLearning=mazeLearning(q);
 s.practiceSerial=(s.practiceSerial||0)+1;
 if(q.type==='name')s.nameSerial=(s.nameSerial||0)+1;
 if(q.type==='blend'){
  s.blendSerial=(s.blendSerial||0)+1;
  s.blendReviews=[...(s.blendReviews||[]).filter(x=>x.word!==q.word),{word:q.word,due:s.practiceSerial+3}].slice(-10);
 }
 if(q.type==='read')s.blendReviews=(s.blendReviews||[]).map(x=>x.word!==q.word?x:{...x,due:s.practiceSerial+(helped?3:12)});
 if(q.word){s.wordSerial=(s.wordSerial||0)+1;s.recentWords=[...(s.recentWords||[]),q.word].slice(-6);}
 if(!helped&&q.word)s.reviewWords=(s.reviewWords||[]).filter(w=>w!==q.word);
 p.questBook??={moves:0,words:0,matches:0,claimed:[]};p.questBook.moves++;if(['word','gap','blend','read'].includes(q.type))p.questBook.words++;
 return {kind:'correct',ok:true,question:q,helped,adaptation,xp,learning:s.lastLearning,line:MAZE_LINES.correct};
}
export function mazeVoiceLines(){return [...Object.values(MAZE_LINES),'One step back. Let’s learn it together.','Let’s learn it together.',...phonicsVoiceLines(),...familyNameVoiceLines(),...mazeLearningLines(MAZE_WORDS),...MAZE_WORDS.flatMap(w=>[`Find the word ${w.word}.`,taskPrompt({type:'gap',word:w.word})])];}
