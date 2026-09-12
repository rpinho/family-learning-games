import test from 'node:test';
import assert from 'node:assert/strict';
import {foundationState,foundationQuestion,foundationAttempt,FOUNDATION_WORDS} from '../lib/foundation.mjs';
test('Uppercase CVC families consolidate before advancing, without longer words',()=>{
 const p={},words=new Set();
 for(let i=0;i<42;i++){const q=foundationQuestion(p);words.add(q.word);assert.equal(q.word.length,3);assert.match(q.answer,/^[A-Z]$/);assert.ok(q.options.every(c=>/^[A-Z]$/.test(c)));assert.equal(new Set(q.options).size,q.options.length);assert.deepEqual(foundationQuestion(JSON.parse(JSON.stringify(p))),q);foundationAttempt(p,q,{ok:true});if(i===4)assert.equal(foundationState(p).stage,1);if(i===5)assert.equal(foundationState(p).stage,2);}
 assert.equal(foundationState(p).stage,4);assert.equal(words.size,42);assert.equal(FOUNDATION_WORDS.length,72);assert.equal(FOUNDATION_WORDS.includes('ball'),false);
});
test('Help does not advance; mistakes lower the next family; existing reading state stays separate',()=>{
 const p={reading:{skills:{decode:{level:3}}},lowercase:{stage:6}};
 for(let i=0;i<6;i++)foundationAttempt(p,foundationQuestion(p),{ok:true});
 assert.equal(foundationState(p).stage,2);
 for(let i=0;i<8;i++)foundationAttempt(p,foundationQuestion(p),{ok:true,helped:true});
 assert.equal(foundationState(p).stage,2);foundationAttempt(p,foundationQuestion(p),{ok:false});foundationAttempt(p,foundationQuestion(p),{ok:false});assert.equal(foundationState(p).stage,1);assert.equal(p.lowercase.stage,6);assert.equal(p.reading.skills.decode.level,3);
});
