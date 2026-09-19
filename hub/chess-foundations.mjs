import {Chess} from './public/chess/rules.mjs';
import {FOUNDATION_UNITS,FOUNDATION_LESSONS} from './public/chess/foundations-curriculum.mjs';
const seeds={
 learnRook:[{p:{a1:'K',h8:'k',c3:'R',g7:'p'},m:'c3f3'},{p:{a1:'K',h8:'k',b2:'R',g7:'p'},m:'b2b5'}],
 learnBishop:[{p:{a1:'K',h8:'k',c2:'B',g7:'p'},m:'c2f5'},{p:{a1:'K',h8:'k',f2:'B',g7:'p'},m:'f2c5'}],
 learnKnight:[{p:{a1:'K',h8:'k',d3:'N',g7:'p'},m:'d3e5'},{p:{a1:'K',h8:'k',f3:'N',g7:'p'},m:'f3d4'}],
 learnCapture:[{p:{a1:'K',h8:'k',b2:'R',b5:'n'},m:'b2b5'},{p:{a1:'K',h8:'k',c2:'B',f5:'r'},m:'c2f5'}],
 learnCheck:[{p:{a1:'K',h8:'k',b2:'R'},m:'b2b8'},{p:{a1:'K',g8:'k',c2:'B',h6:'n'},m:'c2b3'}],
 learnFork:[{p:{g1:'K',e8:'k',b5:'N',a8:'r'},m:'b5c7'},{p:{g1:'K',h7:'k',g4:'N',e8:'r'},m:'g4f6'}],
};
function square(s,v){let x=s.charCodeAt(0)-97,y=+s[1]-1;if(v&1)x=7-x;if(v&2)y=7-y;if(v&4)[x,y]=[y,x];return 'abcdefgh'[x]+(y+1);}
export const FOUNDATIONS={},FOUNDATION_EXAMPLES={};
for(const u of FOUNDATION_UNITS){
 const pool=Array.from({length:16},(_,i)=>{const seed=seeds[u.theme][i%2],v=Math.floor(i/2),b=new Chess();b.clear();
 // Non-moving decoration uses knights: square symmetries must not reverse pawn rules.
 for(const [s,p] of Object.entries(seed.p))b.put({type:p.toLowerCase()==='p'?'n':p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'},square(s,v));
 const move=square(seed.m.slice(0,2),v)+square(seed.m.slice(2),v);
 return {id:`foundation-${u.id}-${i}`,theme:u.theme,fen:b.fen(),line:[move],goal:u.task,original:true,rating:null,...(['learnRook','learnBishop','learnKnight'].includes(u.theme)?{target:move.slice(2),piece:{learnRook:'r',learnBishop:'b',learnKnight:'n'}[u.theme]}:{})};});
 FOUNDATIONS[u.theme]=pool.slice(0,15);
 for(const l of FOUNDATION_LESSONS.filter(l=>FOUNDATION_UNITS[l.unit]===u))FOUNDATION_EXAMPLES[l.id]=pool[(l.step*5+15)%16];
}
export function foundationGoal(p,b,m){
 if(p.target)return m.piece===p.piece&&m.to===p.target;
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
};
export const FOUNDATION_PRACTICE={};
for(const u of FOUNDATION_UNITS){
 const lessons=FOUNDATION_LESSONS.filter(l=>FOUNDATION_UNITS[l.unit]===u);
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
 return s.ids[0]?.includes('-choice-') ? FOUNDATION_EXAMPLES[s.lesson]||null : legacyExamples[s.lesson]||null;
}
