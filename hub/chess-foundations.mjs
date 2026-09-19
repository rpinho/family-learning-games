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
