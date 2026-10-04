import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {artFor} from '../public/book-scene.mjs';
import {selectBackground} from '../public/book-painted-layout.mjs';
const library=JSON.parse(await readFile(new URL('../public/book-art/library.json',import.meta.url)));
test('a serialized chapter retains both painted count coordinates and the gate reveal in either orientation',()=>{
 const scene=(bg,fx='none')=>({bg,fx,actors:[{id:'hero',pose:'idle'}],props:[]});
 const art=JSON.parse(JSON.stringify(artFor([{scene:scene('castle-gate','gate-open')},{scene:scene('volcano')}],library)));
 for(const [width,height] of [[1280,720],[390,844]]){
  const volcano=selectBackground(art.backgrounds.volcano,{width,height});
  assert.equal(volcano.targets.stones.length,12);
  assert.ok(volcano.targets.stones.every(t=>t.r.length===4));
  assert.match(volcano.url,width<height?/Portrait.webp$/:/Landscape.webp$/);
  const gate=selectBackground(art.backgrounds['castle-gate'],{width,height});assert.equal(gate.door.length,4);
 }
 assert.match(art.props['treasure-chest'].url,/treasure-chest.webp$/);
 assert.match(art.actors.hero.poses.cheer.url,/hero-cheer.webp$/);
 assert.equal(art.actors.bo,undefined,'unreferenced characters are not included');
 assert.equal(art.backgrounds['pirate-ship'],undefined,'unreferenced paintings are not included');
});
