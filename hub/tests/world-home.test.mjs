import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {homePins,homePages} from '../public/home-pages.mjs';
import {smartHomeGames} from '../public/home-shortcuts.mjs';
import {CATALOG} from '../public/catalog.mjs';
import {worldStore} from '../world-store.mjs';
import {worldService} from '../world-service.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {CASTLE,SMALL} from '../public/world-definitions.mjs';

// Identities and progress are synthetic; household replay receipts stay outside the repository.
test('both world cards are permanent page-one pins outside every smart order',()=>{
 for(const player of [{id:'young',name:'Ada',world:'small'},{id:'older',name:'Max',world:'castle'}]){
  const pins=homePins(player);
  assert.deepEqual(pins.map(c=>c.id),['my-world','my-book']);
  assert.equal(pins[0].name,player.world==='small'?"Ada's World":'Castle Kingdom');
  assert.equal(pins[0].href,'/world?player='+player.id);
  assert.ok(pins[0].painted);assert.match(pins[0].icon,/\.webp$/);
  for(const order of [[],CATALOG.map(c=>c.id),CATALOG.map(c=>c.id).reverse(),['my-world','my-book','chess']]){
   const ordered=smartHomeGames(CATALOG,[],order),pages=homePages(ordered,{lead:pins.length,nudge:'chess'});
   assert.deepEqual([...pins,...pages.first].slice(0,2),pins);
   assert.ok(!ordered.some(c=>pins.some(p=>c.id===p.id)));
   assert.ok(!pages.second.some(c=>pins.some(p=>c.id===p.id)));
   assert.equal(pages.first.length+pages.second.length,CATALOG.length);
  }
 }
 assert.deepEqual(homePins({id:'admin'}),[]);
});

test('migration is verbatim for both definitions; reload, concurrent reads and child actions retain progress',async()=>{
 for(const definition of [SMALL,CASTLE]){
  const bookDir=await mkdtemp(join(tmpdir(),'home-world-')),model=createWorldModel(definition),store=worldStore({bookDir,players:['hero'],definitions:{hero:definition}});
  await mkdir(join(bookDir,'world'));
  const original={...model.freshWorld(),schema:2,room:definition.early?'tetherball-yard':'treehouse-town',questStarted:true,revision:84,position:{x:.43,y:.96},solved:[definition.early?'stones':'chess'],items:[definition.early?'ribbon':'map-chess']};
  const bytes=Buffer.from(JSON.stringify(original,null,2)+'\n\n'),legacy=join(bookDir,'world','hero.preview.json'),canonical=join(bookDir,'world','hero.json');
  await writeFile(legacy,bytes);
  const states=await Promise.all(Array.from({length:8},()=>store.read('hero',false)));
  assert.deepEqual(await readFile(canonical),bytes);assert.deepEqual(await readFile(legacy),bytes);
  assert.deepEqual(states[0],model.upgradeWorld(original));
  for(const s of states)assert.deepEqual(s,states[0]);
  const moved=await store.act('hero',false,{action:'walk',room:original.room,x:.55,y:.96,revision:84});
  assert.equal(moved.state.revision,85);assert.deepEqual(moved.state.items,original.items);assert.deepEqual(moved.state.solved,original.solved);
  assert.deepEqual(await worldStore({bookDir,players:['hero'],definitions:{hero:definition}}).read('hero',false),moved.state);
  assert.deepEqual(await readFile(legacy),bytes);
  // A stale preview must never replace the child's newer canonical progress.
  await writeFile(legacy,JSON.stringify(model.freshWorld()));assert.equal((await store.read('hero',false)).revision,85);
 }
});

test('current episodes open and act without a gate; review/future writes are gated and a missing daily episode resumes the persistent world',async t=>{
 const bookDir=await mkdtemp(join(tmpdir(),'home-world-api-'));
 const fixture=JSON.parse(await readFile(new URL('../../book/episodes/fixtures/little-world-episode.json',import.meta.url)));
 const ep={...fixture,player:'hero',id:'hero-2026-10-05'};
 await mkdir(join(bookDir,'hero','review'),{recursive:true});
 await writeFile(join(bookDir,'hero','2026-10-05.json'),JSON.stringify({player:'hero',date:ep.date,episode:ep}));
 await writeFile(join(bookDir,'hero','review','2026-10-05.json'),JSON.stringify({episode:ep}));
 await mkdir(join(bookDir,'world'));
 const original={...createWorldModel(CASTLE).freshWorld(),room:'treehouse-town',questStarted:true,revision:58,items:['map-chess'],solved:['chess']};
 const bytes=Buffer.from(JSON.stringify(original,null,2)+'\n'),legacy=join(bookDir,'world','hero.preview.json');await writeFile(legacy,bytes);
 let today=ep.date;
 const service=worldService({bookDir,config:{players:[{id:'hero',name:'Max'}]},authorized:req=>req.headers.cookie==='adult=ok',book:{today:()=>today,library:async()=>({backgrounds:Object.fromEntries([...Object.entries(CASTLE.ROOMS).map(([id,r])=>r.bg||id),...ep.rooms.map(r=>r.bg)].map(id=>[id,{file:'bg/castle.svg'}])),actors:{hero:{name:'Max',h:.5,poses:{idle:{file:'hero.svg',ar:.4}}}}})}});
 const server=createServer(async(req,res)=>{await service.handle(req,res,new URL(req.url,'http://localhost'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const get=async q=>{const r=await fetch(base+'/api/world?player=hero'+q);assert.equal(r.status,200);return r.json();};
 assert.equal(await service.available('hero'),true);
 let child=await get('');assert.equal(child.definition.episode.id,ep.id);assert.equal(child.state.room,ep.id+'--'+ep.start);assert.ok(child.state.items.includes('map-chess'));
 const post=async(q,body,cookie='')=>fetch(base+'/api/world?player=hero'+q,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
 const action={action:'walk',room:child.state.room,x:.45,y:.96,revision:58};
 assert.equal((await post('&review=1',action)).status,403);assert.equal((await post('&preview=1&date=2099-01-01',action)).status,403);
 const acted=await post('',action);assert.equal(acted.status,200);assert.equal((await acted.json()).state.revision,59);
 assert.equal((await get('')).state.revision,59);assert.equal((await get('&preview=1')).state.revision,59);
 assert.equal((await fetch(base+'/api/world?player=hero&review=1',{headers:{cookie:'adult=ok'}})).status,200);
 assert.equal((await fetch(base+'/api/world?player=hero&preview=1&date=2099-01-01',{headers:{cookie:'adult=ok'}})).status,200);
 assert.deepEqual(await readFile(legacy),bytes);assert.deepEqual(await readFile(join(bookDir,'world','hero.json')),bytes);
 today='2026-10-06';assert.equal(await service.available('hero'),false);
 child=await get('');assert.equal(child.definition.episode,undefined);assert.equal(child.state.room,original.room);assert.equal(child.state.revision,original.revision);assert.deepEqual(child.state.solved,original.solved);
 assert.equal((await post('',{...action,room:original.room})).status,200);
 assert.deepEqual(await readFile(legacy),bytes);
});
