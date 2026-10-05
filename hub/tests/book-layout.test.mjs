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
const fam={props:{ball:{h:.1,ar:1},pizza:{h:.12,ar:1.6}},actors:{dad:{h:.64,poses:{idle:{ar:.4}}},mom:{h:.6,poses:{idle:{ar:.42}}},beginner:{h:.45,poses:{idle:{ar:.5}}},monkey:{h:.5,poses:{idle:{ar:.7}}}}};
const famScene={actors:A(['beginner','mom','dad','monkey']),props:[{id:'pizza'},{id:'ball'}]};
for(const [W,H] of [[412,915],[915,412],[1366,768]])test(`Composition at ${W}x${H}: one ground, no overlaps, Dad > Mom > Beginner > toy`,()=>{
 const L=composeScene(famScene,fam,{width:W,height:H,ground:0.93,maxHeight:0.88});
 const all=[...L.actors.filter(a=>!a.depth),...L.props].sort((a,b)=>a.left-b.left);
 for(let i=1;i<all.length;i++)assert.ok(all[i].left>=all[i-1].left+all[i-1].width,`${all[i-1].id} overlaps ${all[i].id}`);
 for(const r of all){assert.ok(Math.abs(r.bottom-0.07)<1e-9,'feet on the ground');assert.ok(r.left>=0&&r.left+r.width<=1,'on screen');}
 const h=id=>{const a=L.actors.find(a=>a.id===id);return a.height/(a.depth?0.92:1);};
 assert.ok(h('dad')>h('mom')&&h('mom')>h('beginner')&&h('beginner')>h('monkey'));
 for(const p of L.props)assert.ok(p.height<h('beginner')*0.5,`${p.id} smaller than half a boy`);
 assert.ok(L.sky>=0&&L.sky<1-0.07-L.actors.find(a=>a.id==='dad').height+1e-9);
});
test('Composition: Beginner is at least 18% of a tall screen and 28% of a wide one; Dad about 1.35x Beginner',()=>{
 const sc={actors:A(['beginner','dad','monkey'])};
 for(const [W,H,min] of [[412,915,0.18],[915,412,0.28],[1366,768,0.28]]){const L=composeScene(sc,fam,{width:W,height:H,ground:0.93,maxHeight:0.88}),h=id=>L.actors.find(a=>a.id===id).height;
  assert.ok(h('beginner')>=min,`${W}x${H}: Beginner ${h('beginner')}`);assert.ok(Math.abs(h('dad')/h('beginner')-1.35)<0.03);}
 assert.equal(PEOPLE.dad,1);
});
test('Composition: a row too wide for a phone puts the grown-ups a step back instead of shrinking everyone',()=>{
 const L=composeScene({actors:A(['beginner','mom','dad','monkey'])},fam,{width:360,height:780,ground:0.93,maxHeight:0.88});
 const d=L.actors.find(a=>a.id==='beginner');assert.ok(d.height>=0.18,'Beginner keeps his size');
 assert.deepEqual(L.actors.filter(a=>a.depth).map(a=>a.id).sort(),['dad','mom']);
});
test('Composition: a crowded row drops props before shrinking people',()=>{
 const L=composeScene({actors:A(['dad','mom','beginner','monkey','dad']),props:[{id:'pizza'},{id:'ball'}]},fam,{width:412,height:915});
 assert.equal(L.props.length,0);
});
test('A prop with a real size (a little kid dumbbell) stands at that size beside the people, never ball-sized',async()=>{
 const {propHeight,artFor}=await import('../public/book-scene.mjs');
 assert.equal(propHeight('dumbbell',{h:0.05,rel:0.085}),0.085);assert.equal(propHeight('ball',{h:0.1,rel:0.5}),0.12,'a known prop keeps its size');
 assert.equal(propHeight('x',{h:0.05}),0.1,'without a real size the old floor applies');
 const famD={...fam,props:{...(fam.props||{}),dumbbell:{h:0.05,rel:0.085,ar:2.06}}};
 for(const [W,H] of [[390,844],[1116,750],[1280,800]]){const L=composeScene({actors:A(['beginner','dad']),props:[{id:'dumbbell'}]},famD,{width:W,height:H,ground:0.93,maxHeight:0.88});
  const d=L.actors.find(a=>a.id==='beginner'),b=L.props.find(p=>p.id==='dumbbell');assert.ok(b,`${W}x${H}: the dumbbell is in the picture`);
  assert.ok(Math.abs(b.height/d.height-0.085/PEOPLE.beginner)<1e-6,`${W}x${H}: real size next to Beginner`);assert.equal(b.bottom,d.bottom,'on the same floor');
  assert.ok(b.left>=d.left+d.width-1e-9||b.left+b.width<=d.left+1e-9,'beside him, not over him');}
 const lib={backgrounds:{gym:{file:'bg/gym.webp'}},actors:{},props:{dumbbell:{file:'props/dumbbell.webp',h:0.05,rel:0.085,ar:2.06}}};
 const out=artFor([{scene:{bg:'gym',actors:[],props:[]},beat:{kind:'count',thing:'dumbbell'}}],lib);
 assert.deepEqual(out.props.dumbbell,{url:'/book-art/props/dumbbell.webp',h:0.05,ar:2.06,rel:0.085});
});
// 2026-10-01: on a phone a short plush friend stepped back right behind the boy (his face hidden by the boy's head and
// shoulders) while Dad, whose face clears the boy's head, stood behind the short parrot. A back-row face must show.
test('Composition: every back-row face shows over the friends in front (a short friend never hides behind a taller one)',()=>{
 // (the library's proportions: a few thousandths decided who stood behind whom)
 const zoo={actors:{dad:{h:.64,poses:{idle:{ar:.524}}},beginner:{h:.42,poses:{idle:{ar:.453}}},parrot:{h:.3,poses:{idle:{ar:.608}}},plush:{h:.34,poses:{idle:{ar:.82}}},keeper:{h:.46,poses:{idle:{ar:.667}}}}};
 const cases=[[390,844,{avoid:[0.29,0.71],aside:'keeper',playBall:true,maxHeight:0.78}],[390,844,{maxHeight:0.88}],[360,780,{maxHeight:0.88}],[412,915,{avoid:[0.3,0.7],maxHeight:0.78}]];
 for(const [W,H,o] of cases){const L=composeScene({actors:A(['beginner','dad','parrot','plush','keeper'])},zoo,{width:W,height:H,ground:0.93,...o});
  const box=a=>({x:a.left*W,y:(1-a.bottom-a.height)*H,w:a.width*W,h:a.height*H}),area=(p,q)=>Math.max(0,Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x))*Math.max(0,Math.min(p.y+p.h,q.y+q.h)-Math.max(p.y,q.y));
  const back=L.actors.filter(a=>a.depth),fr=L.actors.filter(a=>!a.depth);assert.ok(back.length,`${W}x${H}: someone steps back`);
  for(const b of back){const B=box(b),face={x:B.x+B.w*0.25,y:B.y,w:B.w*0.5,h:B.h*0.35};
   for(const f of fr){const F=box(f),core={x:F.x+F.w*0.15,y:F.y,w:F.w*0.7,h:F.h};
    assert.ok(area(face,core)<0.1*face.w*face.h,`${W}x${H} ${JSON.stringify(o)}: ${f.id} covers ${b.id}'s face (${Math.round(area(face,core)/(face.w*face.h)*100)}%)`);}}
  for(let i=0;i<back.length;i++)for(let j=i+1;j<back.length;j++)assert.ok(area(box(back[i]),box(back[j]))<0.12*Math.min(box(back[i]).w*box(back[i]).h,box(back[j]).w*box(back[j]).h),'back-row friends do not overlap');}
});

