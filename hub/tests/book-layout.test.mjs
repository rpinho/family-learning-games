import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTrain,layoutActors,coverBand,RIDER_SHOWS} from '../public/book-scene.mjs';
const art={props:{train:{ar:1.508,cars:{parts:[{x:[0,.273]},{x:[.273,.518]},{x:[.507,1],engine:true}],rim:.55,inner:.86}}},
 actors:{kid:{h:.5,poses:{idle:{ar:.44}}},dad:{h:.64,poses:{idle:{ar:.52}}},big:{h:.4,poses:{idle:{ar:.73}}},small:{h:.26,poses:{idle:{ar:.73}}},twins:{h:.26,poses:{idle:{ar:1.44}}}}};
const A=ids=>ids.map(id=>({id,pose:'idle'}));
for(const [W,H] of [[390,844],[1366,768],[844,390]])test(`Train at ${W}x${H}: one wagon per rider, nobody on the engine, all on screen, Dad tallest`, () => {
 const L=layoutTrain(A(['kid','dad','big','small']),art,{width:W,height:H});
 const wagons=L.parts.filter(p=>p.kind==='wagon'),engine=L.parts.find(p=>p.kind==='engine');
 assert.equal(wagons.length,4);assert.equal(L.parts.at(-1).kind,'engine');
 for(const r of L.riders){const w=wagons[r.wagon];
  assert.ok(r.left>=w.left-1e-9&&r.left+r.width<=w.left+w.width+1e-9,'inside its wagon');assert.ok(r.left+r.width<=engine.left+1e-9,'not over the engine');
  assert.ok(r.left>=0&&r.left+r.width<=1&&r.bottom+r.height<=1,'on screen');
  assert.ok(Math.abs((L.rimY-r.bottom)/r.height-(1-RIDER_SHOWS))<1e-9,'shows most of himself above the rim');}
 const h=Object.fromEntries(L.riders.map(r=>[r.id,r.height]));assert.ok(h.dad>=h.kid&&h.kid>=h.big*0.99,JSON.stringify(h));
 assert.ok(L.train.left>=0&&L.train.left+L.train.width<=1);
});
test('Two riders still get two wagons; the smallest is never under 60% of the tallest', () => {
 const L=layoutTrain(A(['dad','twins']),art,{width:1366,height:768});assert.equal(L.parts.filter(p=>p.kind==='wagon').length,2);
 const [d,t]=L.riders;assert.ok(t.height>=0.6*d.height-1e-9||t.width>=L.parts[1].width*0.85,'small friend visible');
});
test('Characters step out of a band (goal, counting) and stay below the words', () => {
 const out=layoutActors(A(['kid','dad','big','small']),art,{width:1366,height:768,avoid:[.35,.65],maxHeight:.34});
 for(const a of out){assert.ok(a.left+a.width<=.35+1e-9||a.left>=.65-1e-9,`${a.id} out of the band`);assert.ok(a.height<=.34+1e-9);}
 for(let i=1;i<out.length;i++)if(out[i].left>out[i-1].left)assert.ok(out[i].left>=out[i-1].left+out[i-1].width-1e-9,'no overlap');
 const dad=out.find(a=>a.id==='dad'),kid=out.find(a=>a.id==='kid');assert.ok(dad.height>kid.height,'Dad stays taller');
 const [a,b]=coverBand([.4,.3,.2,.1],{width:390,height:844});assert.ok(a<.5&&b>.5&&b-a>.2,'a goal is wider on a tall phone (cover crop)');
});

// One picture, one scale: people and props share one ground line and one unit; nobody overlaps; turned either way the
// same sizes (the smaller side sets them); a too-wide row drops props before anyone shrinks.
import {composeScene,PEOPLE} from '../public/book-scene.mjs';
const fam={props:{ball:{h:.1,ar:1},pizza:{h:.12,ar:1.6}},actors:{dad:{h:.64,poses:{idle:{ar:.4}}},mom:{h:.6,poses:{idle:{ar:.42}}},diogo:{h:.45,poses:{idle:{ar:.5}}},monkey:{h:.5,poses:{idle:{ar:.7}}}}};
const famScene={actors:A(['diogo','mom','dad','monkey']),props:[{id:'pizza'},{id:'ball'}]};
for(const [W,H] of [[412,915],[915,412],[1366,768]])test(`Composition at ${W}x${H}: one ground, no overlaps, Dad > Mom > Diogo > toy`,()=>{
 const L=composeScene(famScene,fam,{width:W,height:H,ground:0.93,maxHeight:0.88});
 const all=[...L.actors,...L.props].sort((a,b)=>a.left-b.left);
 for(let i=1;i<all.length;i++)assert.ok(all[i].left>=all[i-1].left+all[i-1].width,`${all[i-1].id} overlaps ${all[i].id}`);
 for(const r of all){assert.ok(Math.abs(r.bottom-0.07)<1e-9,'feet on the ground');assert.ok(r.left>=0&&r.left+r.width<=1,'on screen');}
 const h=id=>L.actors.find(a=>a.id===id).height;
 assert.ok(h('dad')>h('mom')&&h('mom')>h('diogo')&&h('diogo')>h('monkey'));
 for(const p of L.props)assert.ok(p.height<h('diogo')*0.5,`${p.id} smaller than half a boy`);
 assert.ok(L.sky>=0&&L.sky<1-0.07-h('dad')+1e-9);
});
test('Composition: portrait and landscape use the same unit (the smaller side)',()=>{
 const a=composeScene(famScene,fam,{width:412,height:915,ground:0.93,maxHeight:0.88}),b=composeScene(famScene,fam,{width:915,height:412,ground:0.93,maxHeight:0.88});
 assert.ok(Math.abs(a.unit-b.unit)<1);assert.equal(PEOPLE.dad,1);
});
test('Composition: a crowded row drops props before shrinking people',()=>{
 const L=composeScene({actors:A(['dad','mom','diogo','monkey','dad']),props:[{id:'pizza'},{id:'ball'}]},fam,{width:412,height:915});
 assert.equal(L.props.length,0);
});
