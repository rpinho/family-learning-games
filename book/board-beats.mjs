// labyrinths are probably his top games"). Deterministic (seeded by the caller's generator), checked by code, never
// by the language model. Both are "puzzle" beats with their own board: the game draws it (painted chess pieces on a
// small wooden board; a pencil labyrinth on paper) and he answers by tapping a piece, a coloured dot or a door.
//  - chess "capture": three white pieces and a black piece; exactly one white piece can capture it (lines are really
//    blocked, a knight really jumps);
//  - chess "fork": a white knight, the black king and a black rook or queen; exactly one of three marked squares is a
//    knight jump that attacks both at once (a royal fork);
//  - maze: a hand-drawn labyrinth with three coloured doors; exactly one door's path reaches the star (every other
//    door's corridors end in dead ends). The path each door leads along is part of the beat, so the game can draw it.

// ---- chess ----
export const PIECES=['king','queen','rook','bishop','knight','pawn'];
export const pieceProp=(c,t)=>`chess-${c==='w'?'white':'black'}-${t}`;
const FILES='abcdefgh';
export const sqName=([f,r])=>FILES[f]+(r+1);
export const sqOf=s=>[FILES.indexOf(s[0]),Number(s.slice(1))-1];
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const pick=(a,r)=>a[Math.floor(r()*a.length)];
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const KN=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]],KG=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const ORTH=[[1,0],[0,1],[-1,0],[0,-1]],DIAG=[[1,1],[-1,1],[-1,-1],[1,-1]];
// The squares a piece attacks on an n x n board ({t,c,sq}); sliding pieces stop at the first piece in the way.
export function attacks(p,pieces,n){
 const [f,r]=sqOf(p.sq),on=(x,y)=>x>=0&&y>=0&&x<n&&y<n,occ=(x,y)=>pieces.some(q=>same(sqOf(q.sq),[x,y]));
 const out=[];const jump=ds=>{for(const [dx,dy] of ds)if(on(f+dx,r+dy))out.push([f+dx,r+dy]);};
 const slide=ds=>{for(const [dx,dy] of ds){let x=f+dx,y=r+dy;while(on(x,y)){out.push([x,y]);if(occ(x,y))break;x+=dx;y+=dy;}}};
 if(p.t==='knight')jump(KN);else if(p.t==='king')jump(KG);else if(p.t==='rook')slide(ORTH);else if(p.t==='bishop')slide(DIAG);else if(p.t==='queen')slide([...ORTH,...DIAG]);
 else if(p.t==='pawn')jump(p.c==='w'?[[1,1],[-1,1]]:[[1,-1],[-1,-1]]);
 return out.map(sqName);
}
export const canTake=(p,target,pieces,n)=>attacks(p,pieces,n).includes(target.sq);
// How each piece moves, said once (the hint after two misses).
const MOVES={knight:'A knight jumps in an L.',bishop:'A bishop slides on the diagonals.',rook:'A rook slides straight up, down and across.',queen:'A queen slides straight or on the diagonals.',pawn:'A pawn captures one step diagonally forward.'};
// Which white piece can capture the black piece? Three white candidates of different kinds, one or two black pawns in
// the way; exactly one candidate can take the target.
export function chessCaptureBeat(id,r,{n=5}={}){
 const all=[];for(let f=0;f<n;f++)for(let k=0;k<n;k++)all.push(sqName([f,k]));
 for(let tries=0;tries<4000;tries++){
  const target={t:pick(['queen','rook','knight','bishop'],r),c:'b'};const kinds=shuffle(['knight','bishop','rook','queen','pawn'],r).slice(0,3);
  const sqs=shuffle(all,r);target.sq=sqs[0];
  const cand=kinds.map((t,i)=>({t,c:'w',sq:sqs[1+i]}));
  // a white pawn on the last rank cannot be there; a pawn starts no lower than the second rank
  if(cand.some(p=>p.t==='pawn'&&(sqOf(p.sq)[1]>=n-1||sqOf(p.sq)[1]<1)))continue;
  const blockers=Array.from({length:1+Math.floor(r()*2)},(_,i)=>({t:'pawn',c:'b',sq:sqs[4+i]})).filter(p=>sqOf(p.sq)[1]>=1&&sqOf(p.sq)[1]<n-1);
  const pieces=[target,...cand,...blockers];
  const ok=cand.filter(p=>canTake(p,target,pieces,n));if(ok.length!==1)continue;
  // every wrong piece is a real candidate: it would reach the target without the blocker, or it is a knight close by
  const wrong=cand.filter(p=>p!==ok[0]);
  const plausible=p=>canTake(p,target,[target,...cand],n)||(p.t==='knight'&&Math.max(...sqOf(p.sq).map((v,i)=>Math.abs(v-sqOf(target.sq)[i])))<=2);
  if(!wrong.some(plausible))continue;
  // no white piece is already giving the answer away by standing next to the target in a line it attacks trivially
  const answer=ok[0].t;
  return {id,kind:'puzzle',variant:'chess',mode:'capture',n,pieces,target:target.sq,answer,options:kinds,move:{from:ok[0].sq,to:target.sq},
   what:`a chess puzzle on the table: three white pieces and a black ${target.t}; he finds the one white piece that can capture it (the others are blocked or move the wrong way)`,
   spoken:`The black ${target.t} is in danger. Which white piece can capture it?`,hint:'Check how each piece moves, and what is in its way.',done:`Yes! The ${answer} captures the ${target.t}.`};
 }
 throw Error('no capture puzzle found');
}
// The knight fork: a white knight, the black king and a black rook (or queen); three marked squares the knight can
// jump to; exactly one attacks both black pieces at once. The king is not in check before the jump.
export const DOTS=[['blue','#2f6fd6'],['green','#2e9a4f'],['red','#d8433a']];
export function chessForkBeat(id,r,{n=5}={}){
 const all=[];for(let f=0;f<n;f++)for(let k=0;k<n;k++)all.push(sqName([f,k]));
 for(let tries=0;tries<4000;tries++){
  const sqs=shuffle(all,r),knight={t:'knight',c:'w',sq:sqs[0]},king={t:'king',c:'b',sq:sqs[1]},other={t:pick(['rook','queen'],r),c:'b',sq:sqs[2]};
  const pieces=[knight,king,other];
  if(canTake(knight,king,pieces,n)||canTake(knight,other,pieces,n))continue;
  const jumps=attacks(knight,pieces,n).filter(s=>!pieces.some(p=>p.sq===s));
  const hits=s=>{const k={...knight,sq:s};return [king,other].filter(t=>canTake(k,t,pieces,n)).length;};
  const fork=jumps.filter(s=>hits(s)===2);if(fork.length!==1)continue;
  // the black pieces must not be able to take the knight on its fork square... a quiet, clean fork: the king may
  // (it is a real position), but the rook or queen must not reach it
  if(canTake(other,{sq:fork[0]},pieces.filter(p=>p!==knight),n))continue;
  const rest=shuffle(jumps.filter(s=>s!==fork[0]),r);if(rest.length<2)continue;
  // at least one distractor attacks one of the two (tempting, but not both)
  const dis=[...rest.filter(s=>hits(s)===1).slice(0,1),...rest.filter(s=>hits(s)!==1)].slice(0,2);if(dis.length<2||!dis.some(s=>hits(s)===1))continue;
  const marks=shuffle([fork[0],...dis],r),colors=DOTS.map(d=>d[0]),dots=Object.fromEntries(marks.map((s,i)=>[colors[i],s]));
  const answer=colors[marks.indexOf(fork[0])];
  return {id,kind:'puzzle',variant:'chess',mode:'fork',n,pieces,dots,answer,options:colors,move:{from:knight.sq,to:fork[0]},
   what:`a chess puzzle on the table: a white knight, the black king and a black ${other.t}; three squares are marked with coloured dots and he finds the knight jump that attacks both black pieces at once (a fork)`,
   spoken:`Find the knight jump that attacks the black king and the black ${other.t} at the same time. Blue, green or red?`,hint:'A knight jumps in an L. From which dot could it reach both?',done:`Yes! A fork! The knight attacks the king and the ${other.t}.`};
 }
 throw Error('no fork puzzle found');
}
// Checks a chess beat against the rules (used by the chapter lint and the tests).
export function checkChess(b){
 const out=[],n=b.n||5,P=b.pieces||[];
 if(P.some(p=>{const [f,r]=sqOf(p.sq);return !(f>=0&&r>=0&&f<n&&r<n);}))out.push(`${b.id}: a piece is off the board`);
 if(new Set(P.map(p=>p.sq)).size!==P.length)out.push(`${b.id}: two pieces on one square`);
 if(b.mode==='capture'){const t=P.find(p=>p.sq===b.target),w=P.filter(p=>p.c==='w');const ok=w.filter(p=>canTake(p,t,P,n)).map(p=>p.t);
  if(ok.length!==1||ok[0]!==b.answer)out.push(`${b.id}: the pieces that can capture are ${ok.join(', ')||'none'}, not just the ${b.answer}`);
  if(new Set(w.map(p=>p.t)).size!==w.length)out.push(`${b.id}: two white pieces of the same kind`);}
 else if(b.mode==='fork'){const k=P.find(p=>p.t==='knight'&&p.c==='w'),targets=P.filter(p=>p.c==='b');
  const both=Object.entries(b.dots||{}).filter(([,s])=>attacks(k,P,n).includes(s)&&targets.every(t=>canTake({...k,sq:s},t,P,n))).map(([c])=>c);
  if(both.length!==1||both[0]!==b.answer)out.push(`${b.id}: the fork squares are ${both.join(', ')||'none'}, not just ${b.answer}`);
  if(targets.some(t=>canTake(k,t,P,n)))out.push(`${b.id}: the knight already attacks a black piece`);}
 else out.push(`${b.id}: unknown chess puzzle`);
 return out;
}

