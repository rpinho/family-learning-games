import test from 'node:test';
import assert from 'node:assert/strict';
import {SHAPES,checkShapeCopy,nextShape,shapeVoiceLines} from '../lib/shapes.mjs';
import {checkCopy} from '../lib/copy-practice.mjs';
import {railPoints} from '../lib/guided-trace.mjs';
import {freshProfile,action} from '../lib/math.mjs';

test('an accurate square with a large opening cannot save as a completed copy',()=>{
 const ink=[[[23,23],[77,23],[77,77],[23,77],[23,55]]];
 assert.equal(checkCopy(SHAPES.square.paths,ink).ok,true); // Original global-coverage failure.
 const check=checkShapeCopy('square',ink);assert.equal(check.ok,false);assert.ok(check.gap.length>8);
 assert.ok(check.gap.every(([x,y])=>x===23&&y>23&&y<55));
 const p=freshProfile('admin'),before=structuredClone(p);
 assert.throws(()=>action(p,{kind:'shape',shape:'square',practice:'copy',strokes:ink,revision:0}));
 assert.deepEqual(p,before);
 action(p,{kind:'shape',shape:'square',practice:'copy',strokes:[...ink,[[23,55],[23,23]]],revision:0});
 assert.equal(p.copiedShapes.square,1);assert.equal(p.shapes,undefined);assert.equal(p.shapeNext,'trapezoid');assert.equal(p.xp,0);
});
test('large gaps at the model seam and inside a side are both detected',()=>{
 const loop=railPoints(SHAPES.square.paths[0]);
 for(const ink of [[loop.slice(20,-20)],[loop.slice(0,65),loop.slice(100)]])assert.equal(checkShapeCopy('square',ink).ok,false);
 const small=[loop.slice(0,-7)];assert.equal(checkShapeCopy('square',small).ok,true);
});
test('all shapes accept finger offsets, separate meeting strokes and empty lifts',()=>{
 for(const [shape,{paths}] of Object.entries(SHAPES)){
  const offset=paths.map(path=>path.map(([x,y])=>[x+2,y+1]));
  assert.equal(checkShapeCopy(shape,offset).ok,true,shape);
  const segments=paths.flatMap(path=>path.slice(1).map((p,i)=>[path[i],p]));
  assert.equal(checkShapeCopy(shape,[[],...segments]).ok,true,shape);
 }
 for(const ink of [undefined,[],[[null]],[[[Infinity,1]]],[[[23,23]]]])assert.equal(checkShapeCopy('square',ink).ok,false);
 assert.equal(checkShapeCopy('unknown',SHAPES.square.paths).ok,false);
});
test('trapezoid has a shorter parallel top, a closed outline and both practice modes',()=>{
 const path=SHAPES.trapezoid.paths[0];assert.deepEqual(path[0],path.at(-1));
 assert.equal(path[0][1],path[1][1]);assert.equal(path[2][1],path[3][1]);
 assert.ok(path[1][0]-path[0][0]<path[2][0]-path[3][0]);
 for(const practice of ['guided','copy']){
  const p=freshProfile('admin');p.drawing=[[[1,2],[3,4]]];p.traceNext='124';p.xp=44;
  action(p,{kind:'shape',shape:'trapezoid',practice,strokes:SHAPES.trapezoid.paths,revision:0});
  assert.equal(p[practice==='copy'?'copiedShapes':'shapes'].trapezoid,1);
  assert.deepEqual(p.drawing,[[[1,2],[3,4]]]);assert.equal(p.traceNext,'124');assert.equal(p.xp,44);assert.equal(p.ceiling,13);
 }
 assert.equal(nextShape('square'),'trapezoid');assert.equal(nextShape('trapezoid'),'circle');
 assert.ok(shapeVoiceLines().includes('Trace a trapezoid.'));assert.ok(shapeVoiceLines().includes('Bring the ends together. Small gaps are okay.'));
});
