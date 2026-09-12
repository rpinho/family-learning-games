import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,makeQuestion,action,prepareProfile} from '../lib/math.mjs';
import {toggleRemoval,takeAwayPrompt,PATTERN_UNITS,patternLevel} from '../lib/play-practice.mjs';
test('Take away allows overshoot, undo and re-removal without a target clamp',()=>{
 let removed=[];for(let i=0;i<5;i++)removed=toggleRemoval(removed,i);
 assert.deepEqual(removed,[0,1,2,3,4]);removed=toggleRemoval(removed,2);assert.deepEqual(removed,[0,1,3,4]);removed=toggleRemoval(removed,2);assert.equal(removed.length,5);
});
test('Take away states the exact quantity, remains small and survives reload for Beginner',()=>{
 for(let i=0;i<300;i++){const p=freshProfile('beginner');p.revision=i;const q=makeQuestion(p,'subtract');assert.ok(q.total>=3&&q.total<=10);assert.ok(q.remove>=1&&q.remove<=5&&q.remove<=q.total);assert.equal(q.answer,q.total-q.remove);assert.equal(takeAwayPrompt(q.remove),`Take away ${q.remove}. How many are left?`);}
 const p=freshProfile('beginner');action(p,{kind:'start',game:'subtract',revision:0});const before=structuredClone(p);prepareProfile(p);assert.deepEqual(p,before);
 const q=p.session.question;action(p,{kind:'answer',answer:q.answer,questionId:q.id,removedIndices:[0],revision:p.revision});assert.deepEqual(p.history.at(-1).removedIndices,[0]);
});
test('patterns have a recoverable rule, valid missing/next pictures and twelve varied picture sets',()=>{
 const p=freshProfile('beginner'),families=new Set(),themes=new Set(),unique=new Set();
 for(let i=0;i<600;i++){p.revision=i;const q=makeQuestion(p,'pattern',i),period=PATTERN_UNITS[q.family].length;families.add(q.family);themes.add(q.theme);unique.add(q.fingerprint);assert.ok(q.sequence.length>=2*period&&q.sequence.length<=10);for(let j=0;j<q.sequence.length;j++)if(j!==q.blank)assert.equal(q.sequence[j],q.unit[(j+q.phase)%period]);assert.equal(q.answer,q.unit[((['missing','repair'].includes(q.mode)?q.blank:q.sequence.length)+q.phase)%period]);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));assert.ok(new Set(q.sequence).size>=2);}
 assert.equal(families.size,7);assert.equal(themes.size,12);assert.ok(unique.size>100);
});
test('patterns adapt from saved independent outcomes and ease after errors/help, without changing the numeric ceiling',()=>{
 const p=freshProfile('beginner'),put=(ok,helped=false)=>p.history.push({ok,helped,question:{patternVersion:2}});
 assert.equal(patternLevel(p),2);for(let i=0;i<5;i++)put(true);assert.equal(patternLevel(p),3);
 for(let i=0;i<200;i++){p.revision=i;const q=makeQuestion(p,'pattern',i*6);assert.equal(q.mode,'pair');const n=q.sequence.length;assert.equal(q.answer,[q.unit[(n+q.phase)%q.unit.length],q.unit[(n+q.phase+1)%q.unit.length]].join(' '));assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));}
 put(true,true);put(false);assert.equal(patternLevel(p),2);put(false);put(false);assert.equal(patternLevel(p),1);assert.equal(makeQuestion(p,'pattern').mode,'next');assert.equal(p.ceiling,13);
 assert.equal(patternLevel(freshProfile('admin')),2);
});