// ---- labyrinths ----
// Cells are [x,y], y down. walls[y][x] is a bit mask of the walls still standing: 1 north, 2 east, 4 south, 8 west.
const DIRS=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
export function carve(w,h,r){const walls=Array.from({length:h},()=>Array(w).fill(15)),seen=Array.from({length:h},()=>Array(w).fill(false));
 const stack=[[0,0]];seen[0][0]=true;
 while(stack.length){const [x,y]=stack.at(-1),next=shuffle(DIRS,r).filter(([dx,dy])=>x+dx>=0&&y+dy>=0&&x+dx<w&&y+dy<h&&!seen[y+dy][x+dx]);
  if(!next.length){stack.pop();continue;}const [dx,dy,a,b]=next[0];walls[y][x]&=~a;walls[y+dy][x+dx]&=~b;seen[y+dy][x+dx]=true;stack.push([x+dx,y+dy]);}
 return walls;}
const open=(walls,[x,y])=>DIRS.filter(([dx,dy,a])=>!(walls[y][x]&a)&&walls[y+dy]?.[x+dx]!==undefined).map(([dx,dy])=>[x+dx,y+dy]);
// Shortest path from a to b inside the walls (null when there is none).
export function mazePath(walls,a,b){const k=c=>c.join(','),prev=new Map([[k(a),null]]),q=[a];
 while(q.length){const c=q.shift();if(same(c,b)){const out=[];for(let x=c;x;x=prev.get(k(x)))out.unshift(x);return out;}
  for(const n of open(walls,c))if(!prev.has(k(n))){prev.set(k(n),c);q.push(n);}}
 return null;}
