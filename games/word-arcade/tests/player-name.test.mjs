import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Every loaded arcade screen has a prominent active-player banner',()=>{
 const view=readFileSync(new URL('../app/Arcade.jsx',import.meta.url),'utf8'),css=readFileSync(new URL('../app/player-banner.css',import.meta.url),'utf8');
 assert.match(view,/aria-label="Active player"/);assert.match(view,/id==='admin'\?'Admin · Admin':p.name/);assert.match(css,/position:fixed;inset:0 0 auto/);assert.match(css,/font-size:32px/);assert.match(css,/padding-top:52px/);
});
