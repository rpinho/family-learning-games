import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,gamesFor,prepareProfile} from '../lib/math.mjs';
import {SHAPES} from '../lib/shapes.mjs';
import {GuidedTrace,railPoints} from '../lib/guided-trace.mjs';
import {scheduleAdvance} from '../lib/auto-advance.mjs';
test('Beginner and Admin keep mixed arithmetic addition-only but may choose visual Take away',()=>{
 for(const id of ['beginner','admin']){const p=freshProfile(id);assert.ok(gamesFor(p).some(g=>g.id==='subtract'));action(p,{kind:'start',game:'subtract',revision:0});assert.equal(p.session.question.kind,'subtract');for(let i=0;i<300;i++){p.revision=i;for(const g of gamesFor(p).filter(g=>g.id!=='subtract')){const q=makeQuestion(p,g.id,i);assert.notEqual(q.operator,'−');assert.notEqual(q.kind,'subtract');}}}
 assert.equal(makeQuestion(freshProfile('explorer'),'subtract').kind,'sums');
});
test('pending abstract subtraction is replaced without changing progress; visual subtraction is preserved',()=>{
 const p=freshProfile('beginner');p.xp=72;p.history=[{ok:true}];p.session={game:'line',round:2,question:{kind:'line',operator:'−',id:'old'},result:null,finished:false,helped:true};
 prepareProfile(p);const q=structuredClone(p.session.question);prepareProfile(p);assert.deepEqual(p.session.question,q);assert.equal(p.xp,72);assert.equal(p.history.length,1);assert.equal(p.revision,0);assert.equal(p.session.game,'line');assert.equal(q.operator,'+');assert.throws(()=>action(p,{kind:'answer',questionId:'old',answer:1,revision:0}));
});
test('all shapes tolerate small offsets and finger lifts, save separately, and cannot be completed by tapping',()=>{
 for(const [shape,{paths}] of Object.entries(SHAPES)){
  const rail=new GuidedTrace(paths);rail.begin(paths[0][0]);rail.move(paths[0][0]);rail.release();assert.equal(rail.done,false);
  for(const path of paths){rail.begin(path[0]);for(const [i,point] of railPoints(path).entries()){if(i%25===0){rail.release();rail.begin(rail.handle);}rail.move([point[0]+2,point[1]+1]);}rail.release();}
  assert.equal(rail.done,true,shape);assert.deepEqual(rail.completed,paths);
  const p=freshProfile('admin');assert.throws(()=>action(p,{kind:'shape',shape,strokes:[],revision:0}));action(p,{kind:'shape',shape,strokes:rail.completed,revision:0});assert.equal(p.shapes[shape],1);assert.equal(p.xp,0);assert.deepEqual(p.drawing,[]);
 }
});
test('auto advance runs once only for the same visible correct question; navigation and races cancel',()=>{
 const base={player:'admin',revision:2,active:true,session:{question:{id:'q1'},result:{ok:true},finished:false}};
 for(const change of [null,{active:false},{player:'beginner'},{revision:3},{session:{question:{id:'q2'},result:{ok:true}}}]){
  let callback,calls=0,now=structuredClone(base);scheduleAdvance({...base,read:()=>now,advance:()=>calls++,setTimer:fn=>{callback=fn;return 1;},clearTimer:()=>{}});
  if(change)Object.assign(now,change);callback();assert.equal(calls,change?0:1);
 }
 for(const session of [{result:{ok:false}},{result:{ok:true},finished:true}])scheduleAdvance({...base,session,setTimer:()=>assert.fail('must not schedule')});
 let cancelled=false;const stop=scheduleAdvance({...base,read:()=>base,advance:()=>{},setTimer:()=>9,clearTimer:id=>{assert.equal(id,9);cancelled=true;}});stop();assert.equal(cancelled,true);
});
