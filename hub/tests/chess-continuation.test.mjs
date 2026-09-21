import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../public/chess/rules.mjs';
import {STEPS,STEP_EXAMPLES} from '../chess-steps.mjs';
import {STEP_UNITS,STEP_LESSONS} from '../public/chess/steps-curriculum.mjs';
import {freshChess,actChess,publicChess,PUZZLES} from '../chess-state.mjs';
import {pathProgress} from '../public/chess/path.mjs';
import {narrationFor,createNarrationGate} from '../public/chess/narration.mjs';
const act=(p,type,extra={})=>actChess(p,{type,...extra,revision:p.revision,requestId:crypto.randomUUID()});
const play=(b,u)=>b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
const move=(p,u)=>act(p,'move',{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
const extra=Object.values(STEPS).flat().filter(p=>p.id.startsWith('continuation-'));
test('Fourteen sparse continuation units remain intact ahead of the full-board bridge',()=>{
 assert.equal(STEP_UNITS.length,36);assert.equal(STEP_LESSONS.length,108);assert.equal(extra.length,210);
 const examples=Object.values(STEP_EXAMPLES).filter(p=>p.id.startsWith('continuation-'));
 assert.equal(examples.length,42);const all=[...extra,...examples];assert.equal(new Set(all.map(p=>p.fen)).size,252);
 for(const p of all){const b=new Chess(p.fen);assert.equal(b.isCheck(),false);const pieces=b.board().flat().filter(Boolean);assert(pieces.length<=7);
  assert.equal(b.isAttacked(pieces.find(x=>x.type==='k'&&x.color==='b').square,'w'),false);
  for(const u of p.line)play(b,u);
  if(['stepsMateTwo','stepsMateNet'].includes(p.theme))assert(b.isCheckmate());
 }
});
test('A learner who finished the original course gets unit 5 immediately, with old work untouched',()=>{
 const p=freshChess();p.settings.band='steps';for(const l of STEP_LESSONS.slice(0,12))p.completed[l.id]={times:1,best:4};
 p.session={lesson:'review',phase:'summary'};const before=structuredClone(p);const path=pathProgress(p);
 assert.equal(path.find(x=>x.current).id,'steps-value-1');assert.equal(path.filter(x=>x.complete).length,12);assert.equal(path.filter(x=>x.locked).length,95);assert.deepEqual(p,before);
});
test('Two-move drills force their goal against EVERY legal reply, with no immediate mate shortcut',()=>{
 for(const p of [...extra,...Object.values(STEP_EXAMPLES)].filter(p=>p.nextLines)){
  const start=new Chess(p.fen);assert(!start.moves({verbose:true}).some(m=>m.san.includes('#')));
  for(const [first,branch]of Object.entries(p.nextLines)){
   const b=new Chess(p.fen);play(b,first);assert(b.isCheck());const replies=b.moves({verbose:true});assert(replies.length);
   assert(replies.some(m=>m.from+m.to===branch.reply));
   for(const reply of replies){b.move(reply);const finishes=b.moves({verbose:true}).filter(end=>{
    if(!p.terminal&&(end.captured!=='r'||p.theme.endsWith('Win')&&end.from!==first.slice(2,4)))return false;
    b.move(end);const goal=['stepsMateTwo','stepsMateNet'].includes(p.theme)?b.isCheckmate():!b.moves({verbose:true}).some(r=>r.to===end.to&&r.captured);b.undo();return goal;
   });assert(finishes.length,`${p.id}: ${first}, ${reply.san}`);b.undo();}
  }
 }
});
test('Alternative first checks and finishes survive reload, hints, rollback and solved-board replay',async()=>{
 for(const puzzle of extra.filter(p=>p.nextLines))for(const [first,branch]of Object.entries(puzzle.nextLines))for(const finish of branch.finishes){
  let p=freshChess();p.settings.band='steps';p.session={id:'continuation-test',lesson:['stepsMateTwo','stepsMateNet'].includes(puzzle.theme)?'steps-mate-two-1':'steps-skewer-1',band:'steps',ids:[puzzle.id],index:0,ply:0,hints:0,errors:0,results:[],phase:'puzzle'};
  assert.equal((await move(p,first)).correct,true);p=JSON.parse(JSON.stringify(p));let pub=publicChess(p);assert.equal(pub.session.phase,'puzzle');assert.equal(pub.session.puzzle.nextLines,undefined);assert.equal(pub.session.puzzle.line,undefined);
  const b=new Chess(puzzle.fen);play(b,first);play(b,branch.reply);assert.equal(pub.session.puzzle.fen,b.fen());
  const bad=b.moves({verbose:true}).find(m=>!branch.finishes.includes(m.from+m.to));
  if(bad){assert.equal((await move(p,bad.from+bad.to)).correct,false);assert.equal(publicChess(p).session.puzzle.fen,b.fen());}
  await act(p,'hint');assert.match(publicChess(p).session.feedback.voice,['stepsMateTwo','stepsMateNet'].includes(puzzle.theme)?/checkmate/:/rook safely/);
  assert.equal((await move(p,finish)).correct,true);play(b,finish);pub=publicChess(p);assert.equal(pub.session.puzzle.fen,b.fen());assert.equal(pub.session.solution.length,3);assert.equal(pub.session.results[0].independent,false);
  await act(p,'next');assert.equal(p.session.phase,'summary');
 }
});
test('Two-move narration uses the current task, not the old knight-only prompt',()=>{
 const p={session:{band:'steps',phase:'puzzle',ply:2,lesson:'steps-mate-two-1',puzzle:{task:'Find checkmate'}}};assert.match(narrationFor('move',p,'').text,/checkmate/);
 p.session.lesson='steps-skewer-1';p.session.puzzle.task='Take the rook';assert.match(narrationFor('move',p,'').text,/rook safely/);
});

test('A changed two-move task can speak promptly, without repeating on every attempt',()=>{
 let time=0;const gate=createNarrationGate(()=>time);assert(gate('Check the king.',{kind:'automatic'}));time=1000;assert(gate('Now find checkmate.',{kind:'continuation'}));time=2000;assert.equal(gate('Now find checkmate.',{kind:'continuation'}),false);
 const p={session:{band:'steps',phase:'puzzle',ply:2,lesson:'steps-mate-two-1',puzzle:{task:'Find checkmate'},feedback:{kind:'incorrect'}}};assert.equal(narrationFor('move',p,''),null);
});

test('A safe rook fork may include the king, including a capturing check',async()=>{
 for(const [id,to] of [['continuation-steps-rook-fork-4','a3'],['continuation-steps-rook-fork-6','d4']]){
  const puzzle=PUZZLES[id],b=new Chess(puzzle.fen);const candidate=b.moves({verbose:true}).find(m=>m.to===to&&m.piece==='r');assert(candidate);b.move(candidate);assert.equal(b.isCheck(),true);
  const p=freshChess();p.settings.band='steps';p.session={id:'rook-fork-test',lesson:'steps-rook-fork-1',band:'steps',ids:[id],index:0,ply:0,hints:0,errors:0,results:[],phase:'puzzle'};
  const r=await move(p,candidate.from+candidate.to);assert.equal(r.correct,true);assert.equal(p.session.phase,'solved');assert.equal(p.session.results[0].independent,true);
 }
});
