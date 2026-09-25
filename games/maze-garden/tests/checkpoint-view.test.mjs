import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointMarkers} from '../public/checkpoint-view.mjs';
import {newProfile,action,pendingPuzzle} from '../engine.mjs';

test('Explorer finds hidden letter stops by tracing; the spoken puzzle still opens on arrival',()=>{
 const p=newProfile('explorer');action(p,{type:'mode',mode:'puzzles'});
 action(p,{type:'start',seed:75});const a=p.active,checkpoint=a.checkpoints[0];
 assert.equal(checkpointMarkers('explorer',a).length,0);
 assert.equal(pendingPuzzle(a),undefined);
 const index=a.solution.indexOf(checkpoint.cell);
 action(p,{type:'moves',maze:a.id,cells:a.solution.slice(1,index+1)});
 assert.equal(pendingPuzzle(a),checkpoint);
 assert.ok(checkpoint.puzzle.spoken);
 assert.equal(checkpointMarkers('explorer',a).length,0);
 action(p,{type:'answer',answer:checkpoint.puzzle.answer});
 assert.equal(checkpoint.solved,true);
 assert.equal(checkpointMarkers('explorer',a).length,0);
});

test('Beginner and Admin retain visible puzzle stops',()=>{
 const a={checkpoints:[{cell:1,solved:false},{cell:2,solved:true}]};
 assert.equal(checkpointMarkers('beginner',a),a.checkpoints);
 assert.equal(checkpointMarkers('admin',a),a.checkpoints);
});
