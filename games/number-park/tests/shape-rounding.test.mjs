import test from 'node:test';
import assert from 'node:assert/strict';
import {SHAPES,validGuidedShape,nextShape} from '../lib/shapes.mjs';
import {freshProfile,action} from '../lib/math.mjs';

const wire=value=>JSON.parse(JSON.stringify(value));
const changed=(shape,edit)=>{const paths=structuredClone(SHAPES[shape].paths);edit(paths);return paths;};

test('complete circle and oval browser rounding survives JSON and saves guided practice separately',()=>{
 for(const shape of ['circle','oval']){
  // Simulate the observed browser/Node trig difference at a non-integer point.
  const paths=changed(shape,p=>{p[0][30][0]+=2**-48;});
  const delta=Math.abs(paths[0][30][0]-SHAPES[shape].paths[0][30][0]);
  assert.equal(delta,2**-48); // Approximately 3.55e-15.
  assert.notDeepEqual(wire(paths),SHAPES[shape].paths);
  assert.equal(validGuidedShape(shape,wire(paths)),true);
  const p=freshProfile('admin');p.shapes={[shape]:2};p.copiedShapes={[shape]:3};
  p.drawing=[[[1,2],[3,4]]];p.xp=44;
  const drawing=structuredClone(p.drawing);
  for(const practice of [undefined,'guided','copy']){
   action(p,wire({kind:'shape',shape,practice,strokes:paths,revision:p.revision}));
  }
  assert.equal(p.shapes[shape],4);assert.equal(p.copiedShapes[shape],4);
  assert.equal(p.shapeNext,nextShape(shape));assert.equal(p.revision,3);
  assert.equal(p.xp,44);assert.deepEqual(p.drawing,drawing);
 }
});

test('guided matching uses only a tiny absolute coordinate tolerance',()=>{
 for(const shape of Object.keys(SHAPES)){
  assert.equal(validGuidedShape(shape,wire(SHAPES[shape].paths)),true);
  for(const offset of [-5e-10,5e-10]){
   assert.equal(validGuidedShape(shape,changed(shape,p=>{p[0][0][0]+=offset;})),true);
  }
 }
});

test('invalid guided submissions reject without changing saved Admin state',()=>{
 const shape='circle';
 const cases=[
  ['missing',undefined],['null',null],['object',{}],['empty',[]],
  ['extra stroke',[...SHAPES[shape].paths,[]]],
  ['missing stroke',new Array(1)],
  ['non-array stroke',changed(shape,p=>{p[0]={};})],
  ['partial',changed(shape,p=>{p[0].pop();})],
  ['extra point',changed(shape,p=>{p[0].push(p[0][0]);})],
  ['missing point',changed(shape,p=>{delete p[0][1];})],
  ['null point',changed(shape,p=>{p[0][1]=null;})],
  ['object point',changed(shape,p=>{p[0][1]={0:1,1:2,length:2};})],
  ['short point',changed(shape,p=>{p[0][1].pop();})],
  ['extra coordinate',changed(shape,p=>{p[0][1].push(0);})],
  ...[0/0,Infinity,-Infinity,'50',null,undefined].map(value=>[
   `invalid coordinate ${String(value)}`,changed(shape,p=>{p[0][1][0]=value;})]),
  ['outside tolerance',changed(shape,p=>{p[0][0][0]+=2e-9;})],
  ['visible drift',changed(shape,p=>{p[0][0][0]+=.1;})],
 ];
 for(const [label,strokes] of cases){
  for(const transported of [strokes,strokes===undefined?undefined:wire(strokes)]){
   assert.equal(validGuidedShape(shape,transported),false,label);
   const p=freshProfile('admin');p.shapes={circle:2};p.copiedShapes={oval:3};
   p.drawing=[[[1,2],[3,4]]];p.xp=44;
   const before=structuredClone(p);
   assert.throws(()=>action(p,{kind:'shape',shape,strokes:transported,revision:p.revision}),undefined,label);
   assert.deepEqual(p,before,label);
  }
 }
 const p=freshProfile('admin'),before=structuredClone(p);
 assert.equal(validGuidedShape('unknown',SHAPES.circle.paths),false);
 assert.throws(()=>action(p,{kind:'shape',shape:'unknown',strokes:SHAPES.circle.paths,revision:0}));
 assert.deepEqual(p,before);
});
