import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {mazeOpen} from '../public/maze.mjs';
import {newPuzzle,puzzleBase,puzzleBoard,puzzleReady,puzzleLever,puzzleClue,puzzleAction,solveBlocks,puzzleTier,puzzleLine,PUZZLE_LINES} from '../public/rescue-puzzles.mjs';
import {rescueMovementView,rescueFinishView,rescueShouldSpeak} from '../public/rescue-view.mjs';
test('Repeated rescue Undo stays silent without muting help or mission instructions',()=>{
 for(let tap=0;tap<30;tap++)assert.equal(rescueShouldSpeak({kind:'undo'}),false);
 for(const kind of ['repeat','help','next','resume','plan','forward'])assert.equal(rescueShouldSpeak({kind}),true);
});
const act=(p,kind,extra={})=>puzzleAction(p,{kind,mission:p.rescue.mission,...extra});
test('Open puzzle exit names missing friends without wall penalties; all friends allow completion',()=>{
 for(const id of ['beginner','explorer'])for(const serial of [0,1,2]){
  const p=freshProfile(id);p.rescue=newPuzzle(p,serial+1,{puzzleSerial:serial});
  const b=puzzleBase(p.rescue);
  Object.assign(p.rescue,{phase:'explore',opened:b.switches.map(v=>v.color),crates:[...b.pads],badges:4});
  for(const rescued of [[],b.friends.slice(1)])for(const position of [b.exit+b.size,b.exit]){
   Object.assign(p.rescue,{rescued:[...rescued],position,direction:0});
   const before=structuredClone(p.rescue);
   assert.equal(puzzleBoard(p).grid[0][b.exit],0);
   assert.deepEqual(act(p,'forward'),{kind:'exit-needs-friend',line:b.friends.length-rescued.length===1?PUZZLE_LINES.missingFriend:PUZZLE_LINES.missingFriends});
   assert.deepEqual(p.rescue,before,'no changed progress, blocked count or Undo snapshot');
   act(p,'turn',{turn:1});assert.equal(p.rescue.direction,1);
  }
  Object.assign(p.rescue,{rescued:[...b.friends],phase:'exit',position:b.exit+b.size,direction:0});
  assert.equal(act(p,'forward').kind,'complete');assert.equal(p.rescue.badges,5);
 }
});
test('Completion has one primary next-rescue action; stopping is not adjacent to it',()=>{
 for(const engine of [1,2]){
  const s={engine,phase:'done',badges:4},before=JSON.stringify(s),html=rescueFinishView(s,{emoji:'🐢',name:'Turtle'});
  assert.equal((html.match(/<button/g)||[]).length,1);assert.match(html,/class="button primary rescue-next"/);assert.match(html,/data-rescue="next"/);assert.match(html,/Another rescue/);assert.doesNotMatch(html,/data-rescue="leave"|Finish for now/);assert.match(html,/☰ menu/);assert.equal(JSON.stringify(s),before);
  assert.match(rescueFinishView(s,{emoji:'🐢',name:'Turtle'},true),/disabled/);
 }
});
function step(p,d){while(p.rescue.direction!==d)act(p,'turn',{turn:1});return act(p,'forward');}
test('The exit objective speaks on transition, not on every walk; replay and saved routes retain it',()=>{
 for(const serial of [0,1,2]){
  let p=freshProfile('admin');p.rescue=newPuzzle(p,serial+1,{puzzleSerial:serial});
  const results=[];let exitMoves=0,reloaded=false;
  if(p.rescue.phase==='plan')act(p,'plan',{card:puzzleBase(p.rescue).friends.at(-1)});
  if(p.rescue.type==='blocks')for(const d of solveBlocks(p.rescue,50000))results.push(step(p,d));
  for(let i=0;i<500&&p.rescue.phase!=='done';i++){
   if(puzzleLever(p)){results.push(act(p,'rook'));continue;}
   if(p.rescue.phase==='exit'){
    exitMoves++;
    assert.equal(puzzleLine(p),PUZZLE_LINES.exit,'manual replay keeps the current objective');
    if(!reloaded){
     const board=puzzleBoard(p),detour=mazeOpen(board,p.rescue.position).find(v=>v.position!==board.exit);
     assert.ok(detour);results.push(step(p,detour.direction));
     p=JSON.parse(JSON.stringify(p));reloaded=true;assert.ok(act(p,'help').line,'requested help remains available');
    }
   }
   results.push(step(p,puzzleClue(p).absolute));
  }
  assert.equal(p.rescue.phase,'done');assert.ok(exitMoves>1,'exercise a multi-step return to the exit');
  assert.equal(results.filter(r=>r.line===PUZZLE_LINES.exit).length,1,'announce the new objective once');
  assert.equal(results.filter(r=>r.kind==='complete').length,1);
  assert.equal(p.rescue.badges,1);assert.equal(p.rescue.history.length,1);
 }
});
function solve(p){
 const s=p.rescue;
 if(s.phase==='plan')act(p,'plan',{card:puzzleBase(s).friends.at(-1)});
 if(s.type==='blocks'){const moves=solveBlocks(s,50000);assert.ok(moves.length,'block solution exists');for(const d of moves)step(p,d);assert.ok(puzzleReady(p.rescue));}
 for(let i=0;i<500&&p.rescue.phase!=='done';i++){
  if(puzzleLever(p)){act(p,'rook');continue;}
  const clue=puzzleClue(p);assert.ok(clue,`route exists: ${JSON.stringify(p.rescue)}`);step(p,clue.absolute);
 }
 assert.equal(p.rescue.phase,'done',JSON.stringify(p.rescue));
}
test('90 varied puzzles are solvable with switches, real block pushes and route choices',()=>{
 const geometries=new Set(),blockConfigs=new Set();
 for(const id of ['beginner','explorer'])for(let mission=1;mission<=45;mission++){
  const p=freshProfile(id);p.rescue=newPuzzle(p,mission,{puzzleSerial:mission-1});
  if(mission>36){p.rescue.tier=3;const b=puzzleBase(p.rescue);p.rescue.crates=[...b.crates];p.rescue.position=b.start;}
  const b=puzzleBase(p.rescue);geometries.add(JSON.stringify(b.grid));if(p.rescue.type==='blocks')blockConfigs.add(JSON.stringify([b.pads,b.crates]));
  solve(p);assert.equal(p.rescue.badges,1);assert.equal(p.xp,0);assert.equal(p.rescue.history[0].engine,2);
  assert.throws(()=>act(p,'forward'));assert.equal(p.rescue.badges,1);
 }
 assert.ok(geometries.size>30,geometries.size);assert.ok(blockConfigs.size>=6,blockConfigs.size);
});
test('Movement, pushes, switch state and rescue collection undo, pause/reload and hints preserve rewards',()=>{
 const p=freshProfile('explorer');p.rescue=newPuzzle(p,2,{puzzleSerial:1});
 const solution=solveBlocks(p.rescue);const before=structuredClone(p.rescue);step(p,solution[0]);act(p,'undo');assert.equal(p.rescue.position,before.position);assert.deepEqual(p.rescue.crates,before.crates);
 act(p,'pause');const saved=JSON.stringify(p);assert.throws(()=>act(p,'forward'));assert.equal(JSON.stringify(p),saved);
 const q=JSON.parse(saved);act(q,'resume');act(q,'help');solve(q);assert.equal(q.rescue.badges,1);assert.ok(q.rescue.history[0].helpCount>0);assert.equal(p.rescue.badges,0);
 assert.throws(()=>puzzleAction(q,{kind:'next',mission:900}));
});
test('Challenge adjusts per child and mechanic, not speed or cumulative legacy mission number',()=>{
 assert.equal(puzzleTier({id:'beginner'},'blocks'),1);assert.equal(puzzleTier({id:'explorer'},'blocks'),2);
 const wins=Array.from({length:2},()=>({engine:2,type:'blocks',tier:1,helpCount:0,undos:0,blocked:0}));
 assert.equal(puzzleTier({id:'beginner'},'blocks',wins),2);assert.equal(puzzleTier({id:'beginner'},'switches',wins),1);
 assert.equal(puzzleTier({id:'explorer'},'blocks',[{engine:2,type:'blocks',tier:3,helpCount:4,blocked:0}]),2);
 const p={id:'beginner'};assert.equal(newPuzzle(p,100,{history:[{mission:99,helpCount:0}]}).tier,1);
});
test('All three movement arrows stay present across phases; no pause/leave controls occupy that area',()=>{
 for(const engine of [1,2])for(const phase of ['plan','rook','reroute','key','friend','explore','exit','done'])for(const paused of [false,true]){
  const html=rescueMovementView({engine,phase,paused});assert.equal((html.match(/<button/g)||[]).length,3);
  for(const label of ['Turn left','Walk forward','Turn right'])assert.ok(html.includes(label));
  assert.doesNotMatch(html,/data-rescue="(?:pause|leave|menu)"/);
  if(paused||phase==='done')assert.equal((html.match(/disabled/g)||[]).length,3);
 }
 const rook=rescueMovementView({phase:'rook',paused:false});assert.match(rook,/Choose with Rook above/);assert.equal((rook.match(/disabled/g)||[]).length,3);
});
test('Trail plan retains the selected friend and stops asking to choose after refresh',()=>{
 const p=freshProfile('beginner');p.rescue=newPuzzle(p,3,{puzzleSerial:2});const b=puzzleBase(p.rescue);assert.ok(b.friends.length>=2);
 const chosen=b.friends.at(-1);act(p,'plan',{card:chosen});const restored=JSON.parse(JSON.stringify(p));assert.equal(restored.rescue.plan[0],chosen);assert.equal(puzzleLine(restored),PUZZLE_LINES.explore);
});
