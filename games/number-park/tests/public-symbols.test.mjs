import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recognizeArt,validArtLabel,guessLine,guessVoiceLines} from '../lib/symbol-recognition.mjs';
import {numberPaths} from '../lib/number-trace.mjs';
import {inkStats} from '../lib/doodle.mjs';
const picture=JSON.parse(readFileSync(new URL('../data/doodle-model.json',import.meta.url))),symbols=JSON.parse(readFileSync(new URL('../data/symbol-model.json',import.meta.url)));
const printed=text=>{const cell=150/text.length,height=Math.min(65,cell*1.8),out=[];let x=4;for(const ch of text){const ink=symbols.glyphs[ch],b=inkStats(ink),width=Math.min(cell-3,height*b.w/b.h);for(const stroke of ink)out.push(stroke.map(([px,py])=>[x+(px-b.x)/Math.max(b.w,1)*width,12+(py-b.y)/Math.max(b.h,1)*height]));x+=cell;}return out;};
test('only authored generated symbol fixtures: every digit and all manuscript forms',()=>{
 for(let n=0;n<=100;n++)assert.equal(recognizeArt(numberPaths(n),picture,symbols,'numbers').label,String(n));
 for(const [letter,ink]of Object.entries(symbols.glyphs))assert.ok(recognizeArt(ink,picture,symbols,/\d/.test(letter)?'numbers':'letters').candidates.includes(letter));
 assert.equal(recognizeArt([],picture,symbols,'auto').label,null);
});
test('authored printed words and large digit strings are local, bounded guesses',()=>{
 assert.equal(recognizeArt(printed('1044'),picture,symbols,'auto').label,'1044');
 assert.equal(recognizeArt(printed('ROOK'),picture,symbols,'words').label,'ROOK');
 for(const label of ['1044','999999','elephant'])assert.equal(validArtLabel(label),true);
 for(const label of ['1000000','two words','<script>'])assert.equal(validArtLabel(label),false);
 assert.equal(guessLine('1044'),'Is it 1,044?');
 assert.deepEqual(guessVoiceLines('1044'),['I see the number.','1','0','4','4']);
});
