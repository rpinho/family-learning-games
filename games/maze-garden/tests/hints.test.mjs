import test from 'node:test';import assert from 'node:assert/strict';
import {newProfile,action,decisionHint,requestHint,route} from '../engine.mjs';
test('Hints find the next junction, reveal one branch after a pause, and do not inflate assistance on replay',()=>{
 const p=newProfile('admin');action(p,{type:'start',seed:7});const a=p.active,d=decisionHint(a),path=route(a,a.start,a.goal);
 assert.equal(a.cells[d.junction].length>=3,true);
 assert.ok(path.includes(d.junction));assert.ok(d.cells.length<=2);
 requestHint(a,10000);assert.deepEqual(a.hintCue.cells,[d.junction]);assert.equal(a.hints,1);
 requestHint(a,14999);assert.equal(a.hintCue.stage,1);
 requestHint(a,15000);assert.equal(a.hintCue.stage,2);assert.deepEqual(a.hintCue.cells,d.cells);
 requestHint(a,16000);assert.equal(a.hints,1);
 const b=JSON.parse(JSON.stringify(a));requestHint(b,16001);assert.equal(b.hints,1);
 assert.equal(a.moves,0);assert.deepEqual(a.trail,[a.start]);
});
test('Help does not deduct stars or automatically lower a chosen level; fresh mazes start without cues',()=>{
 const p=newProfile('admin');p.level=21;
 for(let i=0;i<2;i++){action(p,{type:'start',seed:i+8});requestHint(p.active,1000);requestHint(p.active,6000);action(p,{type:'moves',maze:p.active.id,cells:p.active.solution.slice(1)});}
 assert.equal(p.level,21);assert.equal(p.stars,6);assert.equal(p.history.at(-1).independent,false);
 action(p,{type:'start',seed:10});assert.equal(p.active.hints,0);assert.equal(p.active.hintCue,undefined);
});
