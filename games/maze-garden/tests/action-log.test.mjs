import test from 'node:test';import assert from 'node:assert/strict';
import {actionLogRow} from '../action-log.mjs';
test('maker diagnostics use the created board and count each completion once, never the regular maze',()=>{
 const p={player:'admin',revision:42,completed:20,history:[{level:25}],active:{id:'regular',n:57,metrics:{cells:3249}},maker:{challenge:{id:'created',n:25,metrics:{cells:625}},size:25,completed:4,editing:false}};
 const before=JSON.stringify(p),first=actionLogRow(p,{type:'maker-answer',answer:'CAT'},20,3);
 assert.equal(first.maze,'created');assert.equal(first.grid,25);assert.equal(first.metrics.cells,625);assert.equal(first.makerCompleted,4);assert.equal(first.makerFinished,true);assert.equal(first.completed,undefined);
 assert.equal(actionLogRow(p,{type:'maker-answer'},20,4).makerFinished,false,'a replayed answer is not another completion');
 const regular=actionLogRow(p,{type:'answer'},19,4);assert.equal(regular.maze,'regular');assert.equal(regular.grid,57);assert.deepEqual(regular.completed,{level:25});assert.equal(regular.makerCompleted,undefined);
 assert.equal(JSON.stringify(p),before);
});
test('a first maker draft reports its selected size even before any board exists',()=>{
 const row=actionLogRow({player:'admin',revision:1,completed:2,history:[],active:{id:'regular',n:57},maker:{size:13,completed:0,editing:true}},{type:'maker-draft'},2,0);
 assert.equal(row.maze,undefined);assert.equal(row.grid,13);assert.equal(row.makerEditing,true);assert.equal(row.makerFinished,false);
});
