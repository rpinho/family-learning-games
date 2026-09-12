import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkCopy,safeInk} from '../lib/copy-practice.mjs';
import {SHAPES,nextShape,startingShape} from '../lib/shapes.mjs';
import {numberPaths} from '../lib/number-trace.mjs';
import {freshProfile,action,makeQuestion} from '../lib/math.mjs';
test('copy practice accepts wobble on all shapes and numbers but not taps, missing parts or scribbles',()=>{
 for(const paths of [...Object.values(SHAPES).map(s=>s.paths),...['1','8','13','14','99','100'].map(numberPaths)]){
  assert.ok(checkCopy(paths,paths.map(p=>p.map(([x,y])=>[x+3,y+2]))).ok);
  assert.equal(checkCopy(paths,[[paths[0][0]]]).ok,false);
 }
 assert.equal(checkCopy(SHAPES.rectangle.paths,[[[15,28],[85,28]]]).ok,false);
 assert.equal(checkCopy(numberPaths('13'),numberPaths('13').slice(0,1)).ok,false);
 assert.equal(checkCopy(SHAPES.rectangle.paths,[...SHAPES.rectangle.paths,Array.from({length:200},(_,i)=>[i%2?0:100,i%2?100:0])]).ok,false);
 assert.deepEqual(safeInk(undefined),[]);assert.deepEqual(safeInk([[null]]),[]);assert.deepEqual(safeInk([[[2,3]]]),[[[2,3]]]);
});
test('nine shapes cycle and resume; copied work is distinct from guided work and never arithmetic mastery',()=>{
 let p=freshProfile('beginner');const shapes=Object.keys(SHAPES);assert.equal(shapes.length,9);assert.equal(startingShape(undefined),'rectangle');
 for(const shape of shapes){action(p,{kind:'shape',shape,strokes:SHAPES[shape].paths,practice:'copy',revision:p.revision});p=JSON.parse(JSON.stringify(p));assert.equal(p.shapeNext,nextShape(shape));assert.equal(p.copiedShapes[shape],1);assert.equal(p.shapes,undefined);}
 assert.equal(p.shapeNext,'rectangle');action(p,{kind:'trace',digit:'14',strokes:numberPaths('14'),practice:'copy',revision:p.revision});assert.equal(p.traceNext,'15');assert.equal(p.copiedNumbers['14'],1);assert.equal(p.guided['14'],undefined);assert.equal(p.xp,0);assert.equal(p.ceiling,13);assert.equal(p.history.length,0);
 const before=structuredClone(p);assert.throws(()=>action(p,{kind:'trace',digit:'15',strokes:[],practice:'copy',revision:p.revision}));assert.deepEqual(p,before);
});
test('patterns sometimes place the missing picture at the start without changing level',()=>{
 const p=freshProfile('beginner');let found=0;
 for(let i=0;i<120;i++){p.revision=i;const q=makeQuestion(p,'pattern',3);assert.equal(q.level,2);if(q.position==='start'){found++;assert.equal(q.blank,0);assert.equal(q.sequence[0],null);assert.equal(q.answer,q.unit[q.phase]);assert.equal(q.prompt,'Which picture starts the pattern?');}}
 assert.equal(found,120);
});
test('pointer coordinates are read synchronously, never in deferred React state updaters',()=>{
 const source=readFileSync(new URL('../app/drawing.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/set(?:Ink|Draft)\([^\n;]*point\(e\)/);
 assert.match(source,/const p=point\(e\)/);assert.match(source,/draftRef\.current/);
});
