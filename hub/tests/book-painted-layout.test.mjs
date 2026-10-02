import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundRect,portraitTerrace} from '../public/book-painted-layout.mjs';
const painting={fit:'contain',portraitHeight:.55,foreground:.61,portraitGround:.56};
test('portrait extends only dry painted ground to the screen bottom',()=>{
 for(const [width,height] of [[320,640],[390,844],[768,1024]]){
  const r=backgroundRect(painting,{width,height}),t=portraitTerrace(painting,{width,height});
  assert.equal(t.top,r.y+painting.foreground*r.h);assert.equal(t.top+t.height,height);
  assert.ok(Math.abs(t.imageHeight*(1-painting.foreground)-t.height)<1e-8);
  assert.equal(t.left,r.x);assert.equal(t.width,r.w);assert.equal(t.ground,.56);
 }
});
test('landscape projection remains contained and has no terrace extension',()=>{
 for(const [width,height] of [[844,390],[1024,768],[1366,768]]){
  const r=backgroundRect(painting,{width,height});assert.equal(r.y,0);assert.ok(r.w<=width&&r.h<=height);assert.equal(portraitTerrace(painting,{width,height}),null);
 }
});
test('ordinary backgrounds keep their cover crop and have no extension',()=>{
 assert.deepEqual(backgroundRect({}, {width:1536,height:1024}),{x:0,y:0,w:1536,h:1024});
 assert.equal(portraitTerrace({}, {width:390,height:844}),null);
});
test('square full-bleed art retains its central painted targets across screen shapes',()=>{
 const entry={fit:'cover',size:[1254,1254],focal:[.5,.5]};
 for(const [width,height] of [[320,640],[390,844],[768,1024],[1024,768],[1366,768]]){
  const r=backgroundRect(entry,{width,height});
  assert.ok(r.x<=0&&r.y<=0&&r.x+r.w>=width&&r.y+r.h>=height);
  for(const [x,y] of [[.296,.444],[.703,.452],[.379,.285],[.617,.379]]){
   assert.ok(r.x+x*r.w>=0&&r.x+x*r.w<=width);
   assert.ok(r.y+y*r.h>=0&&r.y+y*r.h<=height);
  }
  assert.equal(portraitTerrace(entry,{width,height}),null);
 }
 assert.deepEqual(backgroundRect({...entry,focal:[.25,.75]},{width:500,height:1000}),{x:-125,y:0,w:1000,h:1000});
});
