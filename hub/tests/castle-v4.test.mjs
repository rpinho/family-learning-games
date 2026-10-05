import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CASTLE,castleDefinition,castleFactKnown,castleMathIssues,worldDefinition} from '../public/world-definitions.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {worldLines,worldService} from '../world-service.mjs';
import {phonicsLine} from '../phonics.mjs';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
const model=createWorldModel(CASTLE);
const move=(s,room)=>{const route=model.routeTo(s.room,room,s);assert.ok(route.length,`No route from ${s.room} to ${room}`);for(const to of route.slice(1))s=model.worldAction(s,{action:model.ROOMS[s.room].door?.to===to?'enter':'walk',room:to,x:.4,y:.97}).state;return s;};
const solve=(s,id)=>model.worldAction(move(s,model.GATES[id].room),{action:'solve',gate:id,answer:model.GATES[id].answer}).state;
const readyGoals=s=>Object.entries(model.GATES).filter(([id,g])=>!s.solved.includes(id)&&!model.targetStatus(s,'gate',id).missing.length&&model.routeTo(s.room,g.room,s).length).map(([id])=>id);
const fixture=async()=>({schema:2,room:'castle-gate',position:{x:.4,y:.97},items:Object.keys(CASTLE.ITEMS).filter(id=>!CASTLE.ITEMS[id].collection),solved:Object.keys(CASTLE.GATES).filter(id=>!CASTLE.GATES[id].optional),flags:['acorns-traded','ball-returned','bridge-tied','bridge','night','runaway','dig'],collected:['acorn-1','acorn-2','acorn-3','ball'],questStarted:true,doorOpen:true,treasureOpen:true,visited:['castle-gate'],tutorial:{walk:true,talk:true},revision:3});

test('castle is larger, has six enterable interiors and uses existing reviewed paintings and measured doorways',async()=>{
 assert.equal(Object.keys(CASTLE.ROOMS).length,18);
 const interiors=Object.values(CASTLE.ROOMS).filter(r=>r.door?.return);assert.equal(interiors.length,6);
 const library=JSON.parse(await readFile(new URL('../book-art-layouts.json',import.meta.url),'utf8'));
 for(const id of ['garden-court','reading-nook','lookout-ridge']){
  const r=CASTLE.ROOMS[id];assert.ok(library[r.bg||id]);assert.ok(CASTLE.mapSpots[id]);
 }
 assert.deepEqual(CASTLE.ROOMS['garden-court'].door.wide,CASTLE.ROOMS['treehouse-town'].door.wide);
 for(const [id,r] of Object.entries(CASTLE.ROOMS))if(r.door)assert.equal(CASTLE.ROOMS[r.door.to].door.to,id);
});

test('at least three goals can be chosen together; different independent orders earn the same map',()=>{
 const started=model.worldAction(model.freshWorld(),{action:'quest'}).state;
 assert.ok(readyGoals(started).length>=3);
 assert.ok(['chess','reading','score','workshop','bakery'].every(id=>readyGoals(started).includes(id)));
 const a=['chess','reading','score'].reduce(solve,started),b=['score','chess','reading'].reduce(solve,started);
 assert.ok(a.doorOpen&&b.doorOpen);assert.deepEqual([...a.items].sort(),[...b.items].sort());assert.deepEqual([...a.solved].sort(),[...b.solved].sort());assert.equal(started.solved.length,0);
});

test('earned shortcuts and the post-ending garden loops offer several routes; the ending remains binding',async()=>{
 const original=await fixture(),s=model.upgradeWorld(original);
 assert.throws(()=>model.worldAction({...s,room:'treehouse-town',treasureOpen:false},{action:'walk',room:'garden-court',x:.4,y:.97}),/Find the island treasure/);
 let loop=move(s,'treehouse-town');for(const room of ['garden-court','lookout-ridge','lighthouse','castle-night','treehouse-town'])loop=move(loop,room);
 assert.equal(loop.room,'treehouse-town');assert.deepEqual(loop.items,original.items);
 for(const room of ['garden-court','waterfall','treehouse-town'])loop=move(loop,room);
 assert.equal(loop.room,'treehouse-town');
 for(const [room,side,req] of [['castle-gate','bottom','bridge'],['castle-forest','top','score']]){
  const unearned={...model.freshWorld(),room,questStarted:true};assert.ok(!model.availableExits(unearned)[side]);assert.equal(model.availableExits({...unearned,solved:[req]})[side],model.ROOMS[room].exits[side]);
 }
});

