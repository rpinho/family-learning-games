import test from 'node:test';
import assert from 'node:assert/strict';
import {applyChapterChoice} from '../public/chapter-choice.mjs';
const plan=()=>({date:'2026-03-11',level:'reader',magic:['cat','mat'],beats:[{id:'b1',kind:'spell',answer:['Dad','can','run'],tiles:['run','ran','Dad','can'],sentence:'Dad can run.'},{id:'b2',kind:'puzzle',answer:'36'}],learnerFocus:[{beat:'b1',value:'run'}]});
test('easier reduces optional reading load while keeping target, shuffled order and maths',()=>{
 const p=plan(),before=structuredClone(p),c={value:'easier',date:'2026-03-10'};
 const r=applyChapterChoice(p,c);assert.deepEqual(p.magic,['cat']);assert.deepEqual(p.beats[0].tiles,['run','Dad','can']);assert.deepEqual(p.beats[0].answer,before.beats[0].answer);assert.deepEqual(p.beats[1],before.beats[1]);assert.deepEqual(p.learnerFocus,before.learnerFocus);assert.equal(c.value,'easier');assert.equal(r.changes.length,2);
});
test('same day, future and invalid requests leave a chapter unchanged',()=>{
 for(const c of [null,{value:'easier',date:'2026-03-11'},{value:'harder',date:'2026-03-12'},{value:'easier',date:'bad'},{value:'unknown',date:'2026-03-10'}]){const p=plan(),before=structuredClone(p);assert.equal(applyChapterChoice(p,c),null);assert.deepEqual(p,before);}
});
test('harder adds at most one supplied known word, stays bounded, and never adds a spelling demand',()=>{
 const p=plan(),spell=structuredClone(p.beats);applyChapterChoice(p,{value:'harder',date:'2026-03-10'},{eligibleWords:['cat','mat','hat','bat']});assert.deepEqual(p.magic,['cat','mat','hat']);assert.deepEqual(p.beats,spell);
 p.magic=['cat','mat','hat','bat'];applyChapterChoice(p,{value:'harder',date:'2026-03-10'},{eligibleWords:['sun']});assert.equal(p.magic.length,4);
 const q=plan();applyChapterChoice(q,{value:'harder',date:'2026-03-10'});assert.deepEqual(q.magic,['cat','mat']);
});
test('early learners retain counting, letters and story keys',()=>{
 const p={...plan(),level:'early',letter:'B',reward:{key:'B'}},before=structuredClone(p);applyChapterChoice(p,{value:'easier',date:'2026-03-10'});assert.deepEqual(p,before);
});
