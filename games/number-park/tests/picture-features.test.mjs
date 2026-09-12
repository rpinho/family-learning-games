import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sunFeatures,flowerFeatures} from '../lib/picture-features.mjs';
import {recognizeArt} from '../lib/symbol-recognition.mjs';
const picture=JSON.parse(readFileSync(new URL('../data/doodle-model.json',import.meta.url))),symbols=JSON.parse(readFileSync(new URL('../data/symbol-model.json',import.meta.url)));
const sun=(n=8,rx=22,ry=22)=>{
 const point=(a,r=1)=>[50+rx*r*Math.cos(a),50+ry*r*Math.sin(a)];
 return [Array.from({length:41},(_,i)=>point(i*Math.PI/20)),...Array.from({length:n},(_,i)=>[point(i*Math.PI*2/n,1.08),point(i*Math.PI*2/n,1.7)])];
};
const flower=(petals=6,shade=false)=>{
 const outline=Array.from({length:361},(_,i)=>{const a=i*Math.PI/180,r=23+6*Math.cos(petals*a);return [50+r*Math.cos(a),31+r*.8*Math.sin(a)];});
 const centre=Array.from({length:101},(_,i)=>{const a=i*Math.PI/50,r=shade?9-i%7*.6:9;return [50+r*Math.cos(a),31+r*.8*Math.sin(a)];});
 return [outline,centre,[[50,50],[50,90]]];
};
test('Petal/centre/stem corroboration tolerates shading, different petal counts and stroke order',()=>{
 for(const n of [5,6,8])for(const shade of [false,true]){
  const ink=flower(n,shade);assert.ok(flowerFeatures(ink),`${n} petals, shade ${shade}`);
  assert.ok(flowerFeatures(ink.toReversed().map(s=>s.toReversed())));
  assert.ok(flowerFeatures(ink.map(s=>s.map(([x,y])=>[x*.72+8,y*.72+5]))));
 }
});
test('Flower geometry does not turn suns, trees, glyphs or stemless petal patterns into flowers',()=>{
 assert.equal(flowerFeatures(sun()),null);
 for(const ink of Object.values(symbols.glyphs))assert.equal(flowerFeatures(ink),null);
 const tree=flower();tree[0]=Array.from({length:121},(_,i)=>[50+27*Math.cos(i*Math.PI/60),30+22*Math.sin(i*Math.PI/60)]);assert.equal(flowerFeatures(tree),null);
 assert.equal(flowerFeatures(flower().slice(0,2)),null);
 assert.equal(flowerFeatures([]),null);
});
test('round centres with outward rays: varied sizes, ovals, order and pen direction',()=>{
 for(const n of [6,8,12,16])for(const [rx,ry] of [[22,22],[18,27],[27,18]]){
  const ink=sun(n,rx,ry);assert.ok(sunFeatures(ink));assert.ok(sunFeatures(ink.map(s=>s.toReversed()).toReversed()));
  assert.ok(sunFeatures(ink.map(s=>s.map(([x,y])=>[x*.7+4,y*.7+7]))));
 }
 for(const mode of ['auto','pictures'])assert.equal(recognizeArt(sun(),picture,symbols,mode).label,'sun');
});
test('no structural sun for letters, digits, polygons, petals, clock hands, or composite pictures',()=>{
 for(const ink of Object.values(symbols.glyphs))assert.equal(sunFeatures(ink),null);
 assert.equal(sunFeatures(sun().slice(0,5)),null);
 const clock=sun();for(const ray of clock.slice(1))ray[1]=[50,50];assert.equal(sunFeatures(clock),null);
 const flower=sun();for(const ray of flower.slice(1))ray.push(ray[0]);assert.equal(sunFeatures(flower),null);
 const composite=sun();composite.push([[0,0],[95,0],[95,95],[0,95],[0,0]]);assert.equal(sunFeatures(composite),null);
 const polygon=sun();polygon[0]=[[28,28],[72,28],[72,72],[28,72],[28,28]];assert.equal(sunFeatures(polygon),null);
 assert.equal(sunFeatures([]),null);
});
test('letter identity can be clear even when case is not; other identity ambiguities remain',()=>{
 const v=[[[20,15],[50,85]],[[80,15],[50,85]]];
 const result=recognizeArt(v,picture,symbols,'auto');assert.equal(result.label,'V');assert.equal(result.caseAmbiguous,true);
 assert.ok(result.candidates.includes('v'));assert.ok(result.candidates.includes('V'));
 for(const label of ['O','l'])assert.equal(recognizeArt(symbols.glyphs[label],picture,symbols,'auto').label,null);
});
