import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile,action,result,empty,threats,bestMoves,botMove,lesson,publicState,clue,WORDS} from '../engine.mjs';
const act=(p,input)=>action(p,{...input,revision:p.revision},()=>.4);
test('Circle choice gives Rook X first, counts child O wins correctly and preserves active boards',()=>{
 const p=freshProfile('beginner');act(p,{type:'mark',mark:'O'});act(p,{type:'start'});assert.equal(p.game.phase,'bot');act(p,{type:'bot'});assert.equal(p.game.moves[0].mark,'X');assert.equal(p.game.phase,'you');
 const saved=structuredClone(p.game);act(p,{type:'mark',mark:'X'});assert.deepEqual(p.game,saved);
 p.game.board=['O','O',null,'X','X',null,'X',null,null];act(p,{type:'hint'});assert.equal(p.game.hint,2);act(p,{type:'move',cell:2});assert.equal(p.wins,1);assert.equal(p.losses,0);assert.equal(p.game.message,WORDS.win);assert.equal(p.history.at(-1).youMark,'O');
 act(p,{type:'start'});assert.equal(p.game.youMark,'X');assert.equal(p.game.phase,'you');assert.throws(()=>act(p,{type:'mark',mark:'Q'}));
});
test('Clues explain openings, immediate wins, blocks and the logged unavoidable double threat',()=>{
 assert.equal(clue(Array(9).fill(null)).reason,'opening');
 assert.deepEqual(clue([null,'O','O','O',null,'X','X','O','X']),{cell:0,reason:'double',message:WORDS.hintDouble});
 for(const mark of ['X','O']){const opp=mark==='X'?'O':'X';assert.equal(clue([mark,mark,null,opp,opp,null,null,null,null],mark).reason,'win');assert.equal(clue([opp,opp,null,mark,null,null,null,null,null],mark).cell,2);}
 const seen=new Set();function walk(b,turn){const key=b.map(v=>v||'-').join('');if(seen.has(key)||result(b))return;seen.add(key);const h=clue(b,turn),opp=turn==='X'?'O':'X';assert.ok(empty(b).includes(h.cell));if(threats(b,turn).length)assert.ok(threats(b,turn).includes(h.cell));else if(threats(b,opp).length===1)assert.equal(h.cell,threats(b,opp)[0]);else if(threats(b,opp).length>1)assert.equal(h.reason,'double');else assert.ok(bestMoves(b,turn).includes(h.cell));for(const i of empty(b)){const c=[...b];c[i]=turn;walk(c,opp);}}walk(Array(9).fill(null),'X');assert.ok(seen.size>4000);
});
test('X starts every new match, including after odd totals; unfinished legacy games survive',()=>{
 for(const id of ['beginner','explorer'])for(const games of [0,1,2,21]){
  const p=freshProfile(id);p.games=games;act(p,{type:'start'});
  assert.equal(p.game.phase,'you');assert.equal(p.game.opener,'X');assert.equal(empty(p.game.board).length,9);
 }
 const p=freshProfile('explorer');act(p,{type:'start'});p.game.opener='O';p.game.phase='bot';act(p,{type:'bot'});
 const saved=structuredClone(p.game);act(p,{type:'start'});assert.deepEqual(p.game,saved);
 for(const level of [3,2,1,2]){act(p,{type:'level',level});assert.equal(p.level,level);assert.deepEqual(p.game,saved);}
 for(const level of [0,4,'2'])assert.throws(()=>act(p,{type:'level',level}));
 act(p,{type:'mode',mode:'practice'});act(p,{type:'mode',mode:'play'});assert.deepEqual(p.game,saved);
});
test('Perfect Rook never loses against any legal human continuation, either starter',()=>{
 const seen=new Set();let endings=0;
 function visit(b,turn){const key=b.map(v=>v||'-').join('')+turn;if(seen.has(key))return;seen.add(key);const r=result(b);if(r){assert.notEqual(r.winner,'X');endings++;return;}
 for(const i of turn==='O'?bestMoves(b,'O'):empty(b)){const c=[...b];c[i]=turn;visit(c,turn==='X'?'O':'X');}}
 visit(Array(9).fill(null),'X');visit(Array(9).fill(null),'O');assert.ok(endings>100);
});
test('Clever Rook takes wins and blocks, profiles start differently',()=>{
 assert.equal(botMove(['O','O',null,'X','X',null,null,null,null],2),2);
 const threat=['X','X',null,null,'O',null,null,null,null];
 assert.equal(botMove(threat,2,()=>0),2);
 assert.notEqual(botMove(threat,2,()=>.99),2,'Clever sometimes leaves a real winning opening');
 assert.equal(freshProfile('beginner').level,1);assert.equal(freshProfile('explorer').level,2);
});
test('Lessons are varied, have meaningful choices and valid unique tactics',()=>{
 for(const id of ['beginner','explorer']){const p=freshProfile(id),seen=new Set();for(let n=0;n<80;n++){
  p.learning.clean=n;p.learning.done=n;p.revision=n;const g=lesson(p);assert.equal(result(g.board),null);assert.ok(empty(g.board).length>=3);seen.add(g.board.map(v=>v||'-').join(''));
  if(g.stage==='win')assert.deepEqual(threats(g.board,'X'),[g.answer]);
  if(g.stage==='block'){assert.deepEqual(threats(g.board,'O'),[g.answer]);assert.ok(bestMoves(g.board,'X').includes(g.answer));}
  if(g.stage==='fork'){g.board[g.answer]='X';assert.ok(threats(g.board,'X').length>=2);}
 }assert.ok(seen.size>40);}
});
test('Hints and retries remain assisted; no duplicate credit, malformed moves rejected',()=>{
 const p=freshProfile('beginner');act(p,{type:'practice'});const correct=p.game.answer,wrong=empty(p.game.board).find(i=>i!==correct);act(p,{type:'move',cell:wrong});assert.equal(p.learning.clean,0);act(p,{type:'hint'});assert.equal(p.game.hint,correct);act(p,{type:'move',cell:correct});assert.equal(p.learning.done,1);assert.equal(p.learning.clean,0);assert.equal(p.stars,0);assert.throws(()=>act(p,{type:'move',cell:correct}));assert.throws(()=>action(p,{type:'start',revision:-1}));
 act(p,{type:'mode',mode:'play'});for(const cell of [-1,9,1.1,'2',null])assert.throws(()=>act(p,{type:'move',cell}));assert.equal(p.games,0);
});
test('Switching modes and reload preserve an unfinished board without leaking lesson solutions',()=>{
 const p=freshProfile('admin');act(p,{type:'start'});act(p,{type:'move',cell:0});const saved=structuredClone(p.game);act(p,{type:'mode',mode:'practice'});assert.equal(publicState(p).game.answer,undefined);assert.equal(publicState(p).parked,undefined);act(p,{type:'mode',mode:'play'});assert.deepEqual(p.game,saved);const copy=JSON.parse(JSON.stringify(p));act(copy,{type:'bot'});assert.equal(copy.game.phase,'you');assert.equal(empty(copy.game.board).length,7);
});
test('Independent results adapt within three strengths; assisted wins do not advance',()=>{
 const p=freshProfile('beginner');for(let n=0;n<3;n++){act(p,{type:'start'});p.game.board=['X','X',null,'O','O',null,null,null,null];p.game.phase='you';act(p,{type:'move',cell:2});}assert.equal(p.level,2);assert.equal(p.wins,3);assert.equal(p.stars,9);
 act(p,{type:'start'});p.game.board=['X','X',null,'O','O',null,null,null,null];p.game.phase='you';act(p,{type:'hint'});act(p,{type:'move',cell:2});assert.equal(p.streak,0);assert.equal(p.assisted,1);assert.equal(p.stars,10);
 for(let n=0;n<2;n++){act(p,{type:'start'});p.game.board=['O','O',null,'X',null,'X',null,null,null];p.game.phase='bot';p.game.level=2;act(p,{type:'bot'});}assert.equal(p.level,1);assert.equal(p.losses,2);
});
test('Normal progression stays beatable; Perfect is opt-in and current boards are preserved',()=>{
 const p=freshProfile('explorer');for(let n=0;n<9;n++){act(p,{type:'start'});p.game.board=['X','X',null,'O','O',null,null,null,null];p.game.phase='you';act(p,{type:'move',cell:2});}assert.equal(p.level,2);
 act(p,{type:'level',level:3});act(p,{type:'start'});const current=structuredClone(p.game);act(p,{type:'level',level:2});assert.deepEqual(p.game,current);assert.equal(p.level,2);
 p.game.phase='done';act(p,{type:'start'});assert.equal(p.game.level,2);
});
