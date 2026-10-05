import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {worldStore} from '../world-store.mjs';
import {ROOMS,GATES,freshWorld,worldAction,adjacent,walkPath,freeFoot,upgradeWorld,nextHint,nextGoal,goalTarget,routeTo,LOCKS} from '../public/world-model.mjs';
import {worldService,worldLines,worldCryClip,recordedWorldLines} from '../world-service.mjs';import {createServer} from 'node:http';import {clipName} from '../book-service.mjs';
test('room graph is connected, reciprocal and every gate is in a reachable room',()=>{
 const seen=new Set(),visit=id=>{if(seen.has(id))return;seen.add(id);for(const [side,next] of Object.entries(ROOMS[id].exits)){assert.ok(ROOMS[next]);assert.ok(adjacent(next,id));visit(next);}if(ROOMS[id].door){assert.ok(adjacent(ROOMS[id].door.to,id));visit(ROOMS[id].door.to);}};visit('castle-gate');assert.equal(seen.size,Object.keys(ROOMS).length);
 for(const [id,g] of Object.entries(GATES)){assert.equal((ROOMS[g.room].gates||[ROOMS[g.room].gate]).includes(id),true);assert.ok(g.options.includes(g.answer));}assert.equal(adjacent('castle-gate','pirate-ship'),false);
});
test('preview saves are separate, survive reload, preserve solved gates and opened doors',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-store-')),store=worldStore({bookDir,players:['young']});let s=await store.read('young',true);
 async function act(b){const r=await store.act('young',true,{...b,revision:s.revision});s=r.state;return r;}
 await act({action:'quest'});await act({action:'walk',room:'chess-courtyard',x:.4,y:.9});
 const before=s.revision;assert.equal((await act({action:'solve',gate:'chess',answer:'You by 9'})).correct,false);assert.equal(s.revision,before);
 await act({action:'solve',gate:'chess',answer:'You by 5'});await act({action:'solve',gate:'chess',answer:'You by 5'});assert.equal(s.items.filter(i=>i==='map-chess').length,1);
 for(const room of ['castle-gate','castle-forest'])await act({action:'walk',room,x:.4,y:.9});await act({action:'solve',gate:'reading',answer:'red-shell'});
 for(const room of ['castle-gate','chess-courtyard','soccer-pitch'])await act({action:'walk',room,x:.6,y:.91});await act({action:'solve',gate:'score',answer:'50'});await act({action:'pip'});
 assert.equal(s.doorOpen,true);assert.equal(s.solved.length,3);assert.deepEqual(await worldStore({bookDir,players:['young']}).read('young',true),s);const bytes=await readFile(join(bookDir,'world','young.preview.json'));assert.deepEqual(await store.read('young',false),s);
 assert.deepEqual(await readFile(join(bookDir,'world','young.json')),bytes);
});
test('store rejects stale writers, forged rewards, invalid players and disconnected travel',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-bounds-')),store=worldStore({bookDir,players:['young']});
 await assert.rejects(store.read('../young',true),/player/);await assert.rejects(store.act('young',true,{revision:0,action:'walk',room:'pirate-ship',x:.5,y:.9}),/connect/);
 await assert.rejects(store.act('young',true,{revision:0,action:'solve',gate:'score',answer:'50'}),/challenge/);
 const results=await Promise.allSettled([store.act('young',true,{revision:0,action:'quest'}),store.act('young',true,{revision:0,action:'quest'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.throws(()=>worldAction(freshWorld(),{action:'walk',room:'castle-gate',x:NaN,y:.8}),/ground/);
});
test('walking routes around a painted obstruction, including every segment and actor body',()=>{
 const size={w:.07,h:.12},blocks=[{x0:.43,x1:.58,y0:.52,y1:.76}],path=walkPath({x:.2,y:.75},{x:.8,y:.75},size,blocks);assert.ok(path.length>2);
 for(let i=1;i<path.length;i++)for(let k=0;k<=20;k++){const t=k/20,p={x:path[i-1].x*(1-t)+path[i].x*t,y:path[i-1].y*(1-t)+path[i].y*t};assert.ok(freeFoot(p,size,blocks));}
 assert.deepEqual(walkPath({x:.2,y:.75},{x:.8,y:.75},size,[{x0:0,x1:1,y0:0,y1:1}]),[]);
});
test('world API gates review and future previews, allows current play and bounds voice requests',async t=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-api-'));let rendered=0;const service=worldService({bookDir,config:{players:[{id:'young',name:'Ada'}]},authorized:req=>req.headers.cookie==='adult=ok',book:{library:async()=>({}),renderLine:async l=>{rendered++;assert.equal(l.text,'Pip!');return 'fixture.wav';}}});
 const server=createServer(async(req,res)=>{await service.handle(req,res,new URL(req.url,'http://localhost'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/world?player=young&review=1')).status,403);
 assert.equal((await fetch(base+'/api/world?player=young&preview=1&date=2099-01-01')).status,403);
 const played=await fetch(base+'/api/world?player=young',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:0,action:'quest'})});assert.equal(played.status,200);assert.equal((await played.json()).state.questStarted,true);
 assert.equal((await fetch(base+'/api/world?player=young&preview=1')).status,503, 'current preview needs artwork, never a gate');
 const voice=key=>fetch(base+'/api/world/voice?player=young&preview=1',{method:'POST',headers:{cookie:'adult=ok','Content-Type':'application/json'},body:JSON.stringify({key})});assert.equal((await voice('arbitrary')).status,404);assert.equal((await voice('pip')).status,503);assert.equal(rendered,0);await mkdir(join(bookDir,'voice'));const clip=clipName(worldLines().pip);await writeFile(join(bookDir,'voice',clip),'fixture');assert.equal((await voice('pip')).status,200);assert.equal(rendered,0);assert.equal(worldLines().pip.text,'Pip!');
});
test('world manifest includes newly released paintings missing from a household library',async t=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-art-'));const service=worldService({bookDir,config:{players:[{id:'hero',name:'Ada'}]},authorized:()=>true,book:{library:async()=>({backgrounds:Object.fromEntries(Object.keys(ROOMS).filter(id=>id!=='pirate-ship').map(id=>[ROOMS[id].bg||id,{file:'bg/castle.svg'}])),actors:{hero:{name:'Ada',h:.5,poses:{idle:{file:'actors/hero.svg',ar:.4}}}},props:{}})}});
 const server=createServer(async(req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/world?player=hero&preview=1'),j=await r.json();assert.equal(r.status,200);assert.equal(Object.keys(j.art.backgrounds).length,new Set(Object.entries(ROOMS).map(([id,r])=>r.bg||id)).size);assert.match(j.art.backgrounds[ROOMS['pirate-ship'].bg||'pirate-ship'].url,/demo-pirate-ship/);assert.ok(j.art.backgrounds[ROOMS['pirate-ship'].bg||'pirate-ship'].variants.portrait.url);assert.equal(j.art.actors.hero.name,'Ada');
});
test('cry-only narration copies the verified reaction without a narrator translation',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-cry-')),bytes=Buffer.from('RIFF....WAVEsynthetic-cry'),source=join(bookDir,'cry.wav'),profile=join(bookDir,'test-profile.json');await writeFile(source,bytes);
 await writeFile(profile,JSON.stringify({reactions:{curious:{file:source,sha256:createHash('sha256').update(bytes).digest('hex')}}}));await writeFile(join(bookDir,'voice-renderers.json'),JSON.stringify({voices:{'local:toy':{command:['python3','reaction-renderer.py',profile]}}}));
 const clip=await worldCryClip(bookDir,'local:toy');assert.match(clip,/^[a-f0-9]{16}\.wav$/);assert.deepEqual(await readFile(join(bookDir,'voice',clip)),bytes);assert.equal(await worldCryClip(bookDir,'local:toy'),clip);assert.equal(await worldCryClip(bookDir,'plain-voice'),null);
 await writeFile(source,Buffer.from('changed'));await assert.rejects(worldCryClip(bookDir,'local:toy'),/verification/);
});
test('all tool trades, locks and nine gates complete without a dead end; duplicate rewards are idempotent',()=>{
 let s=freshWorld();const act=b=>{const r=worldAction(s,b);s=r.state;return r;},walk=room=>act({action:'walk',room,x:.4,y:.97}),solve=gate=>act({action:'solve',gate,answer:GATES[gate].answer}),use=target=>act({action:'use',target,item:LOCKS[target].item});
 act({action:'quest'});walk('castle-forest');
 assert.throws(()=>use('bridge'),/tool/);for(let n=1;n<=3;n++){act({action:'collect',id:'acorn-'+n});act({action:'collect',id:'acorn-'+n});}solve('reading');act({action:'friend'});assert.equal(s.items.filter(i=>i==='rope').length,1);assert.equal(s.collected.length,3);
 act({action:'enter',room:'workshop'});solve('workshop');act({action:'enter',room:'castle-forest'});walk('castle-gate');walk('chess-courtyard');solve('chess');walk('soccer-pitch');act({action:'collect',id:'ball'});act({action:'friend'});solve('kick');solve('score');assert.ok(s.doorOpen);
 walk('treehouse-town');act({action:'secret',id:'pip-chest'});act({action:'enter',room:'bakery'});solve('bakery');act({action:'enter',room:'treehouse-town'});for(const room of ['soccer-pitch','chess-courtyard','castle-gate','castle-forest','river-bridge'])walk(room);
 walk('pirate-ship');walk('river-bridge');assert.throws(()=>solve('bridge'),/Not yet!/);use('bridge');solve('bridge');walk('pirate-ship');assert.throws(()=>solve('pirate'),/Not yet!/);walk('castle-moon-hill');walk('castle-night');assert.throws(()=>solve('night'),/Not yet!/);walk('castle-moon-hill');assert.throws(()=>use('runaway'),/Loona/);solve('moon');use('runaway');use('night');walk('castle-night');solve('night');walk('castle-moon-hill');walk('pirate-ship');use('dig');solve('pirate');
 assert.equal(s.solved.length,10);assert.ok(s.treasureOpen);assert.equal(nextHint(s),'next-library');const items=[...s.items];solve('pirate');assert.deepEqual(s.items,items);
});
test('v0 migration retains completed map and birthday door without writing the original file',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'world-v0-')),store=worldStore({bookDir,players:['young']});const original={...freshWorld(),schema:1,solved:['chess','reading','score'],items:['castle-key','spyglass','map-chess','map-reading','map-score'],questStarted:true,doorOpen:true,revision:58};delete original.flags;delete original.collected;delete original.treasureOpen;
 const {mkdir}=await import('node:fs/promises');await mkdir(join(bookDir,'world'));const file=join(bookDir,'world','young.preview.json'),bytes=JSON.stringify(original);await writeFile(file,bytes);const s=await store.read('young',true);assert.deepEqual(s,upgradeWorld(original));assert.equal(s.doorOpen,true);assert.equal(s.revision,58);assert.equal(await readFile(file,'utf8'),bytes);assert.equal(nextHint(s),'next-acorns');
});
test('server refuses tool forgery, reading distractors, skipping openings and completing locks in another room',()=>{
 const s={...freshWorld(),room:'castle-forest',questStarted:true};assert.throws(()=>worldAction(s,{action:'collect',id:'lantern'}),/not here/);assert.throws(()=>worldAction(s,{action:'walk',room:'workshop',x:.4,y:.9}),/connect/);assert.throws(()=>worldAction(s,{action:'enter',room:'bakery'}),/opening/);
 const wrong=worldAction(s,{action:'solve',gate:'reading',answer:'blue-shell'});assert.equal(wrong.correct,false);assert.equal(wrong.state.revision,s.revision);assert.deepEqual(wrong.state.items,s.items);
 assert.throws(()=>worldAction({...s,items:[...s.items,'rope']},{action:'use',target:'bridge',item:'rope'}),/tool/);
});
test('every prompt, hint, friend state, lock and next-step has a voiced line',()=>{
 const lines=worldLines();for(const id of Object.keys(GATES))for(const key of [id,'hint-'+id])assert.ok(lines[key]?.text);for(const id of Object.keys(ROOMS))for(const i of [0,1])assert.ok(lines['friend-'+id+'-'+i]?.text);for(const id of Object.keys(LOCKS))assert.ok(lines['lock-'+id]?.text);
 for(const k of Object.keys(lines))assert.ok(lines[k].voice&&lines[k].speed);assert.match(lines.night.text,/Read the sign/);
});

