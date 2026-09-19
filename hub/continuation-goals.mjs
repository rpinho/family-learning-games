import {Chess} from './public/chess/rules.mjs';
export const value={p:1,n:3,b:3,r:5,q:9,k:0};
export const uci=m=>m.from+m.to+(m.promotion||'');
export const play=(b,u)=>b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
export const canBeTaken=(b,square)=>b.moves({verbose:true}).some(m=>m.to===square&&m.captured);
export function continuationGoal(p,b,m,before){
 if(p.theme==='stepsDiscovered'||p.theme==='stepsDoubleCheck'){const king=b.board().flat().find(x=>x?.type==='k'&&x.color!==m.color),attackers=b.attackers(king.square,m.color);return p.theme==='stepsDoubleCheck'?attackers.length>=2:attackers.some(s=>s!==m.to)&&!b.isAttacked(m.to,b.turn());}
 if(p.theme==='stepsValue')return !!m.captured && value[m.captured]-(canBeTaken(b,m.to)?value[m.piece]:0)>0;
 if(p.theme==='stepsRescue')return m.piece===p.rescueType && before.isAttacked(m.from,b.turn())&&!b.isAttacked(m.to,b.turn());
 if(p.theme==='stepsPin')return !!m.captured&&before.isAttacked(m.to,b.turn())&&!canBeTaken(b,m.to)&&!b.isCheckmate();
 const type={stepsRookFork:'r',stepsBishopFork:'b',stepsQueenFork:'q'}[p.theme];
 if(p.theme==='stepsRookFork')return m.piece==='r'&&!b.isAttacked(m.to,b.turn())&&b.board().flat().filter(x=>x&&x.color!==m.color&&((!p.requireLoosePair&&x.type==='k')||(['n','b'].includes(x.type)&&!b.isAttacked(x.square,x.color)))&&b.attackers(x.square,m.color).includes(m.to)).length>=2;
 if(type)return m.piece===type&&b.isCheck()&&!b.isAttacked(m.to,b.turn())&&b.board().flat().some(x=>x&&x.color!==m.color&&['r','q'].includes(x.type)&&b.attackers(x.square,m.color).includes(m.to));
 return false;
}
// Exhaustive three-ply proof, used by the offline authoring script and tests.
// Every legal reply must allow the stated finish; no cooperative opponent lines.
export function forcingLines(fen,theme){
 const b=new Chess(fen),lines={};
 const mate=theme==='stepsMateTwo'||theme==='stepsMateNet';
 const forkPiece={stepsKnightWin:'n',stepsBishopWin:'b',stepsQueenWin:'q'}[theme];
 const first=b.moves({verbose:true}).filter(m=>m.san.includes('+'));
 for(const m of first){
  b.move(m);
  if(forkPiece&&(m.piece!==forkPiece||b.isAttacked(m.to,b.turn())||!b.board().flat().some(x=>x?.type==='r'&&x.color!==m.color&&b.attackers(x.square,m.color).includes(m.to)))){b.undo();continue;}
  const replies=b.moves({verbose:true});let works=!!replies.length;const branches=[];
  for(const reply of replies){
   b.move(reply);const finishes=[];
   for(const end of b.moves({verbose:true})){
    if(!mate&&(end.captured!=='r'||forkPiece&&end.from!==m.to))continue;
    b.move(end);
    if(mate?b.isCheckmate():!canBeTaken(b,end.to))finishes.push(uci(end));
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
