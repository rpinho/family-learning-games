import test from 'node:test';import assert from 'node:assert/strict';
import {wordBreakItem,wordBreakLines,literacyFrom,sentencesReady,CVC_WORDS,CVC_FAMILIES} from '../lib/word-break.mjs';
// 2026-09-27: the words track is CVC-only (same-first-letter look-alikes) until Letter Quest shows sentences built independently.
test('Word breaks for an early reader: CVC words only, look-alikes share the first letter, no sentences',()=>{
 const lines=new Set(wordBreakLines());
 for(const save of [null,{completed:40},{completed:40,maze:{practiceSkills:{reading:{level:3}}},reading:{skills:{sentence:{level:1,independent:1}}}}]){
  const level=literacyFrom(save,'words');assert.equal(level.sentenceReady,false);
  assert.equal(sentencesReady(level,[{misses:0,tiles:3,starter:true},{misses:0,tiles:3,starter:true},{misses:0,tiles:3,starter:true}]),false,'device history alone never unlocks sentences');
  for(let i=0;i<300;i++){const q=wordBreakItem(level);assert.equal(q.kind,'read-word');assert.ok(CVC_FAMILIES.includes(q.answer.slice(1)),q.answer);assert.ok(lines.has(q.spoken),q.spoken);
   assert.equal(q.options.length,3);assert.ok(q.options.includes(q.answer));
   for(const o of q.options){assert.ok(CVC_WORDS.includes(o),o);assert.equal(o[0],q.answer[0]);assert.ok([...o].filter((c,k)=>c!==q.answer[k]).length<=1);}}
 }
});
test('Sentences return once Letter Quest shows sentences built independently; the letters track is unchanged',()=>{
 const ready=literacyFrom({completed:40,reading:{skills:{sentence:{level:2,independent:2}}}},'words');let sentences=0;
 for(let i=0;i<200;i++)if(wordBreakItem(ready).kind==='sentence')sentences++;assert.ok(sentences>60);
 const kinds=new Set();for(let i=0;i<200;i++)kinds.add(wordBreakItem(literacyFrom({completed:17},'letters')).kind);assert.deepEqual([...kinds].sort(),['find-letter','first-letter']);
});
