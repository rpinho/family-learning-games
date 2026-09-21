import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../public/chess/rules.mjs';
import {PRACTICE_UNITS} from '../public/chess/practice-curriculum.mjs';
import {BRIDGE_UNITS} from '../public/chess/bridge-curriculum.mjs';
import {STEP_UNITS,STEP_LESSONS,STEP_VOICE} from '../public/chess/steps-curriculum.mjs';
import {STEPS,STEP_EXAMPLES} from '../chess-steps.mjs';
import {freshChess,actChess,publicChess,lessonPuzzles} from '../chess-state.mjs';
import {pathProgress} from '../public/chess/path.mjs';
import {narrationFor,createNarrationGate} from '../public/chess/narration.mjs';
import {demonstrationMoves,drawTeachingOverlay} from '../public/chess/teaching.mjs';

const act=(p,type,extra={})=>actChess(p,{type,...extra,revision:p.revision,requestId:crypto.randomUUID()});
const move=(p,u)=>act(p,'move',{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
const play=(b,u)=>b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
const lessons=STEP_LESSONS.filter(l=>PRACTICE_UNITS.includes(STEP_UNITS[l.unit]));

test('Demonstrations promote legally and identify the learner for either color',()=>{
 let promotions=0,black=0;
 for(const l of lessons){
  const example=STEP_EXAMPLES[l.id];let ply=0;
  for(const step of demonstrationMoves(example)){
   assert.equal(step.learner,ply%2===0);assert.equal(step.uci,example.line[ply++]);
   if(step.move.promotion){promotions++;assert.equal(step.board.get(step.move.to).type,step.move.promotion);}
   if(step.learner&&step.move.color==='b')black++;
  }
  assert.equal(ply,example.line.length);
 }
 assert(promotions>=6);assert(black>0);
});

test('A Black learner gets the same two-target teaching diagram as White',()=>{
 const b=new Chess('6k1/8/8/8/8/8/1q6/R3K3 b - - 0 1');
 const move=b.move({from:'b2',to:'b1'});let svg='',heading={};
 const host={getBoundingClientRect:()=>({left:0,top:0,width:800,height:800}),insertAdjacentHTML:(_,html)=>svg=html};
 const root={querySelector:selector=>selector==='.teaching-overlay'?null:selector==='.board-coordinates'?host:selector==='.arena-prompt h1'?heading:{getBoundingClientRect:()=>({left:100,top:100,width:100,height:100})}};
 drawTeachingOverlay(root,b,move,{});
 assert.match(svg,/fork-diagram/);assert.match(heading.innerHTML,/two targets/);
});

test('Short real-board practice supplies 54 lessons with new, bounded, validated positions',()=>{
 assert.equal(PRACTICE_UNITS.length,18);assert.equal(lessons.length,54);
 const all=[...PRACTICE_UNITS.flatMap(u=>STEPS[u.theme]),...lessons.map(l=>STEP_EXAMPLES[l.id])];
 assert.equal(all.length,324);
 const old=new Set([...Object.values(STEPS).flat(),...Object.values(STEP_EXAMPLES)]
   .filter(p=>!p.id.startsWith('practice-')).map(p=>p.fen.split(' ')[0]));
 const layouts=new Set(),sources=new Set();
 for(const u of PRACTICE_UNITS)for(const p of [...STEPS[u.theme],...lessons.filter(l=>STEP_UNITS[l.unit]===u).map(l=>STEP_EXAMPLES[l.id])]){
  assert(p.tags.includes(u.sourceTheme));assert(p.rating>=450&&p.rating<=1100);
  assert(p.popularity>=90&&p.plays>=300&&p.deviation<=85);
  assert(!old.has(p.fen.split(' ')[0]),p.id);assert(!layouts.has(p.fen.split(' ')[0]),p.id);
  assert(!sources.has(p.sourceId));layouts.add(p.fen.split(' ')[0]);sources.add(p.sourceId);
  const b=new Chess(p.setupFen);play(b,p.setupMove);assert.equal(b.fen(),p.fen);
  assert(b.board().flat().filter(Boolean).length<=16);assert([1,3].includes(p.line.length));
  assert.equal(p.checks.length,Math.ceil(p.line.length/2));
  for(const c of p.checks)assert(c.immediateMate||c.gap>=65);
  for(const line of p.line)play(b,line);
  assert.equal(b.isCheckmate(),p.terminal);
 }
});

test('Previously reached bridge lessons stay available and current work is never rewritten',()=>{
 const p=freshChess();p.settings.band='steps';
 p.completed['steps-real-fork-1']={times:1,best:3,bestTotal:5,band:'steps'};
 p.session={id:'old-board',lesson:'steps-real-fork-2',phase:'puzzle',band:'steps',ids:lessonPuzzles('steps-real-fork-2','steps'),index:2,ply:2,hints:1,errors:0,results:[]};
 const snapshot=structuredClone(p),path=pathProgress(p);
 assert.equal(path.find(l=>l.current).id,'steps-real-fork-2');
 assert(path.filter(l=>l.id.startsWith('steps-board-')).every(l=>!l.locked));
 assert.deepEqual(p,snapshot);
 const previous=STEP_UNITS.filter(u=>!PRACTICE_UNITS.includes(u));
 assert.equal(previous.length,36);assert.deepEqual(previous.slice(18),BRIDGE_UNITS);
});

test('Real-board continuations teach the actual task without the knight-only instruction',async()=>{
 for(const u of PRACTICE_UNITS){
  const puzzle=STEPS[u.theme].find(p=>p.line.length===3);if(!puzzle)continue;
  const lesson=lessons.find(l=>lessonPuzzles(l.id,'steps').includes(puzzle.id));
  const p=freshChess();p.settings.band='steps';await act(p,'start',{lesson:lesson.id});await act(p,'begin');p.session.ids=[puzzle.id];
  await move(p,puzzle.line[0]);const pub=publicChess(p);
  assert.equal(pub.session.puzzle.sourceId,puzzle.sourceId);assert.equal(pub.session.puzzle.line,undefined);
  const cue=narrationFor('move',pub,'');
  assert.equal(cue.text,puzzle.terminal?STEP_VOICE.finishMate:STEP_VOICE.continueLine);
  assert.doesNotMatch(cue.text,/knight|rook/);
  const gate=createNarrationGate();assert(gate(cue.text,cue));assert.equal(gate(cue.text,cue),false);
  pub.session.feedback.kind='incorrect';assert.equal(narrationFor('move',pub,''),null);
  await act(p,'hint');await move(p,puzzle.line[2]);assert.equal(p.session.results[0].independent,false);
 }
});

test('An alternative legal mate keeps the actual final board and move in the saved recap',async()=>{
 let found=false;
 for(const u of PRACTICE_UNITS)for(const puzzle of STEPS[u.theme].filter(p=>p.line.length===1&&p.terminal)){
  const b=new Chess(puzzle.fen),alternative=b.moves({verbose:true}).find(m=>m.san.includes('#')&&m.from+m.to+(m.promotion||'')!==puzzle.line[0]);
  if(!alternative)continue;
  found=true;const lesson=lessons.find(l=>lessonPuzzles(l.id,'steps').includes(puzzle.id));
  const p=freshChess();p.settings.band='steps';await act(p,'start',{lesson:lesson.id});await act(p,'begin');p.session.ids=[puzzle.id];
  const uci=alternative.from+alternative.to+(alternative.promotion||'');
  assert.equal((await move(p,uci)).correct,true);b.move(alternative);
  const pub=publicChess(JSON.parse(JSON.stringify(p)));
  assert.equal(pub.session.puzzle.fen,b.fen());assert.deepEqual(p.session.actualLine,[uci]);
  assert.match(pub.session.solution[0].text,new RegExp(alternative.to,'i'));
  assert.equal(p.session.results[0].independent,true);break;
 }
 assert(found,'the fixture pool contains a different legal mating move');
});
