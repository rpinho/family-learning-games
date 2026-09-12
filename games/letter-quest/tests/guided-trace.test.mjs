import test from 'node:test';
import assert from 'node:assert/strict';
import {GuidedTrace,railPoints} from '../public/guided-trace.mjs';
import {GLYPHS,freshProfile,nextChallenge,applyAttempt,assessTrace} from '../public/engine.mjs';

test('all 62 glyphs follow the model with forgiving off-center movement',()=>{
 for(const [char,paths] of Object.entries(GLYPHS)){
  const rail=new GuidedTrace(paths);
  for(const path of paths){
   assert.ok(rail.begin([path[0][0]+7,path[0][1]-6]),char);
   for(const p of railPoints(path))rail.move([p[0]+4,p[1]-3]);
   // Return to the endpoint as a child follows the last little piece.
   rail.move(path.at(-1));rail.release();
  }
  assert.ok(rail.done,char);
  assert.ok(assessTrace(paths,rail.completed).ok,char);
 }
});
test('lift and resume, wrong start, wandering, reverse motion and dots',()=>{
 const rail=new GuidedTrace(GLYPHS.l);
 assert.equal(rail.begin([90,90]),false);
 rail.begin([50,15]);rail.move([50,35]);const cursor=rail.cursor;
 rail.move([120,120]);assert.equal(rail.cursor,cursor);
 rail.release();assert.equal(rail.cursor,cursor);
 assert.ok(rail.begin(rail.handle));rail.move([50,15]);assert.equal(rail.cursor,cursor);
 for(const p of railPoints(GLYPHS.l[0]))rail.move(p);
 assert.equal(rail.done,true);
 const dot=new GuidedTrace([GLYPHS.i[1]]);assert.ok(dot.begin([50,20]));assert.ok(dot.done);
});
test('loop endings cannot be completed by tapping the start or the crossing',()=>{
 const rail=new GuidedTrace(GLYPHS.O);rail.begin([50,15]);rail.move([50,15]);rail.release();
 assert.equal(rail.done,false);assert.equal(rail.cursor,0);
});
test('Beginner gets persistent guided challenges and never independent mastery from perfect rails',()=>{
 const p=freshProfile('beginner');p.seq=1;
 for(let i=0;i<4;i++){
  p.retryTrace='a';const q=nextChallenge(p);assert.equal(q.guided,true);assert.equal(q.level,0);
  const result=applyAttempt(p,q,{strokes:q.paths,helped:false,durationMs:1200});
  assert.equal(result.ok,true);assert.equal(p.history.at(-1).helped,true);
  assert.equal(p.history.at(-1).practice,'guided-tracing');assert.equal(p.skills['trace:a'].level,0);
 }
 assert.equal(p.hintBudget,undefined);
 const other=freshProfile('explorer');other.retryTrace='a';assert.equal(nextChallenge(other).guided,undefined);
});