test('a synthetic completed main quest gains demo discoveries and preserves earned tools',async()=>{
 const original=await fixture(),before=JSON.stringify(original);let s=model.upgradeWorld(original);
 assert.equal(readyGoals(s).length,Object.values(CASTLE.GATES).filter(g=>g.optional).length);
 for(const [id,g]of Object.entries(CASTLE.GATES))if(g.optional)s=solve(s,id);
 for(const item of original.items)assert.ok(s.items.includes(item));
 assert.ok(s.doorOpen&&s.treasureOpen);assert.equal(s.items.filter(id=>CASTLE.ITEMS[id]?.collection).length,10);
 assert.equal(model.nextHint(s),'next-done');assert.equal(JSON.stringify(original),before);
 const duplicate=solve(s,'name-ada');assert.deepEqual(duplicate.items,s.items);
});

test('ADA and ALEX are supported spelling targets with whole-word and every letter-sound line',()=>{
 const lines=worldLines({},CASTLE);
 for(const [id,name] of [['name-ada','ada'],['name-alex','alex']]){
  const g=CASTLE.GATES[id];assert.deepEqual(g.words,[name]);assert.deepEqual(g.displayWords,[name.toUpperCase()]);assert.ok(g.uppercase&&g.soundSupport&&g.hearAndBuild);
  assert.ok(lines['word-'+id+'-'+name]);for(const c of name)if(phonicsLine(c,'letter'))assert.deepEqual(lines['sound-'+id+'-'+c],phonicsLine(c,'letter'));
 }
 for(const g of Object.values(CASTLE.GATES))for(const word of g.words||[])assert.ok(!['mom','grown-up'].includes(word.toLowerCase()));
 assert.deepEqual(CASTLE.GATES.cabin.words,['truck','jump']);assert.ok(CASTLE.GATES.cabin.soundSupport);assert.match(lines['next-done'].text,/All 10 discoveries/);assert.ok(lines['word-cabin-truck']&&lines['word-cabin-jump']);
});

test('learner reading fields select supported CVC practice without elevating truck or jump to independent reading',()=>{
 const learner={literacy:{wordLevel:2,sentenceLevel:1,wordsStuck:['bug','pin'],readingFocus:['short-u','final-consonant']},bookPlan:{wordPatterns:[{words:['top','hop']}]}};
 const before=JSON.stringify(learner),d=castleDefinition({age:8},learner);
 assert.deepEqual(d.GATES['word-trail'].words,['top','bug']);assert.equal(d.GATES['word-trail'].answer,'top bug');assert.deepEqual(d.learning.reading.focus,learner.literacy.readingFocus);assert.equal(d.learning.reading.source,'learner');
 assert.ok(d.GATES['word-trail'].soundSupport&&d.GATES['word-trail'].hearAndBuild);assert.deepEqual(d.GATES.cabin.words,['truck','jump']);assert.equal(JSON.stringify(learner),before);assert.deepEqual(CASTLE.GATES['word-trail'].words,['top','pin']);
 assert.equal(worldDefinition({age:8,learner}).GATES['word-trail'].answer,'top bug');
});