test('Painted object keep-out survives crop, respects the row height, and is carried to the player',async()=>{
 const {paintedObjectBand,artFor}=await import('../public/book-scene.mjs');
 const rect=[.35,.21,.30,.28];
 const wide=paintedObjectBand([rect],{width:1116,height:750,top:.4,ground:.93});assert.ok(wide[0]<.35&&wide[1]>.65);
 assert.equal(paintedObjectBand([rect],{width:390,height:844,top:.6,ground:.93}),null,'car sits above the phone characters');
 assert.equal(paintedObjectBand([[-1,.2,.1,.2]],{width:390,height:844,top:0,ground:1}),null,'cropped-away objects do not constrain the row');
 assert.equal(paintedObjectBand([[0,0,0,1],[0,NaN,1,1]],{width:390,height:844,top:0,ground:1}),null);
 const lib={backgrounds:{scene:{file:'bg/scene.webp',keepOut:[rect]}},actors:{},props:{}};
 assert.deepEqual(artFor([{scene:{bg:'scene',actors:[],props:[]}}],lib).backgrounds.scene.keepOut,[rect]);
});

test('A clear foreground row fits five figures without body overlap or hiding the painted car',async()=>{
 const {composeScene}=await import('../public/book-scene.mjs');
 const actors={dad:{h:.64,poses:{idle:{ar:.55}}},mom:{h:.6,poses:{idle:{ar:.55}}},hero:{h:.42,poses:{idle:{ar:.6}}},pup:{h:.35,poses:{idle:{ar:1}}},owl:{h:.26,poses:{idle:{ar:.7}}}};
 for(const [width,height] of [[390,844],[1116,750]]){
  const s={actors:Object.keys(actors).map(id=>({id,pose:'idle'})),props:[]};const L=composeScene(s,{actors,props:{}},{width,height,ground:.93,maxHeight:.4,oneRow:true});
  assert.equal(L.actors.length,5);assert.deepEqual(L.back,[]);
  const a=[...L.actors].sort((a,b)=>a.left-b.left);for(let i=1;i<a.length;i++)assert.ok(a[i-1].left+a[i-1].width<=a[i].left+1e-6);
  for(const a of L.actors){assert.ok(a.left>=.02&&a.left+a.width<=.98);assert.ok(1-a.bottom-a.height>=.53-1e-6);}
 }
});
