import test from 'node:test';
import assert from 'node:assert/strict';
import {newProfile,action,MAX_LEVEL} from '../engine.mjs';

for(const [level,delta] of [[1,-1],[1,-2],[MAX_LEVEL,1],[MAX_LEVEL,2]]){
 test(`Capped challenge ${level}/${delta} preserves an in-progress maze and all learning evidence`,()=>{
  const p=newProfile('admin');p.level=level;action(p,{type:'start',seed:43});
  action(p,{type:'moves',maze:p.active.id,cells:p.active.solution.slice(1,4)});
  action(p,{type:'hint'});p.streak=1;p.struggles=1;
  const before=structuredClone(p),active=p.active;
  for(let i=0;i<21;i++)action(p,{type:'challenge',delta,seed:i+100});
  assert.equal(p.active,active);
  assert.deepEqual({...p,revision:before.revision},before);
  assert.equal(p.revision,before.revision+21);
 });
}
test('Real challenge changes still replace the board one level at a time, and New still rerolls at the cap',()=>{
 const p=newProfile('admin');p.level=MAX_LEVEL;action(p,{type:'start',seed:3});
 const first=p.active.id;action(p,{type:'challenge',delta:-2,seed:4});
 assert.equal(p.level,MAX_LEVEL-1);assert.notEqual(p.active.id,first);
 assert.equal(p.history.at(-1).type,'requested-easier');
 action(p,{type:'challenge',delta:2,seed:5});assert.equal(p.level,MAX_LEVEL);
 const last=p.active.id;action(p,{type:'new',seed:6});assert.notEqual(p.active.id,last);
 assert.equal(p.level,MAX_LEVEL);assert.equal(p.completed,0);
});