const firsts=(a,b)=>Array.from({length:3},(_,i)=>({a,b,at:i+1,firstTry:true,ok:true,help:false,ms:3500}));
test('single facts require per-fact, independent first-answer evidence; fast taps, help, misses and table levels cannot qualify',()=>{
 assert.equal(castleFactKnown({a:3,b:9},firsts(3,9)),true);
 for(const change of [{ms:250},{help:true},{hint:true},{ok:false},{firstTry:false},{help:undefined},{ms:undefined}])assert.equal(castleFactKnown({a:3,b:9},firsts(3,9).map(e=>({...e,...change}))),false);
 assert.equal(castleFactKnown({a:3,b:9},firsts(9,3)),false);
 assert.equal(castleFactKnown({a:3,b:9},firsts(3,9).map(e=>({...e,at:1}))),false);
 assert.equal(castleFactKnown({a:3,b:9},[...firsts(3,9),{...firsts(3,9)[0],at:4,ok:false}]),false);
 const quick={...CASTLE.GATES['nine-stars'],math:{...CASTLE.GATES['nine-stars'].math,mode:'quick'}};
 assert.match(castleMathIssues(quick).join('|'),/no independent first-try evidence/);assert.deepEqual(castleMathIssues(quick,{factEvidence:firsts(3,9)}),[]);
 const noEvidence=castleDefinition({mathFloor:{tables:[2,3,4,5,6,7,8,9]}},{math:{factsMastered:['3x9']}});assert.equal(noEvidence.GATES['nine-stars'].math.mode,'supported');
 const observed=castleDefinition({}, {math:{factEvidence:firsts(3,9)}});assert.equal(observed.GATES['nine-stars'].math.mode,'quick');assert.equal(observed.GATES.workshop.math.mode,'supported');
});

test('all authored math has a correct on-request method, including missed 3×9 and the big multi-step code',()=>{
 for(const g of Object.values(CASTLE.GATES))assert.deepEqual(castleMathIssues(g),[],g.title);
 const practice=CASTLE.GATES['nine-stars'];assert.deepEqual(practice.math.support.counts,[9,18,27]);assert.match(practice.hint,/9, 18, 27/);
 assert.match(castleMathIssues({...practice,math:{...practice.math,support:{...practice.math.support,counts:[9,18,28]}}}).join('|'),/correct array or skip-counting hint/);
 assert.equal(CASTLE.GATES['supply-code'].answer,String(99*99+40));assert.equal(CASTLE.GATES['supply-code'].math.support.kind,'decompose');
 const big=structuredClone(CASTLE.GATES['supply-code']);big.math.support.steps[0]='99 × 100 = 9901';assert.match(castleMathIssues(big).join('|'),/is incorrect/);
});

test('castle toy spots specify reusable unscored tetherball and soccer play in different rooms',()=>{
 assert.deepEqual(CASTLE.toys.map(t=>t.kind),['tetherball','soccer']);assert.equal(new Set(CASTLE.toys.map(t=>t.room)).size,2);
 for(const t of CASTLE.toys){assert.ok(CASTLE.ROOMS[t.room]);assert.ok(t.x>0&&t.x<1&&t.y>.35&&t.y<1);assert.ok(!t.requires&&!t.goal&&!t.score&&!t.reward);}
});

test('world service reads private learner fields beside the Book without changing them',async t=>{
 const root=await mkdtemp(join(tmpdir(),'castle-learner-')),bookDir=join(root,'book'),learnerDir=join(root,'learner');await mkdir(bookDir);await mkdir(learnerDir);
 const compiled=JSON.stringify({bookPlan:{wordPatterns:[{words:['net','pet']}]}}),raw=JSON.stringify({literacy:{wordsStuck:['bug'],wordLevel:2,sentenceLevel:1}});
 await writeFile(join(bookDir,'profiles.json'),JSON.stringify({hero:{age:8}}));await writeFile(join(learnerDir,'hero-learner.json'),compiled);await writeFile(join(learnerDir,'hero.json'),raw);
 const service=worldService({bookDir,config:{players:[{id:'hero',name:'Ada'}]},authorized:()=>true,book:{library:async()=>({backgrounds:Object.fromEntries(Object.entries(CASTLE.ROOMS).map(([id,r])=>[r.bg||id,{file:'bg/castle.svg'}])),actors:{hero:{name:'Ada',h:.5,poses:{idle:{file:'actors/hero.svg',ar:.4}}}}})}});
 const server=createServer((req,res)=>service.handle(req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/world?player=hero&preview=1`),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.definition.GATES['word-trail'].words,['net','bug']);
 assert.equal(await readFile(join(learnerDir,'hero-learner.json'),'utf8'),compiled);assert.equal(await readFile(join(learnerDir,'hero.json'),'utf8'),raw);
});
