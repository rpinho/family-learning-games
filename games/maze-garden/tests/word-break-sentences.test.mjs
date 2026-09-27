import test from 'node:test';import assert from 'node:assert/strict';
import {wordBreakItem,literacyFrom,sentencesReady,STARTER_SENTENCES,SENTENCES,tilesOf,wordBreakLines} from '../public/word-break.mjs';
const seq=values=>{let i=0;return ()=>values[i++%values.length];};
const words=save=>literacyFrom(save,'words');
test('Sentences wait until a reader has built sentences independently; before that, CVC words only',()=>{
 // Letter Quest's Sentence studio tried four times, never on his own: not ready.
 const notYet=words({completed:30,reading:{skills:{sentence:{level:1,tried:4,independent:0}}}});
 assert.equal(notYet.sentenceReady,false);
 const ready=words({completed:30,reading:{skills:{sentence:{level:2,tried:6,independent:3}}}});
 assert.equal(ready.sentenceReady,true);
 assert.equal(words(null).sentenceReady,false);
 for(let i=0;i<400;i++){const q=wordBreakItem(notYet);assert.equal(q.kind,'read-word');assert.equal(q.cvc,true);assert.ok(q.options.every(o=>o[0]===q.answer[0]));}
 const full=new Set(SENTENCES.flat());let n=0;
 for(let i=0;i<200;i++){const q=wordBreakItem(ready);if(q.kind==='sentence'){n++;assert.ok(full.has(q.sentence),q.sentence);}}
 assert.ok(n>0);
});
test('Device history moves a ready reader between starters and full sentences; it never unlocks sentences on its own',()=>{
 const notYet=words({completed:30}),ready=words({completed:30,reading:{skills:{sentence:{independent:2}}}});
 const clean={misses:0,tiles:4,starter:true},guess={misses:9,tiles:6,starter:false};
 assert.equal(sentencesReady(notYet,[clean,clean,clean]),false);
 assert.equal(sentencesReady(ready,[guess]),true);
 assert.equal(sentencesReady(ready,[guess,guess]),false);
 assert.equal(sentencesReady(ready,[guess,guess,clean,clean,clean].slice(-3)),true);
 // Forced roll: a starter for a ready reader who has been guessing; a full sentence otherwise.
 assert.equal(wordBreakItem(ready,{r:seq([0.1,0.5,0.5,0.5]),sentences:[guess,guess]}).starter,true);
 assert.equal(wordBreakItem(ready,{r:seq([0.1]),sentences:[clean,clean,clean]}).starter,undefined);
 assert.equal(wordBreakItem(notYet,{r:seq([0.1]),sentences:[clean,clean,clean]}).kind,'read-word');
});
test('Starter sentences are short, voiced and never presented in order',()=>{
 const lines=new Set(wordBreakLines());
 for(const s of STARTER_SENTENCES){assert.ok(lines.has(s),s);const n=tilesOf(s).length;assert.ok(n>=3&&n<=4,s);}
 const ready=words({completed:30,reading:{skills:{sentence:{independent:2}}}}),guess={misses:9,tiles:6,starter:false};
 for(let i=0;i<100;i++){const q=wordBreakItem(ready,{r:Math.random,sentences:[guess,guess]});if(q.starter)assert.notDeepEqual(q.tiles,q.answer);}
});
