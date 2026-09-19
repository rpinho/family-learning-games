// Reproducible original drill authoring. Run offline; never touches player saves.
import {writeFile} from 'node:fs/promises';
import {Chess} from '../hub/public/chess/rules.mjs';
import {STEP_UNITS} from '../hub/public/chess/steps-curriculum.mjs';
import {continuationGoal,forcingLines,uci,play} from '../hub/continuation-goals.mjs';
let rng=9182026;
function random(n){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return Math.floor(rng/4294967296*n);}
const squares=Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(1+Math.floor(i/8)));
const sq=()=>squares[random(64)];
const pick=a=>a[random(a.length)];
function fen(pieces){const b=new Chess();b.clear();for(const [s,p]of Object.entries(pieces))b.put({type:p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'},s);return b.fen();}
function valid(b){const k=b.board().flat().filter(x=>x?.type==='k');return k.length===2&&!b.isCheck()&&!b.isAttacked(k.find(x=>x.color==='b').square,'w')&&!b.isGameOver();}
function randomBoard(types){const p={};for(const t of types){let s;do{s=sq();}while(p[s]);p[s]=t;}return p;}
function distance(a,b){return Math.max(Math.abs(a.charCodeAt(0)-b.charCodeAt(0)),Math.abs(+a[1]- +b[1]));}
function candidate(theme,index){
 if(theme==='stepsPin'){
  const file=pick([3,4,5]),rank=pick([4,5,6]),dir=pick([-1,1]);
  const at=(f,r)=>'abcdefgh'[f]+r;
  const p={[at(file,8)]:'k',[at(file,rank)]:'r',[at(file+dir,rank)]:'n',[at(file+2*dir,rank-1)]:'B',[at(file,1)]:'R',a1:'K'};
  if(index>=5){let s;do{s=sq();}while(p[s]);p[s]=index>=10?'b':'n';}return p;
 }
 if(theme==='stepsSkewer'){
  const file=pick([2,3,4,5]),r=pick([4,5]),p={['abcdefgh'[file]+'8']:'r',['abcdefgh'[file]+r]:'k',a1:'K'};
  let s;do{s=sq();}while(p[s]);p[s]='R';
  if(index>=5){do{s=sq();}while(p[s]);p[s]=index>=10?'b':'n';}return p;
 }
 if(theme==='stepsMateTwo'){
  const king=pick(['a8','b8','g8','h8','a7','h7','a2','h2','a1','b1','g1','h1']);
  let wk;do{wk=sq();}while(distance(wk,king)<2||distance(wk,king)>3);
  const p={[king]:'k',[wk]:'K'};let s;do{s=sq();}while(p[s]);p[s]='Q';
  if(index>=10){do{s=sq();}while(p[s]);p[s]='n';}return p;
 }
 if(theme==='stepsRookFork')return randomBoard(index<5?['K','k','R','b','n']:index<10?['K','k','R','b','n','n']:['K','k','R','b','n','b']);
 if(theme==='stepsValue')return randomBoard(index<5?['K','k','B','r','n']:index<10?['K','k','N','q','b','r']:['K','k','R','q','b','n']);
 if(theme==='stepsRescue')return randomBoard(index<5?['K','k','Q','r']:index<10?['K','k','R','b','n']:['K','k','Q','r','b','n']);
 const piece={stepsRookFork:'R',stepsBishopFork:'B',stepsQueenFork:'Q'}[theme];
 return randomBoard(index<5?['K','k',piece,'r']:index<10?['K','k',piece,'r','n']:['K','k',piece,'r','b','n']);
}
const output={version:1,units:{}};const seen=new Set();
for(const unit of STEP_UNITS.slice(4,12)){
 const boards=[];let attempts=0;
 while(boards.length<18){
  if(++attempts>250000)throw Error('No sufficient boards: '+unit.theme+' '+boards.length);
  const pieces=candidate(unit.theme,boards.length),start=fen(pieces),b=new Chess(start);
  if(seen.has(start)||!valid(b))continue;
  const puzzle={id:`continuation-${unit.id}-${boards.length+1}`,theme:unit.theme,fen:start,goal:unit.task,original:true,rating:null,terminal:unit.theme==='stepsMateTwo'};
  if(unit.theme==='stepsRescue')puzzle.rescueType=Object.values(pieces).includes('Q')?'q':'r';
  if(unit.theme==='stepsSkewer'||unit.theme==='stepsMateTwo'){
   if(b.moves({verbose:true}).some(m=>m.san.includes('#')))continue;
   puzzle.nextLines=forcingLines(start,unit.theme);const first=Object.keys(puzzle.nextLines)[0];if(!first)continue;
   const branch=puzzle.nextLines[first];puzzle.line=[first,branch.reply,branch.finishes[0]];
   puzzle.followup=unit.theme==='stepsMateTwo'?'Find checkmate':'Take the rook';
  }else{
   const moves=b.moves({verbose:true}),good=[];let badCaptures=0;
   for(const m of moves.filter(m=>unit.theme==='stepsRookFork'?m.piece==='r':unit.theme.includes('Fork')?m.san.includes('+'):['stepsValue','stepsPin'].includes(unit.theme)?!!m.captured:m.piece===puzzle.rescueType&&b.isAttacked(m.from,'b'))){const after=new Chess(start);const played=after.move(m);
    if(continuationGoal({...puzzle,requireLoosePair:true},after,played,b))good.push(uci(m));else if(m.captured)badCaptures++;
   }
   if(!good.length||unit.theme==='stepsValue'&&!badCaptures||unit.theme!=='stepsRescue'&&good.length>4)continue;
   puzzle.line=[good[0]];
  }
  seen.add(start);boards.push(puzzle);
 }
 output.units[unit.theme]={practice:boards.slice(0,15),examples:boards.slice(15)};
 console.log(unit.theme,boards.length,'boards',attempts,'candidates');
}
await writeFile(new URL('../hub/chess-continuation.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
