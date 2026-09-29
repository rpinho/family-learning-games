import test from 'node:test';
import assert from 'node:assert/strict';
import {createPond,pondAction,pondResult,destination} from '../public/pond/model.mjs';
test('each leaf becomes one raft part; only the crossing completes the page',()=>{
 const initial=createPond();let s=initial;for(const id of [4,4,-1,2,2,7,0,3,1])s=pondAction(s,{type:'count',id});
 assert.deepEqual(s.counted,[4,2,0,3,1]);assert.equal(s.phase,'crossing');assert.equal(pondResult(s).completed,false);assert.deepEqual(initial.counted,[]);
 s=pondAction(s,{type:'arrive'});assert.equal(pondResult(s).completed,true);assert.deepEqual(pondAction(s,{type:'count',id:0}),s);
});
test('both gates determine an actual destination; trial routes cannot change in flight',()=>{
 for(const a of [false,true])for(const b of [false,true]){let s=createPond('flow');if(a)s=pondAction(s,{type:'gate',id:0});if(b)s=pondAction(s,{type:'gate',id:1});const bank=destination(s);s=pondAction(s,{type:'launch'});s=pondAction(s,{type:'gate',id:0});assert.deepEqual(s.gates,[a,b]);s=pondAction(s,{type:'arrive'});assert.equal(s.trials[0].bank,bank);assert.equal(s.phase,a&&b?'done':'build');assert.deepEqual(pondAction(s,{type:'arrive'}),s);}
});
test('wrong routes are retryable and help does not erase the independent evidence',()=>{
 let s=createPond('flow');for(let i=0;i<3;i++){s=pondAction(s,{type:'launch'});s=pondAction(s,{type:'arrive'});if(i<2)s=pondAction(s,{type:'gate',id:i});}
 assert.deepEqual(s.trials.map(t=>t.bank),['stones','reeds','map']);assert.equal(pondResult(s).misses,2);assert.equal(pondResult(s).completed,true);assert.equal(pondResult(s).helped,false);
 assert.equal(pondResult(pondAction(s,{type:'help'})).helped,true);
});
