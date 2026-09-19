import test from 'node:test';import assert from 'node:assert/strict';
import {FOUNDATIONS,FOUNDATION_EXAMPLES,FOUNDATION_PRACTICE,foundationGoal} from '../chess-foundations.mjs';
import {FOUNDATION_LESSONS} from '../public/chess/foundations-curriculum.mjs';
import {freshChess,actChess,publicChess,PUZZLES,lessonPuzzles} from '../chess-state.mjs';
import {Chess} from '../public/chess/rules.mjs';
import {createNarrationGate,narrationFor} from '../public/chess/narration.mjs';
const act=(p,type,x={})=>actChess(p,{type,...x,revision:p.revision,requestId:crypto.randomUUID()});
test('First moves teaches legal sparse boards and separate demonstrations',async()=>{
 assert.equal(Object.values(FOUNDATIONS).flat().length,120);
 for(const puzzle of [...Object.values(FOUNDATIONS).flat(),...Object.values(FOUNDATION_EXAMPLES)]){
  const b=new Chess(puzzle.fen),king=b.board().flat().find(x=>x?.type==='k'&&x.color==='b');
  assert.equal(b.isCheck(),false,puzzle.id);assert.equal(b.isAttacked(king.square,'w'),false,puzzle.id);
  const m=b.move({from:puzzle.line[0].slice(0,2),to:puzzle.line[0].slice(2)});assert.ok(foundationGoal(puzzle,b,m),puzzle.id);
 }
 const p=freshChess();await act(p,'settings',{band:'foundations'});
 for(const lesson of FOUNDATION_LESSONS){
  await act(p,'start',{lesson:lesson.id});assert.ok(publicChess(p).session.example);
  assert.ok(lessonPuzzles(lesson.id,'foundations').every(id=>PUZZLES[id].fen!==FOUNDATION_EXAMPLES[lesson.id].fen));
  await act(p,'begin');for(let i=0;i<lessonPuzzles(lesson.id,'foundations').length;i++){const puzzle=PUZZLES[p.session.ids[i]],u=puzzle.line[0];await act(p,'move',{from:u.slice(0,2),to:u.slice(2)});assert.equal(p.session.phase,'solved');await act(p,'next');}assert.ok(p.completed[lesson.id]);
 }
});
test('Changing to foundations preserves the older active lesson and achievements',async()=>{
 const p=freshChess();await act(p,'start',{lesson:'forcing-1'});await act(p,'begin');const prior=structuredClone(p.session);p.completed['forcing-2']={best:3,times:1};await act(p,'settings',{band:'foundations'});assert.deepEqual(p.pausedLessons.stretch,prior);assert.ok(p.completed['forcing-2']);await act(p,'settings',{band:'stretch'});assert.deepEqual(p.session,prior);
});
test('New tasks and lessons speak; repeated task instructions stay quiet',()=>{
 const gate=createNarrationGate(()=>100);assert.equal(gate('Move to the star.',{kind:'task',scope:'lesson-a'}),true);assert.equal(gate('Move to the star.',{kind:'task',scope:'lesson-a'}),false);
 assert.equal(gate('Attack the king.',{kind:'task',scope:'lesson-a'}),true);
 assert.equal(gate('Move to the star.',{kind:'task',scope:'lesson-a',force:true}),true);
 assert.equal(gate('Move to the star.',{kind:'task',scope:'lesson-b'}),true);
 assert.equal(gate('Nice move.'),true);assert.equal(gate('Nice move.'),false);
 assert.equal(narrationFor('next',{session:{phase:'puzzle'}},'Make a fork.').kind,'task');
});


