import {readFile} from 'node:fs/promises';
import {continuationGoal} from './continuation-goals.mjs';
import {Chess} from './public/chess/rules.mjs';
import {STEP_UNITS,STEP_LESSONS} from './public/chess/steps-curriculum.mjs';
import {BRIDGE_UNITS} from './public/chess/bridge-curriculum.mjs';
import {PRACTICE_UNITS} from './public/chess/practice-curriculum.mjs';
// Sparse, original teaching positions. No castling/pawns: square symmetries preserve rules.
const seeds={
 stepsCapture:[
  {pieces:{a1:'K',h8:'k',b2:'R',b6:'n',f5:'b'},line:['b2b6']},
  {pieces:{a1:'K',h8:'k',c2:'B',f5:'r',b6:'n'},line:['c2f5']},
 ],
 stepsCheck:[
  {pieces:{a1:'K',g8:'k',b2:'R',f6:'n'},line:['b2b8']},
  {pieces:{a1:'K',g8:'k',c2:'B',h6:'r'},line:['c2b3']},
 ],
 stepsMate:[
  {pieces:{f6:'K',h8:'k',g6:'Q'},line:['g6g7']},
  {pieces:{c6:'K',a8:'k',b5:'Q'},line:['b5b7']},
 ],
 stepsFork:[
  {pieces:{g1:'K',e8:'k',b5:'N',a8:'r'},line:['b5c7','e8f7','c7a8']},
  {pieces:{g1:'K',h7:'k',g4:'N',e8:'r'},line:['g4f6','h7g7','f6e8']},
 ],
};
function square(s,variant){
 let x=s.charCodeAt(0)-97,y=Number(s[1])-1;
 if(variant&1)x=7-x;if(variant&2)y=7-y;if(variant&4)[x,y]=[y,x];
 return String.fromCharCode(97+x)+(y+1);
}
function position(seed,variant){
 const b=new Chess();b.clear();
 for(const [at,p] of Object.entries(seed.pieces))b.put({type:p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'},square(at,variant));
 return {fen:b.fen(),line:seed.line.map(m=>square(m.slice(0,2),variant)+square(m.slice(2,4),variant))};
}
export const STEPS={},STEP_EXAMPLES={};
for(const u of STEP_UNITS.slice(0,4)){
 const pool=seeds[u.theme].flatMap((seed,i)=>Array.from({length:8},(_,variant)=>{
  const p=position(seed,variant);
  return {...p,id:`small-${u.id}-${i}-${variant}`,theme:u.theme,goal:u.task,terminal:u.theme==='stepsMate',original:true,rating:null};
 }));
 // Interleave seed families so every lesson varies the position, not only its orientation.
 const ordered=Array.from({length:16},(_,i)=>pool[(i%2)*8+Math.floor(i/2)]);
 STEPS[u.theme]=ordered.slice(0,15).map((p,i)=>({...p,line:u.theme==='stepsFork'&&i>=10?p.line:p.line.slice(0,1),goal:u.theme==='stepsFork'&&i>=10?'Win the rook':p.goal}));
 for(const l of STEP_LESSONS.filter(l=>l.unit===STEP_UNITS.indexOf(u))){
  const p=ordered[(l.step*5+15)%16];
  STEP_EXAMPLES[l.id]={...p,line:u.theme==='stepsFork'&&l.step===2?p.line:p.line.slice(0,1)};
 }
}
const continuation=JSON.parse(await readFile(new URL('./chess-continuation.json',import.meta.url),'utf8'));
const sequel=JSON.parse(await readFile(new URL('./chess-sequel.json',import.meta.url),'utf8'));
const bridge=JSON.parse(await readFile(new URL('./chess-bridge.json',import.meta.url),'utf8'));
const practice=JSON.parse(await readFile(new URL('./chess-practice.json',import.meta.url),'utf8'));
for(const u of STEP_UNITS.slice(4,18)){
 const set=continuation.units[u.theme]||sequel.units[u.theme];
 STEPS[u.theme]=set.practice;
 for(const l of STEP_LESSONS.filter(l=>STEP_UNITS[l.unit]===u))STEP_EXAMPLES[l.id]=set.examples[l.step];
}
for(const u of [...PRACTICE_UNITS,...BRIDGE_UNITS]){
 const set=(practice.units[u.theme]||bridge.units[u.theme]);STEPS[u.theme]=set.practice;
 for(const l of STEP_LESSONS.filter(l=>STEP_UNITS[l.unit]===u))STEP_EXAMPLES[l.id]=set.examples[l.step];
}
export function meetsStepGoal(puzzle,b,move){
 if(puzzle.id.startsWith('continuation-'))return continuationGoal(puzzle,b,move,new Chess(puzzle.fen));
 if(puzzle.theme==='stepsMate')return b.isCheckmate();
 if(puzzle.theme==='stepsCapture')return !!move.captured&&!b.isAttacked(move.to,b.turn());
 if(puzzle.theme==='stepsCheck')return b.isCheck()&&!b.isAttacked(move.to,b.turn());
 if(puzzle.theme==='stepsFork')return b.board().flat().filter(p=>p&&p.color!==move.color&&['k','q','r'].includes(p.type)&&b.attackers(p.square,move.color).includes(move.to)).length>=2;
 return false;
}

// Preserve every saved FEN/ID. The final checking lesson adds explanation, not a reset.
for (const puzzle of STEPS.stepsCheck.slice(10)) {
 puzzle.safeCheckLesson = true;
 puzzle.goal = 'Check safely';
}
const checkExample = STEP_EXAMPLES['steps-check-3'];
checkExample.contrast = { line: ['b3g8', 'f8g8'] };

// Show an actual legal capture, not merely a geometrical attack (pins can differ).
export function checkingPieceCapture(board, move) {
 if (!board.isCheck()) return null;
 const replies = board.moves({verbose:true}).filter(reply=>reply.to===move.to && reply.captured);
 return replies.find(reply=>reply.piece!=='k') || replies[0] || null;
}
