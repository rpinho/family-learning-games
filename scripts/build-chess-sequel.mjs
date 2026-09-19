// Offline, deterministic original positions. Prior releases are read-only.
import {readFile,writeFile} from 'node:fs/promises';
import {Chess} from '../hub/public/chess/rules.mjs';
import {SEQUEL_UNITS} from '../hub/public/chess/sequel-curriculum.mjs';
import {continuationGoal,forcingLines,uci} from '../hub/continuation-goals.mjs';
let state=9192026;const random=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/4294967296*n);};
const sq=()=> 'abcdefgh'[random(8)]+(random(8)+1),pick=a=>a[random(a.length)];
const seen=new Set(Object.values(JSON.parse(await readFile(new URL('../hub/chess-continuation.json',import.meta.url))).units).flatMap(u=>[...u.practice,...u.examples]).map(p=>p.fen));
const output={version:1,units:{}};
function candidate(theme,i){
 if(['stepsDiscovered','stepsDoubleCheck'].includes(theme)){
  const f=pick(['b','c','d','e','f','g']),rank=pick([3,4,5,6]);return {[pick(['a1','h1'])]:'K',[f+pick([7,8])]:'k',[f+pick([1,2])]:'R',[f+rank]:'B',...(i>=5?{h6:'n'}:{}),...(i>=10?{b6:'r'}:{})};
 }
 if(theme==='stepsMateNet'){
  const king=pick(['a8','b8','g8','h8','a7','h7','a2','h2','a1','b1','g1','h1']);let k;do{k=sq();}while(Math.max(Math.abs(k.charCodeAt(0)-king.charCodeAt(0)),Math.abs(+k[1]- +king[1]))!==2);
  const p={[king]:'k',[k]:'K'};for(const t of ['Q',i<10?'n':'b']){let s;do{s=sq();}while(p[s]);p[s]=t;}return p;
 }
 const p={},type={stepsKnightWin:'N',stepsBishopWin:'B',stepsQueenWin:'Q'}[theme];
 for(const t of ['K','k',type,'r',...(i>=5?['n']:[]),...(i>=10?['b']:[])]){let s;do{s=sq();}while(p[s]);p[s]=t;}return p;
}
for(const u of SEQUEL_UNITS){const all=[];let n=0;
 while(all.length<18){if(++n>300000)throw Error(u.theme+' insufficient '+all.length);const b=new Chess();b.clear();for(const [s,p] of Object.entries(candidate(u.theme,all.length)))b.put({type:p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'},s);
 const fen=b.fen(),king=b.board().flat().find(x=>x?.type==='k'&&x.color==='b');if(!king||b.isCheck()||b.isAttacked(king.square,'w')||b.isGameOver()||seen.has(fen))continue;
 const p={id:`continuation-${u.id}-${all.length+1}`,theme:u.theme,fen,goal:u.task,original:true,rating:null,terminal:u.theme==='stepsMateNet'};
 if(['stepsDiscovered','stepsDoubleCheck'].includes(u.theme)){
  const good=[];for(const m of b.moves({verbose:true})){const after=new Chess(fen),move=after.move(m);if(continuationGoal(p,after,move,b))good.push(uci(move));}if(!good.length)continue;p.line=[good[0]];
 }else{if(b.moves({verbose:true}).some(m=>m.san.includes('#')))continue;p.nextLines=forcingLines(fen,u.theme);const first=Object.keys(p.nextLines)[0];if(!first)continue;const branch=p.nextLines[first];p.line=[first,branch.reply,branch.finishes[0]];p.followup=p.terminal?'Find checkmate':'Take the rook';}
 seen.add(fen);all.push(p);
 }
 output.units[u.theme]={practice:all.slice(0,15),examples:all.slice(15)};console.log(u.theme,all.length,n);
}
await writeFile(new URL('../hub/chess-sequel.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