test('Movement intros have three targets, then unmarked capture choices with a distinct demonstration',async()=>{
 for(const piece of ['rook','bishop','knight']){
  const intro=lessonPuzzles(`learn-${piece}-1`,'foundations');assert.equal(intro.length,3);assert(intro.every(id=>PUZZLES[id].target));
  for(const step of [2,3]){
   const id=`learn-${piece}-${step}`,ids=lessonPuzzles(id,'foundations');assert.equal(ids.length,3);
   for(const key of ids){const puzzle=PUZZLES[key],b=new Chess(puzzle.fen);assert(!puzzle.target);assert.equal(puzzle.theme,'learnCapture');assert.equal(b.board().flat().filter(p=>p?.color==='w'&&p.type!=='k').length,2);
    // There must be legal moves that fail as well as a legal capture that succeeds.
    const decisions=b.moves({verbose:true}).map(move=>{const board=new Chess(puzzle.fen),played=board.move(move);return foundationGoal(puzzle,board,played);});assert(decisions.includes(true));assert(decisions.includes(false));
   }
   assert(!ids.some(key=>PUZZLES[key].fen===FOUNDATION_EXAMPLES[id].fen));
  }
 }
 assert.equal(lessonPuzzles('learn-fork-1','foundations').length,5);
});
test('Capture lessons hide answer circles and require choosing the one safe capture',async()=>{
 for(const lesson of FOUNDATION_LESSONS.filter(x=>x.id.startsWith('learn-capture-'))){
  const ids=lessonPuzzles(lesson.id,'foundations');assert.equal(ids.length,3);
  for(const id of ids){const puzzle=PUZZLES[id],moves=new Chess(puzzle.fen).moves({verbose:true}).filter(m=>m.captured&&m.captured!=='k');
   assert(moves.length>=2,id);const outcomes=moves.map(move=>{const b=new Chess(puzzle.fen),played=b.move(move);return foundationGoal(puzzle,b,played);});assert.equal(outcomes.filter(Boolean).length,1,id);assert(outcomes.includes(false),id);
  }
 }
 const p=freshChess();await act(p,'settings',{band:'foundations'});await act(p,'start',{lesson:'learn-capture-1'});await act(p,'begin');const pub=publicChess(p);
 assert.equal(pub.session.puzzle.theme,'learnCapture');assert.equal(pub.session.puzzle.concealLegalMoves,true);assert.equal(pub.session.puzzle.target,undefined);
});
test('Existing three solved movement boards finish naturally, preserve history, and unlock capture choice',async()=>{
 const p=freshChess();await act(p,'settings',{band:'foundations'});await act(p,'start',{lesson:'learn-bishop-1'});
 // A pre-update saved session still holds its original five IDs.
 p.session.ids=FOUNDATIONS.learnBishop.slice(0,5).map(x=>x.id);await act(p,'begin');
 const oldCompleted=structuredClone(p.completed);for(let i=0;i<3;i++){const u=PUZZLES[p.session.ids[i]].line[0];await act(p,'move',{from:u.slice(0,2),to:u.slice(2)});assert.equal(publicChess(p).session.total,3);await act(p,'next');}
 assert.equal(p.session.phase,'summary');assert.equal(p.session.results.length,3);assert.equal(publicChess(p).session.total,3);assert.equal(p.completed['learn-bishop-1'].bestTotal,3);
 for(const [key,value] of Object.entries(oldCompleted))assert.deepEqual(p.completed[key],value);
 await act(p,'start',{lesson:'learn-bishop-2'});await act(p,'begin');const pub=publicChess(p);assert(!pub.session.puzzle.target);assert.equal(pub.session.unit,'learn-capture');
 await act(p,'hint');assert.match(publicChess(p).session.feedback.voice,/black piece/);
});
test('Older fifth-board session and five-star history survive the shorter route',async()=>{
 const p=freshChess();await act(p,'settings',{band:'foundations'});await act(p,'start',{lesson:'learn-rook-1'});p.session.ids=FOUNDATIONS.learnRook.slice(0,5).map(x=>x.id);p.session.index=4;p.session.results=p.session.ids.slice(0,4).map(id=>({id,independent:true}));await act(p,'begin');assert.equal(publicChess(p).session.total,5);let u=PUZZLES[p.session.ids[4]].line[0];await act(p,'move',{from:u.slice(0,2),to:u.slice(2)});await act(p,'next');assert.equal(p.completed['learn-rook-1'].best,5);
 await act(p,'start',{lesson:'learn-rook-1'});await act(p,'begin');for(let i=0;i<3;i++){u=PUZZLES[p.session.ids[i]].line[0];await act(p,'move',{from:u.slice(0,2),to:u.slice(2)});await act(p,'next');}assert.equal(p.completed['learn-rook-1'].best,5);assert.equal(p.completed['learn-rook-1'].bestTotal,5);
});


test('An unfinished legacy star lesson keeps a matching star demonstration',async()=>{
 const p=freshChess();await act(p,'settings',{band:'foundations'});await act(p,'start',{lesson:'learn-bishop-2'});
 assert(!publicChess(p).session.example.target);
 p.session.ids=FOUNDATIONS.learnBishop.slice(5,10).map(x=>x.id);
 assert(publicChess(p).session.example.target);assert(publicChess(p).session.puzzle.target);
});
