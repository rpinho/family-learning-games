import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// No dead ends, in a real browser: every beat type (letters book, quest book, classic reader) with the right answer,
// wrong answers, no input and "Hear it again" mid-beat. Slow (a headless Chrome, a few minutes), so it runs only
// when asked: BOOK_BROWSER_TESTS=1 node --test hub/tests/book-beats-browser.test.mjs
test('every beat can always be finished (right, wrong, no input, Hear it again)',{skip:process.env.BOOK_BROWSER_TESTS!=='1'},()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-beats.mjs',import.meta.url)),'--json'],{encoding:'utf8',timeout:30*60e3});
 const out=JSON.parse(r.stdout.trim().split('\n').at(-1));assert.equal(out.ok,true,JSON.stringify(out.failures,null,1));assert.ok(out.checked>=50);
});
