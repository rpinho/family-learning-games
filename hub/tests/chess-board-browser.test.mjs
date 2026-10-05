import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Every piece on the board is seen, in a real browser, on the family's screens: lessons, practice, matches as White
// and Black (check, captures, hints and undo while the request is in flight, the result screen and its replay).
// Slow (a headless Chrome), so it runs only when asked: CHESS_BROWSER_TESTS=1 node --test hub/tests/chess-board-browser.test.mjs
test('no piece is ever hidden, clipped or covered',{skip:process.env.CHESS_BROWSER_TESTS!=='1'},()=>{
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-chess-board.mjs',import.meta.url)),'--quick'],{encoding:'utf8',timeout:30*60e3});
 const out=JSON.parse(r.stdout);assert.equal(out.ok,true,JSON.stringify(out.failures,null,1));assert.ok(out.piecesChecked>=5000);
});
