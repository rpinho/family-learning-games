import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../public/chess/rules.mjs';
import {BRIDGE_UNITS} from '../public/chess/bridge-curriculum.mjs';
import {STEP_UNITS,STEP_LESSONS} from '../public/chess/steps-curriculum.mjs';
import {STEPS,STEP_EXAMPLES} from '../chess-steps.mjs';
import {freshChess,actChess,lessonPuzzles,PUZZLES} from '../chess-state.mjs';
import {pathProgress} from '../public/chess/path.mjs';

const act=(p,type,extra={})=>actChess(p,{type,...extra,revision:p.revision,requestId:crypto.randomUUID()});
const move=(p,u)=>act(p,'move',{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});

test('The longer bridge retains its 54 full-board lessons and separate examples',()=>{
 assert.equal(BRIDGE_UNITS.length,18);
 assert.equal(STEP_UNITS.length,54);
 assert.equal(STEP_LESSONS.length,162);
 const practice=BRIDGE_UNITS.flatMap(u=>STEPS[u.theme]);
 const bridgeLessons=STEP_LESSONS.filter(l=>BRIDGE_UNITS.includes(STEP_UNITS[l.unit]));
 const examples=bridgeLessons.map(l=>STEP_EXAMPLES[l.id]);
 assert.equal(practice.length,270);
 assert.equal(examples.length,54);
 assert.equal(new Set(practice.map(p=>p.id)).size,270);
 assert.equal(new Set(practice.map(p=>p.fen)).size,270);
 for(const p of [...practice,...examples]){
  assert.equal(p.original,false);
  assert.match(p.sourceId,/^[\w-]{5,}$/);
  assert(Number.isFinite(p.rating));
  const b=new Chess(p.fen);
  for(const u of p.line)b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
  if(p.terminal)assert.equal(b.isCheckmate(),true,p.id);
 }
});

test('Existing completions unlock short real-board practice without changing an active old lesson',()=>{
 const p=freshChess();p.settings.band='steps';
 for(const l of STEP_LESSONS.slice(0,54))p.completed[l.id]={times:1,best:4,bestTotal:5,band:'steps'};
 const active={id:'kept',lesson:'steps-mate-net-3',band:'steps',ids:lessonPuzzles('steps-mate-net-3','steps'),index:4,ply:0,hints:0,errors:0,results:[],phase:'puzzle'};
 p.session=structuredClone(active);
 const path=pathProgress(p);
 assert.equal(path.find(x=>x.current).id,'steps-board-loose-1');
 assert.equal(path.filter(x=>x.complete).length,54);
 assert.deepEqual(p.session,active);
 assert.equal(lessonPuzzles('steps-real-fork-1','steps').length,5);
});

test('A full bridge lesson plays its validated multi-move lines and records progress',async()=>{
 const lesson='steps-real-fork-1',p=freshChess();p.settings.band='steps';
 await act(p,'start',{lesson});await act(p,'begin');
 for(let position=0;position<5;position++){
  const puzzle=PUZZLES[p.session.ids[p.session.index]];
  for(let ply=0;ply<puzzle.line.length;ply+=2){
   const result=await move(p,puzzle.line[ply]);assert.equal(result.correct,true,puzzle.id);
  }
  assert.equal(p.session.phase,'solved');await act(p,'next');
 }
 assert.equal(p.session.phase,'summary');
 assert.equal(p.completed[lesson].best,5);
 assert.equal(p.completed[lesson].bestTotal,5);
});
