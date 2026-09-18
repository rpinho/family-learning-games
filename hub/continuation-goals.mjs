import {Chess} from './public/chess/rules.mjs';
export const value={p:1,n:3,b:3,r:5,q:9,k:0};
export const uci=m=>m.from+m.to+(m.promotion||'');
export const play=(b,u)=>b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
export const canBeTaken=(b,square)=>b.moves({verbose:true}).some(m=>m.to===square&&m.captured);
export function continuationGoal(p,b,m,before){
 if(p.theme==='stepsValue')return !!m.captured && value[m.captured]-(canBeTaken(b,m.to)?value[m.piece]:0)>0;
 if(p.theme==='stepsRescue')return m.piece===p.rescueType && before.isAttacked(m.from,b.turn())&&!b.isAttacked(m.to,b.turn());
 if(p.theme==='stepsPin')return !!m.captured&&before.isAttacked(m.to,b.turn())&&!canBeTaken(b,m.to)&&!b.isCheckmate();
 const type={stepsRookFork:'r',stepsBishopFork:'b',stepsQueenFork:'q'}[p.theme];
 if(p.theme==='stepsRookFork')return m.piece==='r'&&!b.isAttacked(m.to,b.turn())&&b.board().flat().filter(x=>x&&x.color!==m.color&&['n','b'].includes(x.type)&&!b.isAttacked(x.square,x.color)&&b.attackers(x.square,m.color).includes(m.to)).length>=2;
 if(type)return m.piece===type&&b.isCheck()&&!b.isAttacked(m.to,b.turn())&&b.board().flat().some(x=>x&&x.color!==m.color&&['r','q'].includes(x.type)&&b.attackers(x.square,m.color).includes(m.to));
 return false;
}
// Exhaustive three-ply proof, used by the offline authoring script and tests.
// Every legal reply must allow the stated finish; no cooperative opponent lines.
export function forcingLines(fen,theme){
 const b=new Chess(fen),lines={};
 const first=b.moves({verbose:true}).filter(m=>m.san.includes('+'));
 for(const m of first){
  b.move(m);const replies=b.moves({verbose:true});let works=!!replies.length;const branches=[];
  for(const reply of replies){
   b.move(reply);const finishes=[];
   for(const end of b.moves({verbose:true})){
    if(theme==='stepsSkewer'&&end.captured!=='r')continue;
    b.move(end);
    if(theme==='stepsMateTwo'?b.isCheckmate():!canBeTaken(b,end.to))finishes.push(uci(end));
    b.undo();
   }
   b.undo();if(!finishes.length){works=false;break;}
   branches.push({reply:uci(reply),finishes});
  }
  b.undo();
  if(works){
   // Prefer the reply with the fewest winning finishes, rather than an easy gift.
   branches.sort((a,b)=>a.finishes.length-b.finishes.length||a.reply.localeCompare(b.reply));
   lines[uci(m)]=branches[0];
  }
 }
 return lines;
}
