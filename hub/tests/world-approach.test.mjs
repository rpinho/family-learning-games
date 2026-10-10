import test from 'node:test';
import assert from 'node:assert/strict';
import {approachDestination} from '../public/world-approach.mjs';
test('daily clue preserves its placed hero when a narrow room has no approach spot',()=>{
 const blocked=()=>{throw Error('No clear room spot for {"w":0.35,"h":0.28}');};
 assert.equal(approachDestination(blocked,{episode:true}),null);
 assert.throws(()=>approachDestination(blocked),/No clear room spot/);
});
test('clear approaches still walk and unrelated errors remain visible',()=>{
 const point={x:.2,y:.98};assert.equal(approachDestination(()=>point,{episode:true}),point);
 assert.throws(()=>approachDestination(()=>{throw Error('Missing target');},{episode:true}),/Missing target/);
});
