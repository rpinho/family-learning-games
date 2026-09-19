import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eraseInk} from '../lib/ink-eraser.mjs';
import {validInk} from '../lib/copy-practice.mjs';
import {freshProfile,action} from '../lib/math.mjs';
import {launchPlayer} from '../lib/player-launch.mjs';
import {drawingModes,initialDrawingMode,DRAWING_IDEAS,drawingIdeasFor} from '../lib/drawing-ideas.mjs';
import {PARTS,artVoiceLines} from '../lib/art.mjs';
import {FREE_DRAWING_SPACE,wideDrawingInk} from '../lib/drawing-space.mjs';
test('eraser splits real ink, sweeps fast moves, preserves untouched strokes and does not mutate input',()=>{
 const line=[[10,50],[90,50]],other=[[10,80],[90,80]],ink=[line,other],before=JSON.stringify(ink);
 const erased=eraseInk(ink,[50,45],[50,55]);assert.equal(erased.length,3);assert.equal(erased[2],other);
 assert.ok(erased[0].at(-1)[0]<47);assert.ok(erased[1][0][0]>53);assert.ok(validInk(erased));
 assert.equal(JSON.stringify(ink),before);assert.equal(eraseInk(ink,[5,5]),ink);
 assert.deepEqual(eraseInk([line],[0,50],[100,50]),[]);
 assert.deepEqual(eraseInk([[[50,50],[50,50]]],[50,50]),[]);
 const p=freshProfile('admin');action(p,{kind:'drawing',revision:0,strokes:erased,space:FREE_DRAWING_SPACE});assert.deepEqual(JSON.parse(JSON.stringify(p)).drawing,erased);assert.equal(p.drawingSpace,FREE_DRAWING_SPACE);assert.equal(p.xp,0);
});
test('legacy square drawings stay square and center in the wide studio exactly once',()=>{
 const old=[[[0,10],[50,20],[100,30]]];
 assert.deepEqual(wideDrawingInk(old),[[[30,10],[80,20],[130,30]]]);
 assert.deepEqual(wideDrawingInk(old,FREE_DRAWING_SPACE),old);
});
test('device launch remembers each child without a player dropdown; explicit parent links can configure it',()=>{
 for(const player of ['beginner','explorer','admin']){assert.equal(launchPlayer('',player),player);assert.equal(launchPlayer('?player='+player,'beginner'),player);}
 assert.equal(launchPlayer('?player=invalid','explorer'),'explorer');assert.equal(launchPlayer('',null),'beginner');
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.doesNotMatch(page,/<NativeSelect[^>]+aria-label="Player"/);assert.match(page,/localStorage.setItem\(PLAYER_KEY,id\)/);
});
test('Free drawing has its own destination while Number Park keeps tracing and Explorer missions',()=>{
 assert.equal(initialDrawingMode('beginner'),'trace');assert.deepEqual(drawingModes('beginner'),['trace','shapes']);
 assert.ok(drawingModes('explorer').includes('missions'));assert.ok(drawingModes('admin').includes('missions'));
 for(const name of ['circle','triangle','rectangle'])assert.ok(PARTS[name].prompt.startsWith('Draw a '+name+'.'));
 for(const line of DRAWING_IDEAS)assert.ok(artVoiceLines().includes(line));
 assert.ok(DRAWING_IDEAS.length>=20);
 assert.match(drawingIdeasFor({lastGuess:{childLabel:'person'}})[0],/family|people|portrait/i);
 const source=readFileSync(new URL('../app/drawing.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/mode==='free'&&player==='beginner'/);
});
