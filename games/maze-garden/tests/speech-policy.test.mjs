import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {onceThisSession} from '../public/word-break.mjs';
// Content (the question to answer) always plays; instructions are said once per session; praise obeys the toggle.
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
test('Word-break content passes essential through and bypasses the sound toggle',()=>{
 assert.match(app,/speak:\(line,essential\)=>say\(line,essential\)/);
 assert.match(app,/function say\(text,essential=false\)\{if\(muted&&!essential\)return;/);
});
test('Puzzle questions are content with a gentle idle repeat',()=>{
 assert.match(app,/ask\(c\.puzzle\.spoken,/);assert.match(app,/ask\(q\.puzzle\.spoken,/);
 assert.match(app,/idleLeft=IDLE_REPEATS/);
});
test('How-to-play lines are gated once per session, never said directly',()=>{
 for(const line of ['makerPlaySpeech','makerDrawSpeech'])assert.doesNotMatch(app,new RegExp(`[^.]say\\(${line}\\)`),line);
 assert.match(app,/sayOnce\('maker-play:how',makerPlaySpeech\)/);assert.match(app,/sayOnce\('trace:mission',/);
 assert.doesNotMatch(app,/say\('Sound is on\.'\)/);assert.doesNotMatch(app,/say\('Follow the open paths/);
 const store=new Map(),s={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(onceThisSession('maze-garden:maker-play:how',s),true);assert.equal(onceThisSession('maze-garden:maker-play:how',s),false);
});
test('Blocked autoplay retries the pending question on the next touch',()=>{
 assert.match(app,/NotAllowedError/);assert.match(app,/\['pointerup','touchend','click'\]/);
});
