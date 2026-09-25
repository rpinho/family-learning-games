import test from 'node:test';
import assert from 'node:assert/strict';
import {MAKER_START,MAKER_GOAL,makerEndpoints,makerPathLimit,validMakerPath,extendMakerPath,makeChildMaze,newProfile,action,pendingPuzzle,route,traceSegment} from '../engine.mjs';

const path=[21,22,23,24,25,26,27];
const legacy=p=>(p.maker={size:7,draft:[21],challenge:null,completed:0,archive:[]});

test('A fast straight finger sweep fills skipped cells without crossing a diagonal',()=>{
 assert.deepEqual(extendMakerPath([MAKER_START],MAKER_GOAL),path);
 assert.deepEqual(extendMakerPath([21,22,23],22),[21,22]);
 assert.deepEqual(extendMakerPath([21,22],30),[21,22]);
});

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
 legacy(p);
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
 const p=newProfile('admin');legacy(p);action(p,{type:'maker-draft',path});
 assert.throws(()=>action(p,{type:'maker-draft',path:[21,22,21]}));
 assert.deepEqual(p.maker.draft,path);
 p.maker.draft=[MAKER_START];
 assert.throws(()=>action(p,{type:'maker-build',seed:1}));
});

test('Sound stop can be skipped without crediting a correct word choice',()=>{
 const p=newProfile('explorer');legacy(p);action(p,{type:'maker-draft',path});action(p,{type:'maker-build',seed:2});
 for(const cell of path.slice(1))action(p,{type:'maker-move',cell});
 action(p,{type:'maker-skip'});
 assert.equal(p.maker.challenge.finished,true);
 assert.equal(p.maker.challenge.checkpoints[0].skipped,true);
 assert.equal(p.maker.completed,1);
 action(p,{type:'maker-again'});
 assert.equal(p.maker.challenge.checkpoints[0].skipped,undefined);
});

test('New maker size follows normal level, with choices and a blank-space limit',()=>{
 const p=newProfile('explorer');p.level=25;action(p,{type:'maker-new'});assert.equal(p.maker.size,19);
 assert.deepEqual(p.maker.draft,[makerEndpoints(19).start]);
 action(p,{type:'maker-size',size:13});assert.equal(p.maker.size,13);
 const {start,goal}=makerEndpoints(13),straight=Array.from({length:13},(_,i)=>start+i);
 assert.equal(straight.at(-1),goal);assert.equal(validMakerPath(straight,true,13),true);
 action(p,{type:'maker-draft',path:straight});assert.throws(()=>action(p,{type:'maker-size',size:9}));
 assert.ok(makerPathLimit(13)<13*13/2);
});

test('Biggest board grows an existing drawing, keeps the choice, and accepts more than 115 squares',()=>{
 const p=newProfile('explorer');p.level=25;action(p,{type:'maker-new'});
 const old=makerEndpoints(19),straight=Array.from({length:19},(_,i)=>old.start+i);
 action(p,{type:'maker-draft',path:straight});
 action(p,{type:'maker-size',size:25});
 assert.equal(p.maker.size,25);
 assert.deepEqual(p.maker.draft,Array.from({length:19},(_,i)=>makerEndpoints(25).start+i));
 assert.equal(makerPathLimit(25),200);
 const extended=extendMakerPath(p.maker.draft,makerEndpoints(25).goal,25);
 assert.equal(validMakerPath(extended,true,25),true);
 action(p,{type:'maker-draft',path:extended});
 action(p,{type:'maker-build',seed:42});
 assert.equal(p.maker.challenge.n,25);
 action(p,{type:'maker-new'});
 assert.equal(p.maker.size,25);
 assert.equal(p.maker.challenge.n,25);

 const at=(row,col)=>row*25+col,path=[at(12,0)];
 for(let row=13;row<=24;row++)path.push(at(row,0));
 for(let col=1;col<=24;col++)path.push(at(24,col));
 for(let row=23;row>=20;row--){const left=row%2===1;path.push(at(row,left?24:1));for(let col=left?23:2;left?col>=1:col<=24;col+=left?-1:1)path.push(at(row,col));}
 for(let row=19;row>=12;row--)path.push(at(row,24));
 assert.ok(path.length>115&&path.length<=makerPathLimit(25));
 assert.equal(validMakerPath(path,true,25),true);
 action(p,{type:'maker-draft',path});
 action(p,{type:'maker-build',seed:43});
 assert.equal(p.maker.challenge.sourcePath.length,path.length);
 assert.equal(p.maker.challenge.cells.length,25*25);
});

test('Unused space becomes a full walled maze with a longer route than the sketch',()=>{
 for(const n of [9,13,19,25])for(const seed of [1,99,12345]){
  const {start,goal}=makerEndpoints(n),drawn=Array.from({length:n},(_,i)=>start+i),m=makeChildMaze(drawn,seed,'explorer',n);
  assert.equal(m.cells.length,n*n);assert.equal(m.cells.filter(Array.isArray).length,n*n);
  assert.equal(m.cells.reduce((sum,c)=>sum+c.length,0)/2,n*n-1);
  assert.ok(route(m,start,goal).length>drawn.length,`Expected a detour on ${n}×${n}, seed ${seed}`);
  assert.ok(m.cells.filter(c=>c.length>=3).length>0);
  assert.ok(m.cells.filter(c=>c.length===1).length>0);
 }
});

test('A continuous finger trace saves multiple squares at once, and earlier creations survive',()=>{
 const p=newProfile('explorer');p.level=25;action(p,{type:'maker-new'});
 const {start,goal}=makerEndpoints(19),drawn=Array.from({length:19},(_,i)=>start+i);
 action(p,{type:'maker-draft',path:drawn});action(p,{type:'maker-build',seed:21});
 const c=p.maker.challenge,shadow=structuredClone(c),from={x:.5,y:9.5},to={x:5.5,y:9.5};
 const batch=traceSegment(shadow,from,to);assert.equal(batch.length,5);
 action(p,{type:'maker-moves',maze:c.id,cells:batch});assert.equal(c.trail.at(-1),start+5);
 assert.throws(()=>action(p,{type:'maker-moves',maze:'wrong',cells:[start+10]}));
 action(p,{type:'maker-new'});assert.equal(p.maker.challenge.id,c.id);
 action(p,{type:'maker-draft',path:drawn});action(p,{type:'maker-build',seed:22});
 assert.equal(p.maker.archive.length,1);action(p,{type:'maker-previous'});assert.equal(p.maker.challenge.id,c.id);
 assert.equal(p.maker.challenge.trail.at(-1),start+5);
});
