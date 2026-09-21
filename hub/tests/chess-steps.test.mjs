import test from 'node:test';import assert from 'node:assert/strict';
import {Chess} from '../public/chess/rules.mjs';
import {STEPS,STEP_EXAMPLES,meetsStepGoal} from '../chess-steps.mjs';
import {STEP_LESSONS,STEP_UNITS} from '../public/chess/steps-curriculum.mjs';
import {freshChess,actChess,publicChess,PUZZLES,lessonPuzzles} from '../chess-state.mjs';
import {pathProgress} from '../public/chess/path.mjs';
const act=(p,type,extra={})=>actChess(p,{type,...extra,revision:p.revision,requestId:crypto.randomUUID()});
const move=(p,u)=>act(p,'move',{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
test('All 60 original practice boards and 12 examples are sparse, legal and teach the stated goal',()=>{
 const practices=Object.values(STEPS).flat().filter(p=>p.id.startsWith("small-"));assert.equal(practices.length,60);assert.equal(new Set(practices.map(p=>p.fen)).size,60);
 for(const p of [...practices,...Object.values(STEP_EXAMPLES).filter(p=>p.id.startsWith("small-"))]){
  const b=new Chess(p.fen),pieces=b.board().flat().filter(Boolean);assert.ok(pieces.length<=5);
  assert.equal(b.isCheck(),false);assert.equal(b.isAttacked(pieces.find(x=>x.type==='k'&&x.color==='b').square,'w'),false);
  assert.ok([1,3].includes(p.line.length));
  for(const [i,u] of p.line.entries()){
   const m=b.move({from:u.slice(0,2),to:u.slice(2,4)});
   if(i===0)assert.ok(meetsStepGoal(p,b,m),p.id);
   if(i===2)assert.equal(m.captured,'r');
  }
 }
 for(const l of STEP_LESSONS){const ids=lessonPuzzles(l.id,'steps');assert.equal(ids.length,5);assert.ok(ids.every(id=>PUZZLES[id].fen!==STEP_EXAMPLES[l.id].fen),'example differs from all own practice boards');}
});
test('Every short lesson can be completed without help; examples never count as solved positions',async()=>{
 const p=freshChess();await act(p,'settings',{band:'steps'});assert.equal(p.session.phase,'intro');assert.deepEqual(p.completed,{});
 for(const l of STEP_LESSONS){
  await act(p,'start',{lesson:l.id});const pub=publicChess(p);assert.ok(pub.session.example);assert.equal(pub.session.puzzle.line,undefined);await act(p,'begin');
  while(p.session.phase!=='summary'){
   if(p.session.phase==='puzzle')await move(p,PUZZLES[p.session.ids[p.session.index]].line[p.session.ply]);else await act(p,'next');
  }
  assert.equal(p.completed[l.id].best,5);assert.equal(p.history.at(-1).total,5);
 }
 assert.equal(p.history.length,STEP_LESSONS.length);assert.equal(pathProgress(p).filter(l=>l.complete).length,STEP_LESSONS.length);
});
test('All legal alternatives meeting the one-move goal succeed; other legal moves return without changing the board',async()=>{
 for(const puzzle of Object.values(STEPS).flat().filter(p=>p.original&&p.line.length===1)){
  const board=new Chess(puzzle.fen);
  for(const m of board.moves({verbose:true})){
   const b=new Chess(puzzle.fen),played=b.move(m),expected=meetsStepGoal(puzzle,b,played);
   const p=freshChess();p.settings.band='steps';p.session={id:'test',lesson:STEP_LESSONS.find(l=>lessonPuzzles(l.id,'steps').includes(puzzle.id)).id,band:'steps',ids:[puzzle.id],index:0,ply:0,hints:0,errors:0,results:[],phase:'puzzle'};
   const r=await move(p,m.from+m.to);assert.equal(r.correct,expected,puzzle.id+' '+m.san);
   if(expected){assert.equal(p.session.phase,'solved');assert.equal(publicChess(p).session.puzzle.fen,b.fen());}
   else {assert.equal(p.session.ply,0);assert.equal(publicChess(p).session.puzzle.fen,puzzle.fen);}
  }
 }
});
test('Changing levels immediately replaces the current board, preserves prior work and can restore paused lessons',async()=>{
 const p=freshChess();await act(p,'start',{lesson:'forcing-1'});await act(p,'begin');await act(p,'hint');const old=structuredClone(p.session);
 p.completed['forcing-2']={best:3,times:1};const completed=structuredClone(p.completed);
 await act(p,'settings',{band:'steps'});assert.equal(p.session.band,'steps');assert.deepEqual(p.pausedLessons.stretch,old);assert.deepEqual(p.completed,completed);
 assert.ok(pathProgress(p).every(x=>x.id.startsWith('steps-')));assert.equal(pathProgress(p)[0].current,true);await act(p,'begin');await move(p,PUZZLES[p.session.ids[0]].line[0]);const small=structuredClone(p.session);
 await act(p,'settings',{band:'stretch'});assert.deepEqual(p.session,old);
 await act(p,'settings',{band:'steps'});assert.deepEqual(p.session,small);assert.deepEqual(p.completed,completed);
});
test('Same-value Guided setting repairs a legacy harder resumable lesson; small-step review stays in its own band',async()=>{
 const p=freshChess();await act(p,'start',{lesson:'forcing-1'});p.settings.band='guided';await act(p,'settings',{band:'guided'});assert.equal(p.session.band,'guided');
 await act(p,'settings',{band:'steps'});await act(p,'begin');await act(p,'hint');await move(p,PUZZLES[p.session.ids[0]].line[0]);assert.equal(p.session.results[0].independent,false);
 await act(p,'start',{lesson:'review'});assert.ok(p.session.ids.every(id=>PUZZLES[id].original));
});

test('Later Small steps placement highlights its lesson and leaves easier lessons available without awarding them',async()=>{
 const p=freshChess();await act(p,'settings',{band:'steps'});await act(p,'start',{lesson:'steps-fork-1'});const path=pathProgress(p);assert.equal(path.find(l=>l.current).id,'steps-fork-1');assert.ok(path.slice(0,10).every(l=>!l.locked));assert.equal(path[10].locked,true);assert.deepEqual(p.completed,{});
});

test('Safe-check contrast demonstrates a legal capture, then a safe check on a separate example',()=>{
 const e=STEP_EXAMPLES['steps-check-3'],b=new Chess(e.fen);
 const bad=b.move({from:e.contrast.line[0].slice(0,2),to:e.contrast.line[0].slice(2,4)});
 assert.equal(b.isCheck(),true);assert.equal(meetsStepGoal(e,b,bad),false);
 const reply=b.move({from:e.contrast.line[1].slice(0,2),to:e.contrast.line[1].slice(2,4)});
 assert.equal(reply.captured,'b');assert.equal(reply.to,bad.to);assert.equal(reply.piece,'r');
 const safe=new Chess(e.fen),move=safe.move({from:e.line[0].slice(0,2),to:e.line[0].slice(2,4)});
 assert.ok(meetsStepGoal(e,safe,move));
 assert.ok(lessonPuzzles('steps-check-3','steps').every(id=>PUZZLES[id].fen!==e.fen));
});
test('First safe-check cue locates the opponent king without revealing the moving piece or destination',async()=>{
 for(const id of lessonPuzzles('steps-check-3','steps')){
  const p=freshChess();await act(p,'settings',{band:'steps'});await act(p,'start',{lesson:'steps-check-3'});await act(p,'begin');
  p.session.ids=[id];const before=publicChess(p).session.puzzle.fen;
  await act(p,'hint');const s=publicChess(p).session,b=new Chess(before);
  assert.equal(s.puzzle.task,'Check safely');assert.equal(b.get(s.hintKing).type,'k');assert.notEqual(b.get(s.hintKing).color,b.turn());
  assert.equal(s.hintFrom,undefined);assert.equal(s.hintTo,undefined);assert.equal(s.puzzle.line,undefined);assert.equal(s.puzzle.fen,before);
  assert.match(s.feedback.voice,/Find their king/);assert.match(s.feedback.voice,/row or a column|diagonal/);
  await move(p,PUZZLES[id].line[0]);assert.equal(p.session.results[0].independent,false);
 }
});
test('An unsafe check explains a legal reply and preserves the starting board and existing achievements',async()=>{
 const p=freshChess();await act(p,'settings',{band:'steps'});await act(p,'start',{lesson:'steps-check-3'});await act(p,'begin');
 const id=lessonPuzzles('steps-check-3','steps')[1];p.session.ids=[id];p.completed['steps-check-1']={best:5,times:1};
 const completed=structuredClone(p.completed),before=publicChess(p).session.puzzle.fen,b=new Chess(before);
 const bad=b.moves({verbose:true}).find(m=>{const t=new Chess(before);t.move(m);return t.isCheck()&&!meetsStepGoal(PUZZLES[id],t,m);});
 const result=await move(p,bad.from+bad.to);assert.equal(result.correct,false);
 const s=publicChess(p).session;assert.equal(s.feedback.reason,'unsafe-check');assert.equal(s.puzzle.fen,before);assert.equal(s.errors,1);assert.equal(s.hints,0);assert.deepEqual(p.completed,completed);
 for(const u of s.feedback.refutation)b.move({from:u.slice(0,2),to:u.slice(2,4)});
 assert.equal(b.get(bad.to).color,'b');assert.equal(p.session.phase,'puzzle');
 await move(p,PUZZLES[id].line[0]);assert.equal(p.session.phase,'solved');assert.equal(p.session.results[0].independent,false);
});
