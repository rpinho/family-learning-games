import test from 'node:test';
import assert from 'node:assert/strict';
import {countFor,rng} from '../plan.mjs';
test('Beginner counts 8 to 13 most chapters and sometimes stretches to 14-16',()=>{
 const r=rng('count-range'),seen=new Map();
 for(let i=0;i<3000;i++){const n=countFor({countsTo:13,seen:10},r);seen.set(n,(seen.get(n)||0)+1);}
 assert.ok([...seen.keys()].every(n=>n>=8&&n<=16));
 const stretch=[14,15,16].reduce((t,n)=>t+(seen.get(n)||0),0)/3000;
 assert.ok(stretch>0.25&&stretch<0.42,`stretch share ${stretch}`);
});
test('a Sage counting flag keeps him within what he can count; no parent value falls back to small counts',()=>{
 const r=rng('count-sage');
 for(let i=0;i<500;i++){assert.ok(countFor({countsTo:13,sageCount:true},r)<=13);assert.ok(countFor({},r)<=5);}
});