function reach(walls,a){const k=c=>c.join(','),seen=new Map([[k(a),a]]),q=[a];while(q.length){const c=q.shift();for(const n of open(walls,c))if(!seen.has(k(n))){seen.set(k(n),n);q.push(n);}}return [...seen.values()];}
const wall=(walls,a,b)=>{const d=DIRS.find(([dx,dy])=>a[0]+dx===b[0]&&a[1]+dy===b[1]);walls[a[1]][a[0]]|=d[2];walls[b[1]][b[0]]|=d[3];};
// A labyrinth with three doors on the left edge and the star on the right edge; one door's path reaches it.
export function mazeBeat(id,r,{w=6,h=6,big=false}={}){
 for(let tries=0;tries<3000;tries++){
  const walls=carve(w,h,r),exit=[w-1,Math.floor(r()*h)];
  // three doors spread down the left side
  const rows=shuffle(Array.from({length:h},(_,i)=>i),r).slice(0,3).sort((a,b)=>a-b);if(rows[1]-rows[0]<2||rows[2]-rows[1]<2)continue;
  const colors=DOTS.map(d=>d[0]),doors=Object.fromEntries(rows.map((y,i)=>[colors[i],[0,y]])),right=pick(colors,r);
  const good=mazePath(walls,doors[right],exit);let ok=true;
  for(const c of colors){if(c===right)continue;const p=mazePath(walls,doors[c],exit);if(!p)continue;
   // cut the wrong door's way where it does not share the right door's way, in its middle third
   const onGood=new Set(good.map(x=>x.join(',')));const own=p.findIndex(x=>onGood.has(x.join(',')));const seg=p.slice(0,own<0?p.length:own+1);
   if(seg.length<4){ok=false;break;}const i=Math.max(1,Math.floor(seg.length*(0.45+r()*0.25)))-1;wall(walls,seg[i],seg[i+1]);}
  if(!ok)continue;
  if(colors.some(c=>c!==right&&mazePath(walls,doors[c],exit))||!mazePath(walls,doors[right],exit))continue;
  if(colors.some(c=>c!==right&&same(doors[c],doors[right])))continue;
  // a wrong door must not end next to its own door: at least five cells of corridor before its dead end
  const paths={};let deep=true;
  for(const c of colors){if(c===right){paths[c]=mazePath(walls,doors[c],exit);continue;}
   const zone=reach(walls,doors[c]);if(zone.length<5){deep=false;break;}
   // where that door's explorer gets stuck: the cell of its zone closest to the star (ties: the furthest along)
   const best=zone.map(z=>({z,d:Math.abs(z[0]-exit[0])+Math.abs(z[1]-exit[1]),len:mazePath(walls,doors[c],z).length})).sort((a,b)=>a.d-b.d||b.len-a.len)[0];
   paths[c]=mazePath(walls,doors[c],best.z);}
  if(!deep)continue;
  // each door has its own corridors: no explorer walks past another door
  if(colors.some(c=>paths[c].slice(1).some(x=>colors.some(o=>o!==c&&same(x,doors[o])))))continue;
  if(paths[right].length<w+2)continue;   // the way through winds, it is never a straight run
  return {id,kind:'puzzle',variant:'maze',w,h,walls:walls.map(row=>row.map(v=>v.toString(16)).join('')),doors,exit,paths,answer:right,options:colors,
   what:`${big?'a bigger ':'a '}hand-drawn paper labyrinth with three coloured doors on one side and a star on the other; he follows the paths with his eyes and picks the door whose path reaches the star`,
   spoken:big?'A bigger labyrinth! Which door leads all the way to the star? Blue, green or red?':'Three doors into the labyrinth. Which one leads to the star? Blue, green or red?',
   hint:'Follow each path with your finger, from the door to the end.',done:big?'Yes! All the way through the big labyrinth!':'Yes! That path reaches the star!'};
 }
 throw Error('no labyrinth found');
}
export const mazeWalls=b=>(b.walls||[]).map(row=>[...row].map(c=>parseInt(c,16)));
export function checkMaze(b){
 const out=[],walls=mazeWalls(b);
 if(walls.length!==b.h||walls.some(r=>r.length!==b.w))out.push(`${b.id}: the labyrinth grid is not ${b.w} by ${b.h}`);
 if(out.length)return out;
 const reaches=Object.entries(b.doors||{}).filter(([,d])=>mazePath(walls,d,b.exit)).map(([c])=>c);
 if(reaches.length!==1||reaches[0]!==b.answer)out.push(`${b.id}: the doors that reach the star are ${reaches.join(', ')||'none'}, not just ${b.answer}`);
 // the drawn paths follow the corridors (no step through a wall)
 for(const [c,p] of Object.entries(b.paths||{}))for(let i=1;i<p.length;i++)if(!open(walls,p[i-1]).some(x=>same(x,p[i])))out.push(`${b.id}: the ${c} path goes through a wall`);
 if(!same(b.paths?.[b.answer]?.at(-1)||[],b.exit))out.push(`${b.id}: the ${b.answer} path does not end at the star`);
 return out;
}
