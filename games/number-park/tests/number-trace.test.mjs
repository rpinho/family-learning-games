import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACE_MAX,numberPaths,nextTraceNumber,startingTraceNumber,validNumberTrace} from '../lib/number-trace.mjs';
import {GuidedTrace,railPoints} from '../lib/guided-trace.mjs';
import {freshProfile,action,prepareProfile} from '../lib/math.mjs';
test('every number 0–1000 follows all strokes inside the pad, including multi-digit numbers',()=>{
 for(let n=0;n<=TRACE_MAX;n++){
  const paths=numberPaths(String(n)),rail=new GuidedTrace(paths);
  for(const path of paths){assert.ok(rail.begin(path[0]));for(const point of railPoints(path))rail.move(point);rail.release();}
  assert.equal(rail.done,true,String(n));assert.ok(validNumberTrace(String(n),rail.completed));
  assert.ok(paths.flat().every(([x,y])=>x>=0&&x<=100&&y>=0&&y<=100),String(n));
  if(n>=10&&n<100){assert.ok(paths[0].every(([x])=>x<50));assert.ok(paths.at(-1).every(([x])=>x>50));}
 }
});
test('saving each full number advances persistently past 100 through 1000 without raising arithmetic difficulty',()=>{
 let p=freshProfile('admin');p.xp=254;
 assert.equal(startingTraceNumber(p.traceNext),'1');
 for(let n=1;n<=TRACE_MAX;n++){
  action(p,{kind:'trace',digit:String(n),strokes:numberPaths(n),revision:p.revision});
  p=JSON.parse(JSON.stringify(p));
  assert.equal(p.traceNext,String(Math.min(TRACE_MAX,n+1)));assert.equal(p.guided[n],1);assert.equal(p.xp,254);assert.equal(p.lessons,0);assert.equal(p.ceiling,13);
 }
 assert.equal(nextTraceNumber(13),'14');assert.equal(nextTraceNumber(100),'101');assert.equal(nextTraceNumber(999),'1000');assert.equal(nextTraceNumber(1000),null);assert.equal(p.guided['101'],1);assert.equal(startingTraceNumber('101'),'101');
});
test('partial numbers, malformed paths and out-of-range values cannot advance or earn credit',()=>{
 const p=freshProfile('admin'),before=structuredClone(p);
 for(const digit of ['1001','-1','01','1e1','',undefined])assert.throws(()=>action(p,{kind:'trace',digit,strokes:[],revision:0}));
 assert.throws(()=>action(p,{kind:'trace',digit:'13',strokes:numberPaths(13).slice(0,-1),revision:0}));assert.deepEqual(p,before);
});
test('copying larger numbers advances separately from guided practice for both children',()=>{
 for(const player of ['beginner','explorer'])for(const digit of ['101','110','999','1000']){
  const p=freshProfile(player),ceiling=p.ceiling;
  action(p,{kind:'trace',practice:'copy',digit,strokes:numberPaths(digit),revision:0});
  assert.equal(p.copiedNumbers[digit],1);assert.equal(p.guided[digit],undefined);
  assert.equal(p.traceNext,String(Math.min(TRACE_MAX,Number(digit)+1)));
  assert.equal(p.ceiling,ceiling);assert.equal(p.xp,0);
 }
});
test('old completed-100 saves resume at 101, but unfinished 100 is not skipped',()=>{
 for(const player of ['beginner','explorer'])for(const practice of ['guided','copiedNumbers']){
  const p=freshProfile(player);p.traceNext='100';
  assert.equal(prepareProfile(p).traceNext,'100');
  p[practice]={'100':1};const before=structuredClone(p);
  prepareProfile(p);assert.equal(p.traceNext,'101');
  assert.deepEqual({...p,traceNext:'100'},before);
  assert.deepEqual(prepareProfile(p),p);
 }
});
