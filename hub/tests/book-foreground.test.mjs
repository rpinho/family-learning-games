import test from 'node:test';
import assert from 'node:assert/strict';
import {foregroundProjection,foregroundRect,foregroundZones,drawForeground} from '../public/book-foreground.mjs';
const sizes=[[320,640],[390,844],[844,390],[768,1024],[1024,768],[1366,768]];
const painting={size:[1200,1200],fit:'cover',groundStart:.6,standBand:[.36,.68],keepOut:[{name:'parked object',r:[.3,.25,.3,.3]},{name:'left border',r:[0,.6,.28,.4]}]};
test('foreground uses the scene ground without stretching its texture or sampling protected objects',()=>{
 for(const [width,height] of sizes){const p=foregroundProjection(painting,{width,height}),s=p.sample;
  assert.ok(s.x>=0&&s.x+s.w<=1&&s.y>=.6&&s.y+s.h<=1);
  assert.ok(Math.abs(s.w/s.h-width/((1-p.floor)*height))<1e-9,'same source and destination texture aspect');
  for(const z of foregroundZones(painting,{width,height}))assert.ok(z.y1<=p.floor+.002+1e-9,'painted objects remain above the standing area');
  const marker=[.4,.3,.05,.05],r=foregroundRect(painting,marker,{width,height});
  const a=p.row(marker[1]);assert.ok(Math.abs(r.x-(a.x+marker[0]*a.w))<1e-8);
  assert.ok(r.x>=0&&r.x+r.w<=width&&r.y>=0&&r.y+r.h<=p.floor*height);
 }
});
test('a central pole extending into the old floor is kept above the new foreground',()=>{
 const b={...painting,keepOut:[{name:'pole',r:[.49,.1,.03,.63]}]};
 for(const [width,height] of sizes){const p=foregroundProjection(b,{width,height});assert.equal(p.cut,.73);
  assert.ok(foregroundZones(b,{width,height}).every(z=>z.y1<=p.floor+.002+1e-9));
 }
});
test('the still painted foreground draws twice per layout rather than running an animation loop',()=>{
 const calls=[],context={save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(...args){calls.push(args);}};
 const canvas={getContext:()=>context},img={naturalWidth:1200,naturalHeight:1200};
 drawForeground(canvas,img,painting,{width:390,height:844});
 assert.equal(canvas.width,390);assert.equal(canvas.height,844);assert.equal(calls.length,2);
 assert.equal(calls[1].length,9);assert.equal(calls[1][5],0);assert.equal(calls[1][7],390);
 assert.ok(Math.abs(calls[1][6]+calls[1][8]-844)<1e-8,'ground reaches the viewport bottom');
});
