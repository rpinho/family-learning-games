export const VERSION='three-in-a-row-2026-09-26-word-breaks';
export const PLAYERS={beginner:'Beginner',explorer:'Explorer',admin:'Admin · Admin'};
export const LEVELS=['','Friendly','Clever','Perfect'];
export const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const WORDS={start:'You are X. Make three in a row.',turn:'Your turn.',win:'Three in a row! You did it.',lose:'Rook made a row. Let’s try again.',draw:'A draw! Neither player made a row.',find:'Find the move that makes three Xs.',block:'Two Os! Block their row.',fork:'Make two ways to win.',correct:'You found it!',winLesson:'Three Xs in a row!',blockLesson:'You stopped their row!',forkLesson:'Now you have two ways to win.',retry:'Look again. Try another square.',hint:'Try the glowing square.',level:'Rook will think a little harder next game.',practice:'Practice complete. Ready to play?',saved:'Your game is saved.'};
Object.assign(WORDS,{startO:'You are O. Rook starts with X.',hintWin:'Finish your row here!',hintBlock:'Block Rook here.',hintDouble:'Rook has two ways to win. We can only block one.',hintOpening:'Start here. Then watch what Rook does.',hintSafe:'Try here. Watch for Rook’s next move.',hintLost:'Rook has the advantage. Try this move.',hintFork:'This gives you two ways to win.'});
export const other=mark=>mark==='X'?'O':'X';
export const youMark=g=>g?.mode==='practice'?'X':g?.youMark||'X';
export const empty=b=>b.map((v,i)=>v?null:i).filter(i=>i!==null);
const boardKey=b=>b.map(v=>v||'-').join('');
export function result(b){for(const line of LINES)if(b[line[0]]&&line.every(i=>b[i]===b[line[0]]))return {winner:b[line[0]],line};return empty(b).length?null:{winner:'draw',line:[]};}
export const threats=(b,mark)=>empty(b).filter(i=>{const c=[...b];c[i]=mark;return result(c)?.winner===mark;});
const memo=new Map();
export function minimax(b,turn){const r=result(b);if(r)return r.winner==='X'?1:r.winner==='O'?-1:0;const key=b.map(v=>v||'-').join('')+turn;if(memo.has(key))return memo.get(key);const scores=empty(b).map(i=>{const c=[...b];c[i]=turn;return minimax(c,turn==='X'?'O':'X');});const score=turn==='X'?Math.max(...scores):Math.min(...scores);memo.set(key,score);return score;}
export function bestMoves(b,mark){const moves=empty(b),scores=moves.map(i=>{const c=[...b];c[i]=mark;return minimax(c,mark==='X'?'O':'X');});const best=mark==='X'?Math.max(...scores):Math.min(...scores);return moves.filter((_,i)=>scores[i]===best);}
export function botMove(b,level,rng=Math.random,mark='O'){if(mark==='X')return botMove(b.map(v=>v?other(v):null),level,rng);const pick=a=>a[Math.min(a.length-1,Math.floor(rng()*a.length))];if(result(b))return null;const wins=threats(b,'O'),blocks=threats(b,'X');if(level===3)return pick(bestMoves(b,'O'));if(level===2){if(wins.length)return pick(wins);if(blocks.length)return pick(rng()<.8?blocks:empty(b));return pick(rng()<.65?bestMoves(b,'O'):empty(b));}return pick(rng()<.25?bestMoves(b,'O'):empty(b));}
export function clue(b,mark='X'){
 if(result(b))return null;
 const wins=threats(b,mark),blocks=threats(b,other(mark));
 if(wins.length)return {cell:wins[0],reason:'win',message:WORDS.hintWin};
 if(blocks.length)return {cell:blocks[0],reason:blocks.length>1?'double':'block',message:blocks.length>1?WORDS.hintDouble:WORDS.hintBlock};
 const best=bestMoves(b,mark),cell=[4,0,2,6,8,1,3,5,7].find(i=>best.includes(i));
 const c=[...b];c[cell]=mark;const lost=minimax(b,mark)===(mark==='X'?-1:1);
 const reason=empty(b).length>=8?'opening':lost?'lost':threats(c,mark).length>1?'fork':'safe';
 return {cell,reason,message:WORDS[{opening:'hintOpening',lost:'hintLost',fork:'hintFork',safe:'hintSafe'}[reason]]};
}
let pools;
function lessonPools(){if(pools)return pools;pools={win:[],block:[],fork:[]};const seen=new Set();function visit(b,turn){const key=b.map(v=>v||'-').join('');if(seen.has(key)||result(b))return;seen.add(key);if(turn==='X'){
 const wins=threats(b,'X'),blocks=threats(b,'O');
 if(wins.length===1&&empty(b).length>=3)pools.win.push({board:b,answer:wins[0]});
 if(!wins.length&&blocks.length===1&&empty(b).length>=3&&bestMoves(b,'X').includes(blocks[0]))pools.block.push({board:b,answer:blocks[0]});
 if(!wins.length&&!blocks.length){const forks=empty(b).filter(i=>{const c=[...b];c[i]='X';return threats(c,'X').length>=2&&minimax(c,'O')===1;});if(forks.length===1)pools.fork.push({board:b,answer:forks[0]});}
 }for(const i of empty(b)){const c=[...b];c[i]=turn;visit(c,turn==='X'?'O':'X');}}visit(Array(9).fill(null),'X');return pools;}
