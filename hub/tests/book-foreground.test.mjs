import test from 'node:test';import assert from 'node:assert/strict';
import {foregroundRect,paintedStanding,drawForeground} from '../public/book-foreground.mjs';
import {backgroundRect,portraitTerrace} from '../public/book-painted-layout.mjs';
const sizes=[[320,640],[390,844],[844,390],[768,1024],[1024,768],[1366,768]];
test('ground and painted targets use the same uniform transform at every size',()=>{
 for(const [width,height] of sizes){const entry={size:width<height?[836,1881]:[1774,887],focal:[.5,0],groundStart:width<height?.27:.52};
 const r=backgroundRect(entry,{width,height}),b=foregroundRect(entry,[.4,.2,.1,.1],{width,height});
 assert.ok(Math.abs(r.w/entry.size[0]-r.h/entry.size[1])<1e-9);
 assert.equal(b.x,r.x+.4*r.w);assert.equal(b.y,r.y+.2*r.h);assert.equal(b.w,.1*r.w);assert.equal(b.h,.1*r.h);
 assert.ok(r.x<=0&&r.y<=0&&r.x+r.w>=width&&r.y+r.h>=height);assert.equal(portraitTerrace({...entry,portraitHeight:.55,portraitGround:.8},{width,height}),null);
 }
});
test('an older open player receives one uniform full-image draw and never sampled strips',()=>{
 const calls=[],canvas={style:{},getContext:()=>({clearRect(){},drawImage(...a){calls.push(a);}})},img={naturalWidth:836,naturalHeight:1881};
 drawForeground(canvas,img,{size:[836,1881],focal:[.5,0]},{width:390,height:844});
 assert.equal(calls.length,1);assert.equal(calls[0].length,5);assert.ok(Math.abs(calls[0][3]/836-calls[0][4]/1881)<1e-9);
});
test('real painted ground retains story scale while the rear row adapts to the crop',()=>{
 const bg={size:[836,1881],focal:[.5,0],groundStart:.27};
 const phone=paintedStanding(bg,{width:390,height:844}),tablet=paintedStanding(bg,{width:768,height:1024});
 assert.ok(phone.minHeight>=.35&&tablet.minHeight>=.35);assert.ok(tablet.backLift<phone.backLift);
 const withUI=paintedStanding(bg,{width:768,height:1024,beat:true,uiBottom:.85});
 assert.ok(withUI.maxHeight<.12);assert.equal(withUI.minHeight,0);
});
