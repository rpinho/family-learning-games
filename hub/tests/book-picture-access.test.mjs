import test from 'node:test';
import assert from 'node:assert/strict';
import {selectBackground,paintedTapRect,MIN_PAINTED_TAP} from '../public/book-painted-layout.mjs';
import {foregroundRect} from '../public/book-foreground.mjs';
const sizes=[[320,640],[390,844],[844,390],[768,1024],[1024,768],[1366,768]];
test('turning uses the matching image and its coordinates without mutating the saved art',()=>{
 const landscape={url:'wide.webp',size:[1536,1024],targets:{stones:[{r:[.1,.4,.1,.1]}]},variants:{portrait:{url:'tall.webp',size:[1024,1536],targets:{stones:[{r:[.4,.3,.2,.1]}]}}}};
 const copy=JSON.stringify(landscape);
 for(const [width,height] of sizes){const bg=selectBackground(landscape,{width,height});assert.equal(bg.url,width<height?'tall.webp':'wide.webp');assert.deepEqual(bg.targets.stones[0].r,width<height?[.4,.3,.2,.1]:[.1,.4,.1,.1]);}
 assert.equal(JSON.stringify(landscape),copy);
});
test('small painted targets retain generous on-screen touch boxes at every device size and screen edge',()=>{
 for(const [width,height] of sizes)for(const [x,y] of [[0,0],[width-4,height-4],[width/2,height/2]]){
  const r=paintedTapRect({x,y,w:4,h:4},{width,height});assert.ok(r.w>=MIN_PAINTED_TAP&&r.h>=MIN_PAINTED_TAP);assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);
 }
});
test('aspect variants preserve important objects with a uniform crop',()=>{
 const bg={size:[1774,887],focal:[.5,0],keepOut:[{r:[.35,.2,.3,.2]}],variants:{portrait:{size:[836,1881],keepOut:[{r:[.35,.16,.3,.1]}]}}};
 for(const [width,height] of sizes){const b=selectBackground(bg,{width,height});for(const z of b.keepOut){const r=foregroundRect(b,z.r,{width,height});assert.ok(r.x>=0&&r.x+r.w<=width&&r.y>=0&&r.y+r.h<=height);}}
});
