import {createHash} from 'node:crypto';
// Check filler and targets in all eight directions.
export const BANNED=Object.freeze(('ass arse bastard bitch blood boob bully bum butt crap cunt damn dead death dick die dork dumb fag fart fat freak fuck hate hell hit hurt idiot jerk kill loser mean moron naked nasty nazi nigger penis poo poop piss rape retard sex shit shutup slave slut stupid suck tit ugly vagina wank whore bad mad sad').toUpperCase().split(' '));
const directions=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
const fail=message=>{throw Object.assign(Error(message),{status:409});};
export const freshSearch=()=>({schema:1,revision:0,completed:0,current:null});
export const boardRule=completed=>completed<2?{size:6,count:4}:completed<4?{size:7,count:5}:{size:8,count:6};
export function seeded(seed){let x=createHash('sha256').update(seed).digest().readUInt32LE(0)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function shuffle(items,random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function occurrences(grid,size,word){
 const found=[];
 for(let r=0;r<size;r++)for(let c=0;c<size;c++)for(const [dr,dc]of directions){
  const er=r+dr*(word.length-1),ec=c+dc*(word.length-1);if(er<0||er>=size||ec<0||ec>=size)continue;
  const cells=Array.from({length:word.length},(_,i)=>(r+i*dr)*size+c+i*dc);
  if(cells.every((cell,i)=>grid[cell]===word[i]))found.push(cells);
 }return found;
}
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function allowedOccurrence(cells,target){return same(cells,target.cells)||(target.word===[...target.word].reverse().join('')&&same([...cells].reverse(),target.cells));}
export function boardErrors(board){
 const {size,grid,targets}=board,errors=[];
 if(![6,7,8].includes(size)||!Array.isArray(grid)||grid.length!==size*size||grid.some(c=>!/^[A-Z]$/.test(c))||!Array.isArray(targets))return ['shape'];
 for(const target of targets){
  if(!/^[A-Z]{3,8}$/.test(target.word)||!Array.isArray(target.cells)||target.cells.length!==target.word.length){errors.push('target');continue;}
  const [first,last]=[target.cells[0],target.cells.at(-1)],horizontal=Math.floor(first/size)===Math.floor(last/size);
  const step=horizontal?1:size;
  if(target.cells.some((n,i)=>!Number.isInteger(n)||n<0||n>=size*size||n!==first+i*step||grid[n]!==target.word[i]))errors.push('direction');
  if(occurrences(grid,size,target.word).some(c=>!allowedOccurrence(c,target)))errors.push('extra-target');
 }
 for(const word of BANNED)if(occurrences(grid,size,word).length)errors.push('vocabulary');
 return [...new Set(errors)];
}
const lineCache=new Map();
function lines(size){
 if(lineCache.has(size))return lineCache.get(size);
 const result=[];
 for(const [dr,dc]of [[0,1],[1,0],[1,1],[1,-1]])for(let r=0;r<size;r++)for(let c=0;c<size;c++){
  const previousR=r-dr,previousC=c-dc;
  if(previousR>=0&&previousR<size&&previousC>=0&&previousC<size)continue;
  const cells=[];for(let y=r,x=c;y>=0&&y<size&&x>=0&&x<size;y+=dr,x+=dc)cells.push(y*size+x);
  if(cells.length>=3)result.push(cells,cells.toReversed());
 }
 lineCache.set(size,result);return result;
}
function safePartial(grid,size,targets){
 // Scan whole lines in native string operations while filling. A dot preserves
 // each empty cell's position; it cannot join two separated letter fragments.
 for(const cells of lines(size)){
  const text=cells.map(n=>grid[n]||'.').join('');
  if(BANNED.some(word=>text.includes(word)))return false;
  for(const target of targets){
   let at=text.indexOf(target.word);
   while(at!==-1){
    if(!allowedOccurrence(cells.slice(at,at+target.word.length),target))return false;
    at=text.indexOf(target.word,at+1);
   }
  }
 }return true;
}
export function makeBoard({size,count,words,seed,date}){
 const random=seeded(seed),pool=[...new Set(words)].filter(w=>/^[A-Z]{3,8}$/.test(w)&&w.length<=size&&!BANNED.some(b=>w.includes(b)||[...w].reverse().join('').includes(b)));
 if(pool.length<count)fail('A grown-up can check the word pack.');
 for(let attempt=0;attempt<160;attempt++){
  const selected=pool.slice(0,count);
  // Rotate only if an otherwise valid pack cannot be placed without ambiguity.
  if(attempt&&attempt%20===0)pool.push(pool.shift());
  if(selected.some((a,i)=>selected.some((b,j)=>i!==j&&(a.includes(b)||a.includes([...b].reverse().join('')))))){pool.push(pool.shift());continue;}
  const grid=Array(size*size).fill(''),targets=[];let placed=true;
  for(const word of [...selected].sort((a,b)=>b.length-a.length)){
   const candidates=shuffle(Array.from({length:size*size*2},(_,i)=>({first:Math.floor(i/2),step:i%2?size:1})),random);
   let cells;
   for(const {first,step}of candidates){
    if(step===1&&first%size+word.length>size||step===size&&Math.floor(first/size)+word.length>size)continue;
    const path=Array.from({length:word.length},(_,i)=>first+i*step);
    if(path.some(n=>grid[n]))continue;
    path.forEach((n,i)=>grid[n]=word[i]);const target={word,cells:path};
    if(safePartial(grid,size,[...targets,target])){cells=path;targets.push(target);break;}
    path.forEach(n=>grid[n]='');
   }
   if(!cells){placed=false;break;}
  }
  if(!placed)continue;
  for(const cell of shuffle(grid.flatMap((v,i)=>v?[]:[i]),random)){
   let filled=false;
   for(const letter of shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ',random)){
    grid[cell]=letter;if(safePartial(grid,size,targets)){filled=true;break;}
   }
   if(!filled){placed=false;break;}
  }
  if(!placed)continue;
  const board={date,size,grid,targets:selected.map(w=>targets.find(t=>t.word===w)),found:[],phase:'play'};
  if(!boardErrors(board).length)return board;
 }fail('This word pack needs a grown-up review.');
}
export function searchAct(profile,input,{date,words,player}={}){
 let word=null,changed=false;
 if(input.type==='start'||input.type==='next'){
  if(input.type==='next'&&profile.current?.phase!=='finish')fail('Finish this board first.');
  if(input.type==='start'&&profile.current)return {changed:false,word:null};
  profile.current=makeBoard({...boardRule(profile.completed),words,date,seed:`${player}:${date}:${profile.completed}`});changed=true;
 }else if(input.type==='select'){
  const b=profile.current;if(!b)fail('Open a board first.');
  if(!Number.isInteger(input.first)||!Number.isInteger(input.last)||input.first<0||input.last<0||input.first>=b.grid.length||input.last>=b.grid.length)fail('Choose letters on the board.');
  const target=b.targets.find(t=>t.cells[0]===input.first&&t.cells.at(-1)===input.last&&!b.found.includes(t.word));
  if(target&&b.phase==='play'){
   word=target.word;b.found.push(word);changed=true;
   if(b.found.length===b.targets.length){b.phase='finish';profile.completed++;}
  }
 }else fail('Choose a board action.');
 if(changed)profile.revision++;
 return {changed,word};
}
