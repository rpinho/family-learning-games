import test from 'node:test';
import assert from 'node:assert/strict';
import {standingGround,backgroundRect,applyBackgroundLayouts} from '../public/book-painted-layout.mjs';
const sizes=[[320,640],[390,844],[844,390],[768,1024],[1366,768]];
test('activity and back-row feet stay below the painted standing plane across cover crops',()=>{
 const b={fit:'cover',size:[1536,1024],focal:[.5,.5],groundStart:.72};
 for(const [width,height] of sizes){const r=backgroundRect(b,{width,height}),floor=(r.y+b.groundStart*r.h)/height;
  const g=standingGround(b,{width,height,ground:.64});assert.ok(g-.05>=floor+.02-1e-9);
  assert.ok(g>=.64&&g<=.97);assert.ok(r.x<=0&&r.y<=0&&r.x+r.w>=width&&r.y+r.h>=height);
 }
 assert.equal(standingGround({},{width:390,height:844,ground:.64}),.64);
 assert.equal(standingGround({...b,groundStart:NaN},{width:390,height:844,ground:.64}),.64);
});
test('release layout overrides preserve art ids, targets and source data',()=>{
 const library={backgrounds:{room:{file:'room.webp',fit:'contain',targets:{marks:[{id:'1',r:[.45,.4,.05,.05]}]},keepOut:[{r:[.3,.2,.4,.3]}]},yard:{file:'yard.webp'}},actors:{},props:{}};
 const before=JSON.stringify(library),out=applyBackgroundLayouts(library,{room:{fit:'cover',portraitHeight:null,floorColor:null,size:[1536,1024],groundStart:.7},missing:{fit:'cover'}});
 assert.equal(JSON.stringify(library),before);assert.deepEqual(Object.keys(out.backgrounds),['room','yard']);
 assert.equal(out.backgrounds.room.file,'room.webp');assert.deepEqual(out.backgrounds.room.targets,library.backgrounds.room.targets);assert.equal(out.backgrounds.yard,library.backgrounds.yard);
 assert.equal(out.backgrounds.room.groundStart,.7);assert.equal(out.backgrounds.room.fit,'cover');
});
