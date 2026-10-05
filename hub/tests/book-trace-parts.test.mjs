import test from 'node:test';
import assert from 'node:assert/strict';
import {traceDone} from '../public/book.mjs';
// An R drawn as ink cells on a 9x9 grid: stem (left column), bowl (top right), leg (bottom right diagonal).
const R=[];for(let y=0;y<9;y++)R.push({x:0,y});for(const [x,y] of [[1,0],[2,0],[3,1],[3,2],[3,3],[2,4],[1,4]])R.push({x,y});for(const [x,y] of [[2,5],[3,6],[3,7],[4,8],[2,6],[4,7]])R.push({x,y});
const draw=keep=>R.map(c=>({...c,hit:keep(c)}));
test('2026-10-02: lifting after the stem and bowl of R (no leg) is not a finished trace',()=>{
 const noLeg=draw(c=>c.y<=4||c.x===0);
 assert.ok(noLeg.filter(c=>c.hit).length/noLeg.length>=0.5,'over the old 50% lift threshold');
 assert.equal(traceDone(noLeg,0.5),false);
});
test('the whole R traced loosely (about 60%, every part touched) is accepted; nothing traced is not',()=>{
 const loose=draw((c,i)=>R.indexOf(R.find(r=>r.x===c.x&&r.y===c.y))%3!==2);
 assert.equal(traceDone(loose,0.5),true);
 assert.equal(traceDone(draw(()=>false),0.5),false);
 assert.equal(traceDone([],0.5),false);
});
