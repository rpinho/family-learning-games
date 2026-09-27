import test from 'node:test';import assert from 'node:assert/strict';
import {wordBreakItem,literacyFrom,sentencesReady,STARTER_SENTENCES,SENTENCES,tilesOf,wordBreakLines} from '../public/word-break.mjs';
const seq=values=>{let i=0;return ()=>values[i++%values.length];};
const words=save=>literacyFrom(save,'words');
test('Full sentences wait until a reader has built sentences independently',()=>{
 // Letter Quest's Sentence studio tried four times, never on his own: not ready.
 const notYet=words({completed:30,reading:{skills:{sentence:{level:1,tried:4,independent:0}}}});
 assert.equal(notYet.sentenceReady,false);
 const ready=words({completed:30,reading:{skills:{sentence:{level:2,tried:6,independent:3}}}});
 assert.equal(ready.sentenceReady,true);
 assert.equal(words(null).sentenceReady,false);
 const kinds={sentence:0,'read-word':0},starters=new Set(STARTER_SENTENCES);
 for(let i=0;i<400;i++){const q=wordBreakItem(notYet);kinds[q.kind]++;if(q.kind==='sentence'){assert.ok(starters.has(q.sentence));assert.equal(q.starter,true);assert.ok(q.tiles.length<=4);assert.deepEqual([...q.tiles].sort(),[...q.answer].sort());}}
 assert.ok(kinds['read-word']>kinds.sentence*2,JSON.stringify(kinds));assert.ok(kinds.sentence>0);
 const full=new Set(SENTENCES.flat());
 for(let i=0;i<200;i++){const q=wordBreakItem(ready);if(q.kind==='sentence')assert.ok(full.has(q.sentence),q.sentence);}
});
test('Device history moves a reader between starters and full sentences',()=>{
 const notYet=words({completed:30}),ready=words({completed:30,reading:{skills:{sentence:{independent:2}}}});
 const clean={misses:0,tiles:4,starter:true},guess={misses:9,tiles:6,starter:false};
 assert.equal(sentencesReady(notYet,[clean,clean]),false);
 assert.equal(sentencesReady(notYet,[clean,clean,clean]),true);
 assert.equal(sentencesReady(notYet,[clean,{...clean,misses:3},clean]),false);
 assert.equal(sentencesReady(ready,[guess]),true);
 assert.equal(sentencesReady(ready,[guess,guess]),false);
 assert.equal(sentencesReady(ready,[guess,guess,clean,clean,clean].slice(-3)),true);
 // Forced roll: a starter when not ready, a full sentence when ready.
 assert.equal(wordBreakItem(notYet,{r:seq([0.1,0.5,0.5,0.5])}).starter,true);
 assert.equal(wordBreakItem(notYet,{r:seq([0.1]),sentences:[clean,clean,clean]}).starter,undefined);
});
test('Starter sentences are short, voiced and never presented in order',()=>{
 const lines=new Set(wordBreakLines());
 for(const s of STARTER_SENTENCES){assert.ok(lines.has(s),s);const n=tilesOf(s).length;assert.ok(n>=3&&n<=4,s);}
 for(let i=0;i<100;i++){const q=wordBreakItem(words({completed:30}),{r:Math.random});if(q.starter)assert.notDeepEqual(q.tiles,q.answer);}
});
