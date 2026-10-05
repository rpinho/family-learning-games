import test from 'node:test';
import assert from 'node:assert/strict';
import {standingGround,standingClearance,standingWithUI,backgroundRect,applyBackgroundLayouts} from '../public/book-painted-layout.mjs';
import {artFor,composeScene} from '../public/book-scene.mjs';
const sizes=[[320,640],[390,844],[844,390],[768,1024],[1366,768]];
test('answers filling the walkable path keep the family below the buttons and inside the path',()=>{
 const bg={size:[1024,1024],fit:'cover',standBand:[.36,.68]},width=1024,height=768,ground=.97;
 const actors=Object.fromEntries(['hero','dad','mom','brother','friend'].map(id=>[id,{h:.5,poses:{idle:{ar:.65}}}]));
 const scene={actors:Object.keys(actors).map(id=>({id,pose:'idle'})),props:[]};
 const ui={x0:.3,x1:.7,y1:.84};
 const o=standingWithUI(bg,{width,height,ground,maxHeight:.3,ui});
 const L=composeScene(scene,{actors,props:{}},{width,height,ground,...o,oneRow:true});
 assert.equal(L.actors.length,5);
 for(const a of L.actors){assert.ok(a.left>=.36-1e-8&&a.left+a.width<=.68+1e-8);assert.ok(1-a.bottom-a.height*1.15>=ui.y1+12/height-1e-8);}
 const side=standingWithUI(bg,{width,height,ground,maxHeight:.3,ui:{x0:.35,x1:.48,y1:.84}});
 assert.equal(side.maxHeight,.3);assert.deepEqual(side.avoid[0],[.35,.48]);
 assert.deepEqual(standingWithUI({}, {width,height,ground,maxHeight:.3,avoid:[.2,.3]}),{maxHeight:.3,avoid:[.2,.3]});
});
test('a broad painted object retains clearance for heads, hops and the rear standing row',()=>{
 const z={x0:-.1,x1:1.1,y0:.2,y1:.5},ground=.73,height=844,backLift=.05;
 const h=standingClearance([z],{ground,maxHeight:.4,height,backLift});
 assert.ok(ground-backLift-h*1.15>=z.y1+12/height-1e-9);
 assert.equal(standingClearance([{...z,x0:.48,x1:.52}],{ground,maxHeight:.4,height}),.4,'a thin pole keeps its side bands');
});
test('activity and back-row feet stay below the painted standing plane across cover crops',()=>{
 const b={fit:'cover',size:[1536,1024],focal:[.5,.5],groundStart:.72};
 for(const [width,height] of sizes){const r=backgroundRect(b,{width,height}),floor=(r.y+b.groundStart*r.h)/height;
  const g=standingGround(b,{width,height,ground:.64});assert.ok(g-.05>=floor+.02-1e-9);
  assert.ok(g>=.64&&g<=.97);assert.ok(r.x<=0&&r.y<=0&&r.x+r.w>=width&&r.y+r.h>=height);
 }
 assert.equal(standingGround({},{width:390,height:844,ground:.64}),.64);
 assert.equal(standingGround({...b,groundStart:NaN},{width:390,height:844,ground:.64}),.64);
});
test('release layout overrides preserve art ids, targets and source data; serialization carries the standing plane',()=>{
 const library={backgrounds:{room:{file:'room.webp',fit:'contain',targets:{marks:[{id:'1',r:[.45,.4,.05,.05]}]},keepOut:[{r:[.3,.2,.4,.3]}]},yard:{file:'yard.webp'}},actors:{},props:{}};
 const before=JSON.stringify(library),out=applyBackgroundLayouts(library,{room:{fit:'cover',portraitHeight:null,floorColor:null,size:[1536,1024],groundStart:.7},missing:{fit:'cover'}});
 assert.equal(JSON.stringify(library),before);assert.deepEqual(Object.keys(out.backgrounds),['room','yard']);
 assert.equal(out.backgrounds.room.file,'room.webp');assert.deepEqual(out.backgrounds.room.targets,library.backgrounds.room.targets);assert.equal(out.backgrounds.yard,library.backgrounds.yard);
 const art=artFor([{scene:{bg:'room',actors:[],props:[]}}],out);assert.equal(art.backgrounds.room.groundStart,.7);assert.equal(art.backgrounds.room.fit,'cover');assert.ok(!('portraitHeight' in art.backgrounds.room));
});