export function lesson(p){const skill=p.learning.clean+(p.id==='explorer'?6:0),stage=skill<3?'win':skill<8?'block':['win','block','fork'][p.learning.done%3];const pool=lessonPools()[stage],last=p.learning.last||[];let candidates=pool.filter(v=>!last.includes(boardKey(v.board)));if(!candidates.length)candidates=pool;const item=candidates[(p.revision*173+p.learning.done*71)%candidates.length];p.learning.last=[...last,boardKey(item.board)].slice(-20);return {id:`p-${p.revision}`,mode:'practice',board:[...item.board],answer:item.answer,stage,phase:'you',helped:false,wrong:0,line:[],message:WORDS[stage==='win'?'find':stage],hint:null,moves:[]};}
export const freshProfile=id=>({id,name:PLAYERS[id],revision:0,level:id==='explorer'?2:1,streak:0,struggles:0,stars:0,games:0,wins:0,draws:0,losses:0,assisted:0,learning:{done:0,clean:0,last:[]},history:[],game:null});
function newGame(p){const mark=p.mark||'X';return {id:`g-${p.revision}`,mode:'play',board:Array(9).fill(null),youMark:mark,phase:mark==='X'?'you':'bot',opener:'X',level:p.level,line:[],helped:false,hint:null,moves:[],message:mark==='X'?WORDS.start:WORDS.startO};}
function finish(p,g){const r=result(g.board);if(!r)return false;const won=r.winner===youMark(g),lost=r.winner===other(youMark(g));g.phase='done';g.winner=r.winner;g.line=r.line;g.message=WORDS[won?'win':lost?'lose':'draw'];p.games++;p[won?'wins':lost?'losses':'draws']++;if(g.helped)p.assisted++;
 const reward=won?3:r.winner==='draw'?2:0;p.stars+=g.helped?Math.min(1,reward):reward;
 if(!g.helped&&!lost){p.streak++;p.struggles=0;if(p.streak>=3){if(p.level<2)p.level++;p.streak=0;}}else{p.streak=0;if(lost){p.struggles++;if(p.struggles>=2){p.level=Math.max(1,p.level-1);p.struggles=0;}}}
 p.history.push({id:g.id,mode:'play',youMark:youMark(g),winner:r.winner,helped:g.helped,level:g.level,nextLevel:p.level,moves:g.moves,at:new Date().toISOString()});p.history=p.history.slice(-300);return true;}
export function action(p,input,rng=Math.random){if(!input||input.revision!==p.revision)throw Object.assign(Error('Your game changed. Refresh to continue.'),{status:409});const g=p.game;const fail=()=>{throw Object.assign(Error('That move is not available.'),{status:400});};
 switch(input.type){
 case 'start':if(g&&g.mode==='play'&&g.phase!=='done')return p;p.game=newGame(p);break;
 case 'practice':if(g&&g.mode==='practice'&&g.phase!=='done')return p;p.game=lesson(p);break;
 case 'mode':if(!['play','practice'].includes(input.mode))fail();if(g?.mode===input.mode)return p;p.parked??={};if(g)p.parked[g.mode]=g;p.game=p.parked[input.mode]||(input.mode==='play'?newGame(p):lesson(p));delete p.parked[input.mode];break;
 case 'move':{
 if(!g||g.phase!=='you'||!Number.isInteger(input.cell)||input.cell<0||input.cell>8||g.board[input.cell])fail();
 if(g.mode==='practice'){
  if(input.cell!==g.answer){g.wrong++;g.message=WORDS.retry;break;}
  g.board[input.cell]='X';g.phase='done';g.line=result(g.board)?.line||[];g.message=WORDS[g.stage+'Lesson'];p.learning.done++;const independent=!g.helped&&!g.wrong;if(independent){p.learning.clean++;p.stars++;}p.history.push({id:g.id,mode:'practice',stage:g.stage,helped:g.helped,wrong:g.wrong,independent,at:new Date().toISOString()});p.history=p.history.slice(-300);
 }else{const mark=youMark(g);g.board[input.cell]=mark;g.moves.push({mark,cell:input.cell});g.hint=null;g.hintReason=null;if(!finish(p,g)){g.phase='bot';g.message='Rook is thinking…';}}
 break;}
 case 'bot':if(!g||g.mode!=='play'||g.phase!=='bot')fail();{const mark=other(youMark(g)),cell=botMove(g.board,g.level,rng,mark);if(cell===null)fail();g.board[cell]=mark;g.moves.push({mark,cell});if(!finish(p,g)){g.phase='you';g.message=WORDS.turn;}}break;
 case 'hint':if(!g||g.phase!=='you')fail();g.helped=true;if(g.mode==='practice'){g.hint=g.answer;g.message=WORDS.hint;}else{const h=clue(g.board,youMark(g));g.hint=h.cell;g.hintReason=h.reason;g.message=h.message;}break;
 case 'mark':if(!['X','O'].includes(input.mark))fail();p.mark=input.mark;break;
 case 'level':if(![1,2,3].includes(input.level))fail();p.level=input.level;p.streak=0;p.struggles=0;break;
 default:fail();
 }p.revision++;return p;}
export function publicState(p){const out=structuredClone(p);if(out.game)delete out.game.answer;delete out.parked;delete out.learning.last;out.history=out.history.slice(-10);return out;}
