import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {WORDS} from '../engine.mjs';
// Content (the practice question, hints, word breaks) always plays; "You are X/O" once per session; praise obeys the toggle.
const app=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
test('Only essential lines bypass the sound toggle; word breaks pass essential through',()=>{
 assert.match(app,/async function speak\(line,essential=false\)\{if\(!line\|\|\(!sound&&!essential\)\)return;/);
 assert.match(app,/speak:\(line,essential\)=>\{lastSpeech='';void speak\(line,essential\);\}/);
 assert.match(app,/speak\(WORDS\.retry\)/);assert.doesNotMatch(app,/speak\(WORDS\.retry,true\)/);
});
test('Practice questions are content with an idle repeat; start lines are once per session',()=>{
 assert.match(app,/ask\(practiceLine\(g\),/);assert.match(app,/idleLeft=IDLE_REPEATS/);
 assert.match(app,/onceThisSession\('three-in-a-row:play:'\+key\)/);
 for(const k of ['find','block','fork','start','startO'])assert.ok(WORDS[k],k);
});
test('Blocked autoplay retries the pending question on the next touch',()=>{assert.match(app,/essential&&navigator\.userActivation&&!navigator\.userActivation\.hasBeenActive\)\{retryOnTouch\(line\)/);});
