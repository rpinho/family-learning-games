import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recognizeArt} from '../lib/symbol-recognition.mjs';
import {numberPaths} from '../lib/number-trace.mjs';
const picture=JSON.parse(readFileSync(new URL('../data/doodle-model.json',import.meta.url))),symbols=JSON.parse(readFileSync(new URL('../data/symbol-model.json',import.meta.url)));
test('only authored generated symbol fixtures: every digit and all manuscript forms',()=>{
 for(let n=0;n<=100;n++)assert.equal(recognizeArt(numberPaths(n),picture,symbols,'numbers').label,String(n));
 for(const [letter,ink]of Object.entries(symbols.glyphs))assert.ok(recognizeArt(ink,picture,symbols,/\d/.test(letter)?'numbers':'letters').candidates.includes(letter));
 assert.equal(recognizeArt([],picture,symbols,'auto').label,null);
});