test('every sign destination navigates even before tools are earned; puzzle requirements remain binding',()=>{
 for(const [room,r] of Object.entries(ROOMS))for(const [side,next] of Object.entries(r.exits)){const req=r.exitRequires?.[side];if(req)continue;
  const s={...freshWorld(),room};const out=worldAction(s,{action:'walk',room:next,x:.4,y:.99}).state;assert.equal(out.room,next);assert.ok(out.visited.includes(next));
 }
 assert.throws(()=>worldAction({...freshWorld(),questStarted:true,room:'castle-night'},{action:'solve',gate:'night',answer:GATES.night.answer}),/Not yet!/);
 assert.throws(()=>worldAction({...freshWorld(),questStarted:true,room:'pirate-ship',solved:['chess','reading','score'],items:['shovel','island-map','star-compass']},{action:'use',target:'dig',item:'shovel'}),/bridge/i);
});
test('ribbon, Dad and map use one quest instrument; counts and actionable targets advance immediately',()=>{
 let s=freshWorld();assert.equal(nextGoal(s).key,nextHint(s));assert.equal(goalTarget(s),'friend');assert.deepEqual(routeTo('chess-courtyard','soccer-pitch'),['chess-courtyard','soccer-pitch']);
 s=worldAction(s,{action:'quest'}).state;assert.equal(goalTarget(s),'right');s=worldAction(s,{action:'walk',room:'castle-forest',x:.4,y:.99}).state;
 for(let n=1;n<=3;n++){assert.equal(goalTarget(s),'acorn-'+n);s=worldAction(s,{action:'collect',id:'acorn-'+n}).state;assert.match(nextGoal(s).text,new RegExp(n+' / 3|Give the 3|Read Picos'));}
 assert.equal(goalTarget(s),'gate-reading');s=worldAction(s,{action:'solve',gate:'reading',answer:GATES.reading.answer}).state;assert.equal(goalTarget(s),'friend');s=worldAction(s,{action:'friend'}).state;assert.equal(goalTarget(s),'opening');assert.equal(nextGoal(s).room,'workshop');
 for(const room of Object.keys(ROOMS)){const g=nextGoal({...s,room});assert.ok(g.text&&g.room&&g.target);assert.equal(g.key,nextHint(s));assert.ok(goalTarget({...s,room}));}
});
test('tutorial is persisted once, old saves do not get a fresh-save tutorial, migration is pure',()=>{
 let s=freshWorld();s=worldAction(s,{action:'walk',room:s.room,x:.4,y:.99,ground:true}).state;assert.equal(s.tutorial.walk,true);assert.equal(s.tutorial.talk,false);
 s=worldAction(s,{action:'quest'}).state;assert.deepEqual(s.tutorial,{walk:true,talk:true});const legacy={room:'chess-courtyard',questStarted:true,solved:['reading','workshop'],flags:['acorns-traded'],items:[],schema:2};const snapshot=structuredClone(legacy),out=upgradeWorld(legacy);assert.deepEqual(legacy,snapshot);assert.ok(out.visited.includes('workshop'));assert.deepEqual(out.tutorial,{walk:true,talk:true});assert.deepEqual(upgradeWorld({...legacy,questStarted:false,revision:4}).tutorial,{walk:true,talk:true});
});
test('every World line is backed by a recorded clip (or its verified Pip cry)',async()=>{
 const bookDir=process.env.WORLD_TEST_BOOK||await mkdtemp(join(tmpdir(),'world-recorded-'));
 if(!process.env.WORLD_TEST_BOOK){await mkdir(join(bookDir,'voice'));for(const l of Object.values(worldLines()))await writeFile(join(bookDir,'voice',clipName(l)),Buffer.from('RIFF....WAVE'+'.'.repeat(40)));}
 const lines=await recordedWorldLines(bookDir);assert.equal(Object.keys(lines).length,Object.keys(worldLines()).length);
 for(const [key,l] of Object.entries(lines)){assert.ok(l.clip,'Missing recording: '+key);const bytes=await readFile(join(bookDir,'voice',l.clip));assert.ok(bytes.length>44,'Empty clip '+key);assert.equal(bytes.toString('ascii',0,4),'RIFF',key);assert.equal(bytes.toString('ascii',8,12),'WAVE',key);}
});
