import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {bareTreeFeatures} from '../lib/picture-features.mjs';import {recognizeArt,validArtLabel} from '../lib/symbol-recognition.mjs';
const picture=JSON.parse(readFileSync(new URL('../data/doodle-model.json',import.meta.url))),symbols=JSON.parse(readFileSync(new URL('../data/symbol-model.json',import.meta.url)));
// Independent hand-authored drawings, with split outlines and uneven branches.
const tree=[[[38,8],[38,91]],[[38,8],[61,9],[62,90],[38,91]],[[40,26],[10,12]],[[60,26],[88,14]],[[39,50],[9,36]],[[61,50],[92,35]],[[40,74],[12,63]],[[60,74],[90,65]]];
const head=Array.from({length:45},(_,i)=>[50+12*Math.cos(i*Math.PI/22),24+13*Math.sin(i*Math.PI/22)]);
const person=[head,[[50,37],[49,65],[31,91]],[[49,65],[68,89]],[[49,45],[25,58]],[[49,45],[75,57]]];
const transform=ink=>ink.toReversed().map(s=>s.toReversed().map(([x,y])=>[x*.82+6,y*.82+4]));
test('Bare tree recognition tolerates separate trunk strokes, scale and pen direction',()=>{
 for(const ink of [tree,transform(tree)]){assert.ok(bareTreeFeatures(ink));for(const mode of ['auto','pictures'])assert.equal(recognizeArt(ink,picture,symbols,mode).label,'tree');}
});
test('Stick people are a supported picture and correction label without family training data',()=>{
 assert.ok(validArtLabel('person'));assert.ok(validArtLabel('face'));
 for(const ink of [person,transform(person)])for(const mode of ['auto','pictures'])assert.equal(recognizeArt(ink,picture,symbols,mode).label,'person');
});
test('Branches do not override explicit letters or mistake combs and glyphs for trees',()=>{
 for(const ink of Object.values(symbols.glyphs))assert.equal(bareTreeFeatures(ink),null);
 assert.equal(bareTreeFeatures(tree.filter((s,i)=>i<2||i%2===0)),null);
 assert.equal(bareTreeFeatures([[[25,10],[25,90],[75,90],[75,10],[25,10]],...[[30],[50],[70]].map(([y])=>[[25,y],[75,y]])]),null);
 for(const mode of ['letters','numbers'])assert.notEqual(recognizeArt(tree,picture,symbols,mode).label,'tree');
});
