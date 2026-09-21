import {Chess} from './public/chess/rules.mjs';
import {FOUNDATION_UNITS,FOUNDATION_LESSONS} from './public/chess/foundations-curriculum.mjs';
const seeds={
 learnRook:[{p:{a1:'K',h8:'k',c3:'R',g7:'p'},m:'c3f3'},{p:{a1:'K',h8:'k',b2:'R',g7:'p'},m:'b2b5'}],
 learnBishop:[{p:{a1:'K',h8:'k',c2:'B',g7:'p'},m:'c2f5'},{p:{a1:'K',h8:'k',f2:'B',g7:'p'},m:'f2c5'}],
 learnKnight:[{p:{a1:'K',h8:'k',d3:'N',g7:'p'},m:'d3e5'},{p:{a1:'K',h8:'k',f3:'N',g7:'p'},m:'f3d4'}],
 learnQueen:[{p:{a1:'K',h8:'k',c3:'Q',g7:'p'},m:'c3f6'},{p:{a1:'K',h8:'k',b2:'Q',g7:'p'},m:'b2b5'}],
 learnCapture:[{p:{a1:'K',h8:'k',b2:'R',b5:'n'},m:'b2b5'},{p:{a1:'K',h8:'k',c2:'B',f5:'r'},m:'c2f5'}],
 learnCheck:[{p:{a1:'K',h8:'k',b2:'R'},m:'b2b8'},{p:{a1:'K',g8:'k',c2:'B',h6:'n'},m:'c2b3'}],
 learnFork:[{p:{g1:'K',e8:'k',b5:'N',a8:'r'},m:'b5c7'},{p:{g1:'K',h7:'k',g4:'N',e8:'r'},m:'g4f6'}],
};
function square(s,v){let x=s.charCodeAt(0)-97,y=+s[1]-1;if(v&1)x=7-x;if(v&2)y=7-y;if(v&4)[x,y]=[y,x];return 'abcdefgh'[x]+(y+1);}
export const FOUNDATIONS={},FOUNDATION_EXAMPLES={};
for(const u of FOUNDATION_UNITS){
 if(!seeds[u.theme])continue;
 const pool=Array.from({length:16},(_,i)=>{const seed=seeds[u.theme][i%2],v=Math.floor(i/2),b=new Chess();b.clear();
 // Non-moving decoration uses knights: square symmetries must not reverse pawn rules.
 for(const [s,p] of Object.entries(seed.p))b.put({type:p.toLowerCase()==='p'?'n':p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'},square(s,v));
 const move=square(seed.m.slice(0,2),v)+square(seed.m.slice(2),v);
 return {id:`foundation-${u.id}-${i}`,theme:u.theme,fen:b.fen(),line:[move],goal:u.task,original:true,rating:null,...(['learnRook','learnBishop','learnKnight','learnQueen'].includes(u.theme)?{target:move.slice(2),piece:{learnRook:'r',learnBishop:'b',learnKnight:'n',learnQueen:'q'}[u.theme]}:{})};});
 FOUNDATIONS[u.theme]=pool.slice(0,15);
 for(const l of FOUNDATION_LESSONS.filter(l=>FOUNDATION_UNITS[l.unit]===u))FOUNDATION_EXAMPLES[l.id]=pool[(l.step*5+15)%16];
}
export function foundationGoal(p,b,m){
 if(p.target)return m.piece===p.piece&&m.to===p.target;
 if(p.goalType==='pawnCapture')return m.piece==='p'&&!!m.captured;
 if(p.goalType==='kingCapture')return m.piece==='k'&&!!m.captured;
 if(p.goalType==='kingEscape')return m.piece==='k'&&!b.isCheck();
 if(p.goalType==='savePiece')return m.from===p.from&&!b.isAttacked(m.to,b.turn());
 if(p.goalType==='escapeCheck')return !b.isCheck();
 if(p.goalType==='mate')return b.isCheckmate();
 if(p.theme==='learnCapture')return !!m.captured&&!b.isAttacked(m.to,b.turn());
 if(p.theme==='learnCheck')return b.isCheck()&&!b.isAttacked(m.to,b.turn());
 if(p.theme==='learnFork')return m.piece==='n'&&b.board().flat().filter(x=>x&&x.color!==m.color&&['k','r'].includes(x.type)&&b.attackers(x.square,m.color).includes(m.to)).length===2;
 return false;
}


const legacyExamples={...FOUNDATION_EXAMPLES};

// Keep every original ID/FEN available for saved sessions and review. New starts
// use a short movement introduction followed by unmarked capture choices.
const choiceSeeds={
 learnRook:[
  [{b2:'R',g3:'R',b5:'n'},'b2b5'],[{f2:'R',b4:'R',f6:'n'},'f2f6'],[{c3:'R',e2:'R',a3:'n'},'c3a3'],
  [{d2:'R',a4:'R',d6:'b',h5:'n'},'d2d6'],[{g3:'R',b2:'R',g6:'n',e7:'b'},'g3g6'],[{c6:'R',f2:'R',c3:'n',h4:'b'},'c6c3'],
  [{d3:'R',g2:'R',d6:'n'},'d3d6'],[{b4:'R',f2:'R',b7:'n',g6:'b'},'b4b7'],
 ],
 learnBishop:[
  [{c2:'B',a3:'R',f5:'n'},'c2f5'],[{f2:'B',b3:'R',c5:'n'},'f2c5'],[{d2:'B',a4:'R',g5:'n'},'d2g5'],
  [{b2:'B',d3:'R',f6:'n',h5:'b'},'b2f6'],[{g2:'B',c3:'R',d5:'n',a6:'n'},'g2d5'],[{c4:'B',b2:'R',f7:'n',a5:'n'},'c4f7'],
  [{d3:'B',a4:'R',g6:'n'},'d3g6'],[{e2:'B',a4:'R',b5:'n',h6:'n'},'e2b5'],
 ],
 learnKnight:[
  [{d3:'N',a2:'R',e5:'n'},'d3e5'],[{f3:'N',a2:'B',d4:'n'},'f3d4'],[{c3:'N',f2:'R',e4:'n'},'c3e4'],
  [{e3:'N',a2:'B',f5:'n',h6:'b'},'e3f5'],[{g4:'N',c2:'R',e5:'n',a6:'b'},'g4e5'],[{d4:'N',b2:'B',f5:'n',h6:'b'},'d4f5'],
  [{e4:'N',b2:'R',f6:'n'},'e4f6'],[{c4:'N',f2:'R',e5:'n',h6:'b'},'c4e5'],
 ],
 learnQueen:[
  [{c2:'Q',a3:'R',f5:'n'},'c2f5'],[{f2:'Q',b3:'B',f6:'n'},'f2f6'],[{d2:'Q',a4:'R',g5:'n'},'d2g5'],
  [{c2:'Q',d3:'B',c6:'n',h5:'b'},'c2c6'],[{g2:'Q',c3:'R',d5:'n',a6:'n'},'g2d5'],[{c4:'Q',b2:'R',f7:'n',a5:'n'},'c4f7'],
  [{d3:'Q',a4:'R',g6:'n'},'d3g6'],[{e2:'Q',a4:'B',e6:'n',h6:'n'},'e2e6'],
 ],
};
const captureDecisionSeeds=[
 ['7k/3N4/5N2/1r1b4/6r1/8/8/K7 w - - 0 1','f6g4'],
 ['7k/8/2rRn3/8/8/8/2B1r3/K7 w - - 0 1','d6c6'],
 ['7k/3b4/4b3/8/3R4/8/1B1r4/K7 w - - 0 1','d4d2'],
 ['7k/6r1/4r3/8/8/2B5/1R3b2/K7 w - - 0 1','b2f2'],
 ['7k/5n2/5R2/3b4/1N2r3/8/8/K7 w - - 0 1','b4d5'],
 ['7k/8/3b4/8/3n4/1bR1B3/8/K7 w - - 0 1','e3d4'],
 ['7k/3r4/8/6n1/3N2R1/5b2/8/K7 w - - 0 1','g4g5'],
 ['7k/8/3R4/3n4/8/6n1/3rN3/K7 w - - 0 1','e2g3'],
 ['7k/1R6/3b4/1b6/1n6/1R6/8/K7 w - - 0 1','b7b5'],
 ['7k/4N1r1/8/4Br2/8/8/3b4/K7 w - - 0 1','e7f5'],
 ['7k/4B3/3n4/8/3r4/2B5/4b3/K7 w - - 0 1','c3d4'],
 ['7k/5b2/8/6n1/5B2/3R1b2/8/K7 w - - 0 1','f4g5'],
];
function authored(theme,rows){
 return rows.map((row,i)=>{
  let fen=row.fen;
  if(!fen){const b=new Chess();b.clear();for(const [square,piece] of Object.entries(row.pieces))b.put({type:piece.toLowerCase(),color:piece===piece.toUpperCase()?'w':'b'},square);fen=b.fen();}
  return {id:`foundation-${theme}-${i}`,theme,fen,line:[row.move],goal:row.goal||FOUNDATION_UNITS.find(u=>u.theme===theme)?.task||'',original:true,rating:null,
   goalType:row.goalType,target:row.target,piece:row.piece,from:row.from,startInCheck:!!row.startInCheck,concealLegalMoves:row.concealLegalMoves??!row.target};
 });
}
const extensionPools={
 learnPawn:authored('learnPawn',[
  {pieces:{a1:'K',h8:'k',b2:'P'},move:'b2b3',target:'b3',piece:'p'},
  {pieces:{a1:'K',h8:'k',d3:'P'},move:'d3d4',target:'d4',piece:'p'},
  {pieces:{a1:'K',h8:'k',f4:'P'},move:'f4f5',target:'f5',piece:'p'},
  {pieces:{a1:'K',h8:'k',b3:'P',c4:'n'},move:'b3c4',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',d3:'P',c4:'n'},move:'d3c4',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',f4:'P',e5:'n'},move:'f4e5',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',b3:'P',f3:'P',c4:'n'},move:'b3c4',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',c4:'P',g3:'P',d5:'n'},move:'c4d5',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',e3:'P',b4:'P',f4:'n'},move:'e3f4',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',c2:'P'},move:'c2c3',target:'c3',piece:'p'},
  {pieces:{a1:'K',h8:'k',g3:'P',f4:'n'},move:'g3f4',goalType:'pawnCapture'},
  {pieces:{a1:'K',h8:'k',d4:'P',g2:'P',c5:'n'},move:'d4c5',goalType:'pawnCapture'},
 ]),
 learnKing:authored('learnKing',[
  {pieces:{b2:'K',h8:'k'},move:'b2c2',target:'c2',piece:'k'},
  {pieces:{c3:'K',h8:'k'},move:'c3d4',target:'d4',piece:'k'},
  {pieces:{f2:'K',a8:'k'},move:'f2e3',target:'e3',piece:'k'},
  {pieces:{b2:'K',h8:'k',c3:'n'},move:'b2c3',goalType:'kingCapture'},
  {pieces:{d3:'K',h8:'k',e4:'b'},move:'d3e4',goalType:'kingCapture',startInCheck:true},
  {pieces:{f3:'K',a8:'k',e4:'r'},move:'f3e4',goalType:'kingCapture'},
  {pieces:{b2:'K',h8:'k',b7:'r'},move:'b2a3',goalType:'kingEscape',startInCheck:true},
  {pieces:{d3:'K',h8:'k',g6:'b'},move:'d3c3',goalType:'kingEscape',startInCheck:true},
  {pieces:{f2:'K',a8:'k',f8:'r'},move:'f2e3',goalType:'kingEscape',startInCheck:true},
  {pieces:{e3:'K',a8:'k'},move:'e3f4',target:'f4',piece:'k'},
  {pieces:{g2:'K',a8:'k',f3:'n'},move:'g2f3',goalType:'kingCapture'},
  {pieces:{c2:'K',h8:'k',c7:'r'},move:'c2d3',goalType:'kingEscape',startInCheck:true},
 ]),
 learnSave:authored('learnSave',[
  {pieces:{a2:'K',h8:'k',c3:'R',f6:'b'},move:'c3c6',goalType:'savePiece',from:'c3'},
  {pieces:{a1:'K',h8:'k',f3:'R',c6:'b'},move:'f3f6',goalType:'savePiece',from:'f3'},
  {pieces:{a1:'K',h8:'k',c2:'B',c7:'r'},move:'c2f5',goalType:'savePiece',from:'c2'},
  {pieces:{a1:'K',h8:'k',f2:'B',f7:'r'},move:'f2c5',goalType:'savePiece',from:'f2'},
  {pieces:{a1:'K',h8:'k',d3:'N',g6:'b'},move:'d3f4',goalType:'savePiece',from:'d3'},
  {pieces:{a1:'K',h8:'k',e3:'N',b6:'b'},move:'e3c4',goalType:'savePiece',from:'e3'},
  {pieces:{a1:'K',h8:'k',b4:'R',b7:'r'},move:'b4e4',goalType:'savePiece',from:'b4'},
  {pieces:{a1:'K',h8:'k',g4:'R',g7:'r'},move:'g4d4',goalType:'savePiece',from:'g4'},
  {pieces:{a2:'K',h8:'k',c3:'B',f6:'b'},move:'c3b4',goalType:'savePiece',from:'c3'},
  {pieces:{a1:'K',h8:'k',d4:'N',f5:'n'},move:'d4b5',goalType:'savePiece',from:'d4'},
  {pieces:{a1:'K',h8:'k',e4:'N',c5:'n'},move:'e4g5',goalType:'savePiece',from:'e4'},
  {pieces:{a1:'K',h8:'k',b3:'R',e6:'b'},move:'b3b6',goalType:'savePiece',from:'b3'},
 ]),
 learnEscape:authored('learnEscape',[
  {pieces:{b2:'K',h8:'k',b7:'r'},move:'b2a3',goalType:'escapeCheck',startInCheck:true},
  {pieces:{g2:'K',a8:'k',g7:'r'},move:'g2h3',goalType:'escapeCheck',startInCheck:true},
  {pieces:{d3:'K',h8:'k',g6:'b'},move:'d3c3',goalType:'escapeCheck',startInCheck:true},
  {pieces:{a1:'K',h8:'k',c4:'R',a4:'r'},move:'c4a4',goalType:'escapeCheck',startInCheck:true},
  {pieces:{a1:'K',h8:'k',f5:'N',d4:'b'},move:'f5d4',goalType:'escapeCheck',startInCheck:true},
  {pieces:{g1:'K',a8:'k',d3:'B',g6:'r'},move:'d3g6',goalType:'escapeCheck',startInCheck:true},
  {pieces:{a1:'K',h8:'k',c2:'R',a8:'r'},move:'c2a2',goalType:'escapeCheck',startInCheck:true},
  {pieces:{h1:'K',b8:'k',f3:'B',h8:'r'},move:'f3h5',goalType:'escapeCheck',startInCheck:true},
  {pieces:{a1:'K',g8:'k',c2:'R',h8:'b'},move:'c2c3',goalType:'escapeCheck',startInCheck:true},
  {pieces:{e3:'K',a8:'k',b6:'b'},move:'e3f3',goalType:'escapeCheck',startInCheck:true},
  {pieces:{a1:'K',h8:'k',c4:'B',a2:'r'},move:'c4a2',goalType:'escapeCheck',startInCheck:true},
  {pieces:{h1:'K',a8:'k',f2:'R',h8:'r'},move:'f2h2',goalType:'escapeCheck',startInCheck:true},
 ]),
 learnMate:authored('learnMate',[
  {fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',move:'g6g7',goalType:'mate'},
  {fen:'k7/8/2K5/1Q6/8/8/8/8 w - - 0 1',move:'b5b7',goalType:'mate'},
  {fen:'k7/8/1QK5/8/8/8/8/8 w - - 0 1',move:'b6b7',goalType:'mate'},
  {fen:'7k/8/5K2/6Q1/8/8/8/8 w - - 0 1',move:'g5g7',goalType:'mate'},
  {fen:'8/8/8/8/8/5KQ1/8/7k w - - 0 1',move:'g3g2',goalType:'mate'},
  {fen:'8/8/8/8/1Q6/2K5/8/k7 w - - 0 1',move:'b4b2',goalType:'mate'},
  {fen:'8/8/8/8/8/1QK5/8/k7 w - - 0 1',move:'b3b2',goalType:'mate'},
  {fen:'8/8/8/8/6Q1/5K2/8/7k w - - 0 1',move:'g4g2',goalType:'mate'},
  {fen:'7k/5Q2/5K2/8/8/8/8/8 w - - 0 1',move:'f7g7',goalType:'mate'},
  {fen:'8/8/8/8/8/5K2/4Q3/7k w - - 0 1',move:'e2g2',goalType:'mate'},
  {fen:'8/8/8/8/8/5K2/5Q2/7k w - - 0 1',move:'f2g2',goalType:'mate'},
  {fen:'7k/4Q3/5K2/8/8/8/8/8 w - - 0 1',move:'e7g7',goalType:'mate'},
 ]),
};
export const FOUNDATION_PRACTICE={};
for(const u of FOUNDATION_UNITS){
 const lessons=FOUNDATION_LESSONS.filter(l=>FOUNDATION_UNITS[l.unit]===u);
 if(extensionPools[u.theme]){
  const pool=extensionPools[u.theme];FOUNDATIONS[u.theme]=pool.slice(0,9);
  for(const l of lessons){FOUNDATION_PRACTICE[l.id]=pool.slice(l.step*3,l.step*3+3).map(p=>p.id);FOUNDATION_EXAMPLES[l.id]=pool[9+l.step];}
  continue;
 }
 if(u.theme==='learnCapture'){
  const decisions=captureDecisionSeeds.map(([fen,move],i)=>({id:`foundation-learn-capture-choice-${i}`,theme:'learnCapture',fen,line:[move],goal:'Take safely',original:true,rating:null}));
  FOUNDATIONS.learnCaptureChoices=decisions;
  for(const l of lessons){FOUNDATION_PRACTICE[l.id]=decisions.slice(l.step*3,l.step*3+3).map(p=>p.id);FOUNDATION_EXAMPLES[l.id]=decisions[9+l.step];}
  continue;
 }
 if(!choiceSeeds[u.theme]){for(const l of lessons)FOUNDATION_PRACTICE[l.id]=FOUNDATIONS[u.theme].slice(l.step*5,l.step*5+5).map(p=>p.id);continue;}
 const choices=choiceSeeds[u.theme].map(([pieces,move],i)=>{
  const b=new Chess();b.clear();for(const [square,piece] of Object.entries({a1:'K',h8:'k',...pieces}))b.put({type:piece.toLowerCase(),color:piece===piece.toUpperCase()?'w':'b'},square);
  return {id:`foundation-${u.id}-choice-${i}`,theme:'learnCapture',fen:b.fen(),line:[move],goal:'Take a piece',original:true,rating:null};
 });
 FOUNDATIONS[u.theme+'Choices']=choices.slice(0,6);
 FOUNDATION_PRACTICE[lessons[0].id]=FOUNDATIONS[u.theme].slice(0,3).map(p=>p.id);
 for(const l of lessons.slice(1)){
  FOUNDATION_PRACTICE[l.id]=choices.slice((l.step-1)*3,l.step*3).map(p=>p.id);
  FOUNDATION_EXAMPLES[l.id]=choices[l.step+5];
 }
}
export function foundationSessionTotal(s){
 if(s.phase==='summary')return s.results.length||s.ids.length;
 // Existing five-board movement sessions finish after their third board, without
 // erasing results or changing the board already on screen (even a fourth/fifth).
 if(s.band==='foundations'&&FOUNDATION_PRACTICE[s.lesson]?.length===3)
  return Math.min(s.ids.length,Math.max(3,s.index+1));
 return s.ids.length;
}

export function foundationExample(s){
 return s.ids[0]?.includes('-choice-') ? FOUNDATION_EXAMPLES[s.lesson]||null : legacyExamples[s.lesson]||FOUNDATION_EXAMPLES[s.lesson]||null;
}
