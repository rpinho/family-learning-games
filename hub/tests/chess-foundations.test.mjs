import test from 'node:test';import assert from 'node:assert/strict';
import {FOUNDATIONS,FOUNDATION_EXAMPLES,foundationGoal} from '../chess-foundations.mjs';
import {FOUNDATION_LESSONS} from '../public/chess/foundations-curriculum.mjs';
import {freshChess,actChess,publicChess,PUZZLES,lessonPuzzles} from '../chess-state.mjs';
import {Chess} from '../public/chess/rules.mjs';
import {createNarrationGate,narrationFor} from '../public/chess/narration.mjs';
const act=(p,type,x={})=>actChess(p,{type,...x,revision:p.revision,requestId:crypto.randomUUID()});
test('First moves teaches legal sparse boards and separate demonstrations',async()=>{
 assert.equal(Object.values(FOUNDATIONS).flat().length,90);
 for(const puzzle of [...Object.values(FOUNDATIONS).flat(),...Object.values(FOUNDATION_EXAMPLES)]){
  const b=new Chess(puzzle.fen),king=b.board().flat().find(x=>x?.type==='k'&&x.color==='b');
  assert.equal(b.isCheck(),false,puzzle.id);assert.equal(b.isAttacked(king.square,'w'),false,puzzle.id);
  const m=b.move({from:puzzle.line[0].slice(0,2),to:puzzle.line[0].slice(2)});assert.ok(foundationGoal(puzzle,b,m),puzzle.id);
 }
 const p=freshChess();await act(p,'settings',{band:'foundations'});
 for(const lesson of FOUNDATION_LESSONS){
  await act(p,'start',{lesson:lesson.id});assert.ok(publicChess(p).session.example);
  assert.ok(lessonPuzzles(lesson.id,'foundations').every(id=>PUZZLES[id].fen!==FOUNDATION_EXAMPLES[lesson.id].fen));
  await act(p,'begin');for(let i=0;i<5;i++){const puzzle=PUZZLES[p.session.ids[i]],u=puzzle.line[0];await act(p,'move',{from:u.slice(0,2),to:u.slice(2)});assert.equal(p.session.phase,'solved');await act(p,'next');}assert.ok(p.completed[lesson.id]);
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
