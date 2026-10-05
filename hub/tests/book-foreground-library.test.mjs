import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {mergeArtLibrary} from '../book-service.mjs';
import {selectBackground,applyBackgroundLayouts} from '../public/book-painted-layout.mjs';
import {readLibrary} from '../../book/generate.mjs';
import {bookPaths} from '../../book/paths.mjs';
import {artFor,composeScene,zonesOnScreen} from '../public/book-scene.mjs';
import {paintedStanding} from '../public/book-foreground.mjs';
// Public geometry checks use only the repository's fictional cast and scenery.
const library=applyBackgroundLayouts(JSON.parse(readFileSync(new URL('../public/book-art/library.json',import.meta.url),'utf8')),JSON.parse(readFileSync(new URL('../book-art-layouts.json',import.meta.url),'utf8')));
const ids=['hero','bo','grown-up','pip'];
const scene={actors:ids.map(id=>({id,pose:'idle'})),props:[]};
const art=artFor(Object.keys(library.backgrounds).map(bg=>({scene:{...scene,bg}})),library);
for(const [id,b] of Object.entries(art.backgrounds))test(`foreground minimum and protected objects: ${id}`,()=>{
 for(const [width,height] of [[320,640],[390,844],[844,390],[768,1024],[1024,768],[1366,768]]){
  const bg=selectBackground(b,{width,height});if(!bg.realForeground)continue;const standing=paintedStanding(bg,{width,height}),{ground,maxHeight}=standing,keepOut=zonesOnScreen(bg,{width,height,still:true});
  for(const pose of ['idle','cheer']){
   const members=ids.map(id=>({id,pose:library.actors[id].poses[pose]?pose:'idle'}));
   const currentArt={...art,actors:{...art.actors,...artFor([{scene:{bg:id,actors:members,props:[]}}],library).actors}};
  const L=composeScene({actors:members,props:[]},currentArt,{width,height,ground,maxHeight,keepOut,minHeight:standing.minHeight,backLift:standing.backLift});
  assert.equal(L.actors.length,ids.length);
  assert.ok(L.actors.find(a=>a.id==='grown-up').height>=.35-1e-9,`${width}x${height} Dad ${L.actors.find(a=>a.id==='grown-up').height}`);
  for(const a of L.actors){assert.ok(a.left>=-.001&&a.left+a.width<=1.001&&a.bottom+a.height<=1,`${width}x${height} ${a.id} clipped`);
   for(const z of keepOut)assert.ok(!(a.left<z.x1&&a.left+a.width>z.x0&&1-a.bottom-a.height*1.15<z.y1&&1-a.bottom>z.y0),`${width}x${height} ${a.id} covers ${z.name}`);
  }
  }
 }
});
