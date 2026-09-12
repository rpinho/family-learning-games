import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile} from '../public/engine.mjs';
import {mazeBoard,mazeState,mazeGate,mazeQuestion,mazeRoute,mazeOpen,mazeClue,mazeAction,mazeVoiceLines} from '../public/maze.mjs';
import {mazeMesh} from '../public/maze-renderer.mjs';
import {MAZE_THEMES,mazeTheme} from '../public/maze-themes.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
const answer=p=>{const q=mazeQuestion(p);if(q.type==='blend')for(let index=0;index<q.word.length;index++)mazeAction(p,{kind:'sound',questionId:q.id,index});return mazeAction(p,{kind:'answer',questionId:q.id,answer:q.answer});};
test('Each level changes world materials and has a truly open north exit with exterior ground',()=>{
 const worlds=new Set();
 for(let level=1;level<=48;level++){
  const p=freshProfile('explorer');p.maze={...mazeState(p),level};const b=mazeBoard(p);worlds.add(b.theme.id);
  assert.equal(b.exit,b.size-2);assert.equal(b.grid[0][b.size-2],0);assert.equal(b.grid[1][b.size-2],0);
  assert.notEqual(b.theme.id,mazeTheme(level+1).id);
  const mesh=mazeMesh(b);assert.ok(mesh.every(Number.isFinite));assert.ok(mesh.some((n,i)=>i%7===2&&n<0),'exterior geometry');
  // No wall triangles may span the opening above ground height.
  for(let i=0;i<mesh.length;i+=21){const xyz=[0,7,14].map(k=>[mesh[i+k],mesh[i+k+1],mesh[i+k+2]]);assert.ok(!xyz.every(([x,y,z])=>x>b.size-1.8&&x<b.size-1.2&&y>.2&&z>=0&&z<=1));}
 }
 assert.equal(worlds.size,MAZE_THEMES.length);
});
test('Generated mazes have branches, reachable exits, and only valid 3D triangles',()=>{
 for(const id of ['explorer','beginner'])for(let level=1;level<=30;level++){
  const p=freshProfile(id);p.maze={...mazeState(p),level};const b=mazeBoard(p),path=mazeRoute(b,b.start);
  assert.ok(path.length>2);assert.equal(path.at(-1),b.exit);assert.ok(b.size<=13);
  const floor=b.grid.flatMap((r,z)=>r.flatMap((v,x)=>v?[]:[z*b.size+x]));
  assert.ok(floor.some(pos=>mazeOpen(b,pos).length>=3));for(const pos of floor)assert.ok(mazeRoute(b,pos).length);
  assert.deepEqual(mazeBoard(JSON.parse(JSON.stringify(p))),b);
  if(level===1){const mesh=mazeMesh(b);assert.equal(mesh.length%21,0);assert.ok(mesh.length>1000);assert.ok(mesh.every(Number.isFinite));}
 }
});
test('Puzzles guard every new corner/junction, reveals turn directions, and escape rewards only once',()=>{
 for(const id of ['explorer','beginner']){
  const p=freshProfile(id),original=JSON.stringify(p);mazeBoard(p);mazeState(p);mazeQuestion(p);assert.equal(JSON.stringify(p),original);
  mazeAction(p,{kind:'enter'});const b=mazeBoard(p),before=p.revision;
  assert.equal(mazeAction(p,{kind:'forward'}).kind,'locked');assert.equal(p.revision,before);assert.equal(mazeClue(p),null);
  let solved=0,steps=0,earned=0;
  while(!p.maze.done){
   if(mazeGate(p)){const result=answer(p);assert.equal(result.ok,true);earned+=result.xp;solved++;assert.ok(mazeClue(p));}
   const direction=mazeClue(p).absolute,turn=(direction-p.maze.direction+4)%4;
   if(turn)mazeAction(p,{kind:'turn',turn:turn===3?-1:turn});
   assert.notEqual(mazeAction(p,{kind:'forward'}).kind,'wall');assert.ok(++steps<300);
  }
  assert.ok(solved>=2);assert.equal(p.gems,10);assert.equal(p.xp,earned+40);assert.deepEqual(p.skills,{});assert.equal(p.seq,0);
  assert.throws(()=>mazeAction(p,{kind:'forward'}));assert.throws(()=>answer(p));assert.equal(p.gems,10);
  const firstSeed=b.seed;mazeAction(p,{kind:'next'});assert.notEqual(mazeBoard(p).seed,firstSeed);assert.equal(p.maze.history.length,1);assert.equal(p.maze.level,2);assert.equal(p.gems,10);
 }
});
test('One wrong answer preserves the puzzle and difficulty; hints never trap the player',()=>{
 const p=freshProfile();mazeAction(p,{kind:'enter'});p.maze.practiceSerial=1;p.maze.tasks={};const q=mazeQuestion(p),bad=q.options.find(a=>a!==q.answer);
 const payload={kind:'answer',questionId:q.id,answer:bad};
 mazeAction(p,payload);assert.equal(p.maze.ability,2);assert.deepEqual(mazeQuestion(p),q);assert.equal(p.xp,0);
 assert.ok(p.maze.review);assert.equal(p.maze.review.steppedBack,false);assert.throws(()=>mazeAction(p,payload));
 mazeAction(p,{kind:'retry',questionId:q.id});
 mazeAction(p,payload);assert.ok(p.maze.hints.includes(p.maze.position));
 mazeAction(p,{kind:'retry',questionId:q.id});
 assert.equal(answer(p).helped,true);assert.equal(p.xp,6);assert.equal(mazeGate(p),false);
 assert.throws(()=>mazeAction(p,{kind:'hint',questionId:q.id}));
 const restored=JSON.parse(JSON.stringify(p));assert.deepEqual(mazeClue(restored),mazeClue(p));assert.equal(mazeGate(restored),false);
 assert.throws(()=>mazeAction(p,{kind:'turn',turn:1.5}));
});
test('Wrong-answer setback is one adjacent step, persists, cannot be bypassed, and never removes rewards',()=>{
 const p=freshProfile('explorer');mazeAction(p,{kind:'enter'});answer(p);
 let steps=0;while(!mazeGate(p)){
  const turn=(mazeClue(p).absolute-p.maze.direction+4)%4;
  if(turn)mazeAction(p,{kind:'turn',turn:turn===3?-1:turn});mazeAction(p,{kind:'forward'});assert.ok(++steps<100);
 }
 const gate=p.maze.position,previous=p.maze.previousPosition,xp=p.xp,gems=p.gems,q=mazeQuestion(p);
 const bad={kind:'answer',questionId:q.id,answer:q.options.find(a=>a!==q.answer)};
 const result=mazeAction(p,bad);assert.equal(result.steppedBack,true);assert.equal(p.maze.position,previous);assert.equal(p.xp,xp);assert.equal(p.gems,gems);assert.equal(p.maze.setbacks,1);
 const restored=JSON.parse(JSON.stringify(p));assert.equal(mazeQuestion(restored).id,q.id);assert.equal(mazeGate(restored),false);assert.equal(mazeClue(restored),null);
 for(const kind of ['answer','forward','turn','hint'])assert.throws(()=>mazeAction(restored,{...bad,kind,turn:1}));
 assert.throws(()=>mazeAction(restored,{kind:'retry',questionId:'stale'}));
 mazeAction(restored,{kind:'retry',questionId:q.id});assert.equal(restored.maze.position,gate);assert.ok(mazeGate(restored));
 assert.equal(mazeAction(restored,bad).steppedBack,false);assert.equal(restored.maze.position,gate);assert.equal(restored.maze.setbacks,1);
 mazeAction(restored,{kind:'retry',questionId:q.id});assert.equal(answer(restored).helped,true);assert.equal(restored.xp,xp+6);assert.throws(()=>answer(restored));
});
test('Repeated worlds evolve architecture and palettes for long runs without modifying navigation',()=>{
 const scenes=new Set();for(let n=1;n<=240;n++){
  const a=mazeTheme(n),b=mazeTheme(n+12);scenes.add(a.sceneKey);assert.equal(a.id,b.id);assert.notEqual(a.material,b.material);assert.notEqual(a.edition,b.edition);assert.notEqual(a.wallHeight,b.wallHeight);
  for(const key of ['wall','trim','sky','lamp'])assert.ok(a[key].every(x=>x>=0&&x<=1));
 }
 assert.equal(scenes.size,240);
 assert.notDeepEqual(mazeTheme(1).wall,mazeTheme(49).wall);
});
test('New gates prioritize letter-word links and revisit missed words without treating guided retries as mastery',()=>{
 const p=freshProfile('explorer');p.maze={...mazeState(p),level:48,ability:1,practiceSerial:1,reviewWords:['cat'],solved:[1,2]};
 const b=mazeBoard(p);for(const pos of mazeRoute(b,b.start)){
  p.maze.position=pos;const q=mazeQuestion(p);assert.notEqual(q.type,'sequence');
  if(['word','gap'].includes(q.type)){assert.equal(q.word,'cat');assert.equal(q.blank,0);assert.ok(q.options.includes(q.answer));}
 }
 p.maze.done=true;mazeAction(p,{kind:'next'});assert.deepEqual(p.maze.reviewWords,['cat']);
});
test('All maze narration is in the local American voice inventory',()=>{
 const lines=new Set(allVoiceLines());for(const line of mazeVoiceLines())assert.ok(lines.has(line));
 for(const id of ['explorer','beginner']){const p=freshProfile(id);mazeAction(p,{kind:'enter'});const b=mazeBoard(p);for(const pos of mazeRoute(b,b.start)){p.maze.position=pos;assert.ok(lines.has(mazeQuestion(p).prompt));}}
});
