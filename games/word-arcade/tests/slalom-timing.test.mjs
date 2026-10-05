import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {gapAfterGate,COURSE,FEEDBACK_SHARE} from '../lib/slalom-timing.mjs';
import {budgetReport,slalomTimingLines,trackLines} from '../lib/slalom-budget.mjs';
import {slalomRun} from '../lib/slalom.mjs';import {literacyFrom} from '../lib/word-break.mjs';
// Synthetic durations exercise the timing budget without redistributing a voice-cache manifest.
const seconds=JSON.parse(readFileSync(new URL('./fixtures/slalom-clip-seconds.json',import.meta.url),'utf8'));
test('The clip-length fixture covers every feedback line and question a run can say',()=>{for(const l of slalomTimingLines())assert.ok(seconds[l]>0,`missing ${l}: regenerate the fixture`);
 const lines=new Set(slalomTimingLines());
 for(let seed=0;seed<60;seed++)for(const level of [literacyFrom({completed:60},'letters'),literacyFrom(null,'words')])for(const g of slalomRun(level,{seed}))for(const l of [g.prompt,g.praise,g.correction])assert.ok(lines.has(l),l);});
test('After a gate, the feedback and the next question fit before the next row: both boys, base and go-faster speed, and support rows',()=>{
 const r=budgetReport(seconds);
 for(const c of r.cases){assert.ok(c.feedbackShare<=FEEDBACK_SHARE,`${c.track} ${c.speed}: feedback ${c.feedback}s is ${Math.round(c.feedbackShare*100)}% of ${c.toRowAtPass}s`);
  assert.ok(c.secondsLeftAfterPrompt>=2.2,`${c.track} ${c.speed}: question ends ${c.secondsLeftAfterPrompt}s before the row`);if(!c.track.includes('support'))assert.equal(c.slowedForPrompt,false,`${c.track} ${c.speed}: slowed for the question`);assert.equal(c.ok,true);}
 assert.deepEqual(r.cases.map(c=>c.speed),['base','go-faster','base','go-faster','base','support','from go-faster']);
 // support rows: the sound-out is heard in full, then ~2 s or more to look, at a calmer cruise
 assert.ok(r.cases.filter(c=>c.track.includes('support')).every(c=>c.worstPrompt.startsWith('Sound out')&&c.secondsLeftAfterPrompt>=2.2));
});
test('The budget catches the old letter-by-letter sound-out after a gate',()=>{
 const old=gapAfterGate({feedback:3.54,prompt:seconds['Find the word mat.'],v0:COURSE.boostSpeed,boost:true});assert.equal(old.ok,false);assert.ok(old.feedbackShare>0.8);
 for(const t of Object.values(trackLines()))assert.ok(t.feedback.every(l=>!l.startsWith('Sound out')));
});
