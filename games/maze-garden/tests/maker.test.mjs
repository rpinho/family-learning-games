import test from 'node:test';
import assert from 'node:assert/strict';
import {MAKER_START,MAKER_GOAL,validMakerPath,makeChildMaze,newProfile,action,pendingPuzzle,route} from '../engine.mjs';

const path=[21,22,23,24,25,26,27];

test('Child maze is a real connected route with dead ends and an optional spoken word stop',()=>{
 assert.equal(validMakerPath(path,true),true);
 const m=makeChildMaze(path,12345,'explorer');
 assert.deepEqual(route(m,MAKER_START,MAKER_GOAL),path);
 assert.ok(m.cells.some(c=>c?.length===1));
 assert.equal(m.checkpoints[0].puzzle.options.length,3);
 assert.match(m.checkpoints[0].puzzle.spoken,/Listen/);
 for(const bad of [[MAKER_START,MAKER_GOAL],[21,22,23,22,27],[21,22,23,24,25,26,28]])assert.equal(validMakerPath(bad,true),false);
});

test('Making and replaying a maze leaves the regular adventure and difficulty untouched',()=>{
 const p=newProfile('beginner');action(p,{type:'start',seed:44});
 const old=JSON.stringify(p.active),level=p.level,stars=p.stars;
 action(p,{type:'maker-draft',path});action(p,{type:'maker-build',seed:12345});
 const m=p.maker.challenge;assert.deepEqual(route(m,MAKER_START,MAKER_GOAL),path);
 for(const cell of path.slice(1))action(p,{type:'maker-move',cell});
 assert.equal(m.finished,false);assert.ok(pendingPuzzle(m));
 action(p,{type:'maker-answer',answer:'wrong'});assert.equal(m.finished,false);
 action(p,{type:'maker-answer',answer:pendingPuzzle(m).puzzle.answer});
 assert.equal(m.finished,true);assert.equal(p.maker.completed,1);
 action(p,{type:'maker-again'});assert.equal(m.finished,false);assert.equal(m.trail.at(-1),MAKER_START);
 assert.equal(JSON.stringify(p.active),old);assert.equal(p.level,level);assert.equal(p.stars,stars);
});

test('A malformed maker save cannot replace the current creation',()=>{
 const p=newProfile('admin');action(p,{type:'maker-draft',path});
 assert.throws(()=>action(p,{type:'maker-draft',path:[21,22,21]}));
 assert.deepEqual(p.maker.draft,path);
 p.maker.draft=[MAKER_START];
 assert.throws(()=>action(p,{type:'maker-build',seed:1}));
});

test('Sound stop can be skipped without crediting a correct word choice',()=>{
 const p=newProfile('explorer');action(p,{type:'maker-draft',path});action(p,{type:'maker-build',seed:2});
 for(const cell of path.slice(1))action(p,{type:'maker-move',cell});
 action(p,{type:'maker-skip'});
 assert.equal(p.maker.challenge.finished,true);
 assert.equal(p.maker.challenge.checkpoints[0].skipped,true);
 assert.equal(p.maker.completed,1);
 action(p,{type:'maker-again'});
 assert.equal(p.maker.challenge.checkpoints[0].skipped,undefined);
});
