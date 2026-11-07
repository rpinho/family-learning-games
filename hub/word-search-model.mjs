import {createHash} from 'node:crypto';
import {hasPicture} from './public/word-blocks/art.mjs';
// Installations may supply additional excluded words without publishing their vocabulary.
export const excludedName=(word,extra=[])=>extra.some(n=>String(n).toUpperCase()===word);
export const nameFits=(word,size)=>typeof word==='string'&&/^[A-Z]{3,10}$/.test(word)&&word.length<=size;

// Reviewed safety vocabulary. Substrings are checked in all eight directions,
// including inside placed words. New private names cannot bypass this policy.
export const BANNED=Object.freeze(('ass arse bastard bitch blood boob bully bum butt crap cunt damn dead death dick die dork dumb fag fart fat freak fuck hate hell hit hurt idiot jerk kill loser mean moron naked nasty nazi nigger penis poo poop piss rape retard sex shit shutup slave slut stupid suck tit ugly vagina wank whore bad mad sad').toUpperCase().split(' '));
const directions=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
const fail=message=>{throw Object.assign(Error(message),{status:409});};
export const freshSearch=()=>({schema:1,revision:0,completed:0,current:null,days:{},nameCycle:[]});
// Lifetime finishes unlock challenge; the first two finishes each day are warm-ups.
export function boardRule(completed,dailyIndex=Infinity){
 const step=Math.min(completed,dailyIndex===0?0:dailyIndex===1?2:Infinity);
 return step<2?{size:6,count:4}:step<4?{size:7,count:5}:step<6?{size:8,count:6}:step<9?{size:9,count:7}:step<12?{size:10,count:8}:
  {size:12,count:10,...(step>=18?{backwards:true}:{}),...(step>=26?{diagonals:true}:{})};
}
export const validSearchDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
// Keep legacy normal-board counters valid for older readers of schema 1.
// Story credit lives beside its board and joins the same daily reward count.
export const dailyCount=(profile,date)=>(profile.days?.[date]||0)+Object.values(profile.story?.chapters||{}).filter(g=>g.done&&g.finishedDate===date).length;
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
export function boardErrors(board,{excludedNames=[]}={}){
 const {size,grid,targets}=board,errors=[];
 if(![6,7,8,9,10,12].includes(size)||!Array.isArray(grid)||grid.length!==size*size||grid.some(c=>!/^[A-Z]$/.test(c))||!Array.isArray(targets))return ['shape'];
 for(const target of targets){
  if(!/^[A-Z]{3,12}$/.test(target.word)||!Array.isArray(target.cells)||target.cells.length!==target.word.length){errors.push('target');continue;}
  const [first,last]=[target.cells[0],target.cells.at(-1)],dr=(Math.floor(last/size)-Math.floor(first/size))/(target.word.length-1),dc=(last%size-first%size)/(target.word.length-1);
  const legal=directions.some(([r,c])=>r===dr&&c===dc)&&(!dr||!dc||board.diagonals)&&((dr>=0&&dc>=0)||board.backwards);
  if(!legal||target.cells.some((n,i)=>!Number.isInteger(n)||n<0||n>=size*size||n!==first+i*(dr*size+dc)||grid[n]!==target.word[i]))errors.push('direction');
  if(occurrences(grid,size,target.word).some(c=>!allowedOccurrence(c,target)))errors.push('extra-target');
 }
 for(const word of BANNED)if(occurrences(grid,size,word).length)errors.push('vocabulary');
 for(const cells of lines(size)){
  const text=cells.map(n=>grid[n]).join('');
  for(const length of new Set([4,5,8,...excludedNames.map(n=>n.length)]))for(let at=0;at+length<=text.length;at++)if(excludedName(text.slice(at,at+length),excludedNames))errors.push('excluded-name');
 }
 if(board.mode!==undefined){
  if(board.mode!=='expert'||size!==12||!Array.isArray(board.decoys)||board.decoys.length!==2)errors.push('expert');
  else for(const d of board.decoys){
   if(!d||typeof d.word!=='string'||!Array.isArray(d.cells)||targets.some(t=>t.word===d.word)||!targets.some(t=>t.word.length>=5&&t.word.length===d.word.length&&[...t.word].filter((c,i)=>c!==d.word[i]).length===1))errors.push('decoy');
   else if(boardErrors({...board,mode:undefined,targets:[d],decoys:undefined},{excludedNames}).length)errors.push('decoy');
  }
 }
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
// Near misses are checked on the actual grid, not just their placement metadata.
function extraNearMiss(grid,size,targets,decoys){
 for(const cells of lines(size)){
  const text=cells.map(n=>grid[n]||'.').join('');
  for(const target of targets.filter(t=>t.word.length>=5))for(let at=0;at+target.word.length<=text.length;at++){
   const word=text.slice(at,at+target.word.length);if(word.includes('.'))continue;
   let difference=0;for(let i=0;i<word.length;i++)if(word[i]!==target.word[i])difference++;
   if(difference===1&&!decoys.some(d=>d.word===word&&same(d.cells,cells.slice(at,at+word.length))))return true;
  }
 }return false;
}
function placeDecoys(grid,size,targets,{random,names,excludedNames,packWords,backwards,diagonals}){
 const decoys=[],sources=targets.filter(t=>t.word.length>=5&&!names.includes(t.word));
 if(!sources.length)return null;
 const legal=directions.filter(([dr,dc])=>(diagonals||!dr||!dc)&&(backwards||dr>=0&&dc>=0));
 const forbidden=[...new Set([...names,...excludedNames,...BANNED])];
 const real=new Set([...packWords,...targets.map(t=>t.word)]);
 for(let index=0;index<2;index++){
  let placed=false;
  for(const source of shuffle(sources,random)){
   const variants=shuffle(Array.from({length:source.word.length*26},(_,i)=>{
    const at=Math.floor(i/26);return source.word.slice(0,at)+String.fromCharCode(65+i%26)+source.word.slice(at+1);
   }),random);
   for(const word of variants){
    const reverse=[...word].reverse().join('');
    if(word===source.word||real.has(word)||real.has(reverse)||decoys.some(d=>d.word===word)||forbidden.some(n=>word.includes(n)||reverse.includes(n)))continue;
    let excluded=false;
    for(const length of new Set([4,5,8,...excludedNames.map(n=>n.length)]))for(let at=0;at+length<=word.length;at++)if(excludedName(word.slice(at,at+length),excludedNames)||excludedName(reverse.slice(at,at+length),excludedNames))excluded=true;
    if(excluded)continue;
    const candidates=shuffle(Array.from({length:size*size*legal.length},(_,i)=>({first:Math.floor(i/legal.length),direction:legal[i%legal.length]})),random);
    for(const {first,direction:[dr,dc]}of candidates){
     const y=Math.floor(first/size)+dr*(word.length-1),x=first%size+dc*(word.length-1);
     if(y<0||y>=size||x<0||x>=size)continue;
     const cells=Array.from({length:word.length},(_,i)=>first+i*(dr*size+dc));
     if(cells.some((n,i)=>grid[n]&&grid[n]!==word[i]))continue;
     const empty=cells.filter(n=>!grid[n]);if(!empty.length)continue;
     cells.forEach((n,i)=>grid[n]=word[i]);const decoy={word,cells};
     if(safePartial(grid,size,targets)&&!extraNearMiss(grid,size,targets,[...decoys,decoy])){decoys.push(decoy);placed=true;break;}
     empty.forEach(n=>grid[n]='');
    }
    if(placed)break;
   }
   if(placed)break;
  }
  if(!placed)return null;
 }
 return decoys;
}
export function makeBoard({size,count,words,seed,date,required=[],backwards=false,diagonals=false,dailyIndex,names=[],excludedNames=[],targetHasPicture=word=>hasPicture(word.toLowerCase()),mode,packWords=words,targetHasAudio=()=>false}){
 const expert=mode==='expert';
 if(expert&&size!==12)fail('Expert gardens use the largest board.');
 const requestedCount=count;
 const random=seeded(seed),pool=[...new Set(words)].filter(w=>/^[A-Z]{3,12}$/.test(w)&&w.length<=size&&(!names.includes(w)||nameFits(w,size))&&!excludedName(w,excludedNames)&&!BANNED.some(b=>w.includes(b)||[...w].reverse().join('').includes(b)));
 if(!pool.length)fail('A grown-up can check the word pack.');
 count=Math.min(count,pool.length);
 // Keep the normal deterministic placement attempts before reducing a deal.
 for(;count>=Math.max(1,required.length);count--){
 for(let attempt=0;attempt<160;attempt++){
  const selected=[...required,...pool.filter(w=>!required.includes(w))].slice(0,count);
  if(required.some(w=>!pool.includes(w)))fail('A grown-up can check the word pack.');
  // Rotate only if an otherwise valid pack cannot be placed without ambiguity.
  if(attempt&&attempt%20===0)pool.push(pool.shift());
  if(selected.some((a,i)=>selected.some((b,j)=>i!==j&&(a.includes(b)||a.includes([...b].reverse().join('')))))){pool.push(pool.shift());continue;}
  const grid=Array(size*size).fill(''),targets=[];let placed=true;
  for(const word of [...selected].sort((a,b)=>b.length-a.length)){
   let legal=directions.filter(([dr,dc])=>(diagonals||!dr||!dc)&&(backwards||dr>=0&&dc>=0));
   // Each new direction step is present on the board, not merely permitted.
   if(!targets.length&&diagonals)legal=legal.filter(([dr,dc])=>dr&&dc&&(!backwards||dr<0||dc<0));
   else if(!targets.length&&backwards)legal=legal.filter(([dr,dc])=>dr<0||dc<0);
   const candidates=shuffle(Array.from({length:size*size*legal.length},(_,i)=>({first:Math.floor(i/legal.length),direction:legal[i%legal.length]})),random);
   let cells;
   for(const {first,direction:[dr,dc]}of candidates){
    const row=Math.floor(first/size),col=first%size,endRow=row+dr*(word.length-1),endCol=col+dc*(word.length-1);
    if(endRow<0||endRow>=size||endCol<0||endCol>=size)continue;
    const path=Array.from({length:word.length},(_,i)=>first+i*(dr*size+dc));
    if(path.some(n=>grid[n]))continue;
    path.forEach((n,i)=>grid[n]=word[i]);const target={word,cells:path};
    if(safePartial(grid,size,[...targets,target])){cells=path;targets.push(target);break;}
    path.forEach(n=>grid[n]='');
   }
   if(!cells){placed=false;break;}
  }
  if(!placed)continue;
  const decoys=expert?placeDecoys(grid,size,targets,{random,names,excludedNames,packWords,backwards,diagonals}):[];
  if(expert&&!decoys)continue;
  for(const cell of shuffle(grid.flatMap((v,i)=>v?[]:[i]),random)){
   let filled=false;
   for(const letter of shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ',random)){
    grid[cell]=letter;if(safePartial(grid,size,targets)){filled=true;break;}
   }
   if(!filled){placed=false;break;}
  }
  if(!placed)continue;
  // Reject incidental near misses, including ones made by fill letters.
  if(expert&&extraNearMiss(grid,size,targets,decoys))continue;
  // Only reduced deals need generation 3; normal and existing boards keep v2.
  const board={generation:count<requestedCount?3:2,date,size,grid,targets:selected.map(w=>targets.find(t=>t.word===w)),found:[],phase:'play',...(backwards?{backwards:true}:{}),...(diagonals?{diagonals:true}:{}),...(dailyIndex!==undefined?{dailyIndex}:{}),...(expert?{mode:'expert',decoys}:{})};
  if(!boardErrors(board,{excludedNames}).length){
   if(board.targets.some(t=>!targetHasPicture(t.word)))throw Object.assign(Error('Could not open the letter garden. Please try again.'),{status:500,code:'WORD_SEARCH_PICTURE'});
   if(expert&&board.targets.some(t=>!targetHasAudio(t.word)))fail('A picture clue needs its recording.');
   return board;
  }
 }}fail('This word pack needs a grown-up review.');
}
export function searchAct(profile,input,{date,words,player,required=[],nameCycle,names=[],excludedNames=[],targetHasPicture,targetHasAudio,packWords}={}){
 let word=null,changed=false,goalReached=false,hint=null,nearMiss=false;
 if(input.type==='start'||input.type==='next'){
  if(input.type==='next'&&profile.current?.phase!=='finish')fail('Finish this board first.');
  if(input.type==='start'&&profile.current)return {changed:false,word:null};
  const dailyIndex=dailyCount(profile,date);
  const rule=boardRule(profile.completed,dailyIndex),mode=input.mode??profile.mode;
  if(input.mode!==undefined&&!['normal','expert'].includes(input.mode))fail('Choose a garden.');
  if(input.mode==='expert'&&rule.size!==12)fail('Expert gardens use the largest board.');
  const current=makeBoard({...rule,words,required,names,excludedNames,targetHasPicture,targetHasAudio,packWords,...(mode==='expert'&&rule.size===12?{mode:'expert'}:{}),date,dailyIndex,seed:`${player}:${date}:${profile.completed}`});
  profile.current=current;if(input.mode!==undefined)profile.mode=input.mode;if(nameCycle)profile.nameCycle=nameCycle;changed=true;
 }else if(input.type==='select'){
  const b=profile.current;if(!b)fail('Open a board first.');
  if(!Number.isInteger(input.first)||!Number.isInteger(input.last)||input.first<0||input.last<0||input.first>=b.grid.length||input.last>=b.grid.length)fail('Choose letters on the board.');
  const target=b.targets.find(t=>t.cells[0]===input.first&&t.cells.at(-1)===input.last&&!b.found.includes(t.word));
  if(b.mode==='expert'&&b.phase==='play')nearMiss=b.decoys.some(d=>d.cells[0]===input.first&&d.cells.at(-1)===input.last);
  if(target&&b.phase==='play'){
   word=target.word;b.found.push(word);changed=true;
   if(b.found.length===b.targets.length){b.phase='finish';profile.completed++;if(validSearchDate(date)){profile.days||={};profile.days[date]=(profile.days[date]||0)+1;goalReached=dailyCount(profile,date)===5;}}
  }
 }else if(input.type==='hint'){
  const target=profile.current?.targets.find(t=>!profile.current.found.includes(t.word));
  if(target)hint={...(profile.current.mode==='expert'?{}:{word:target.word}),cells:target.cells};
 }else fail('Choose a board action.');
 if(changed)profile.revision++;
 return {changed,word,goalReached,hint,...(nearMiss?{nearMiss:true}:{})};
}
