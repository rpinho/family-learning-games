import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SMALL,smallWorldForLearner} from '../public/world-definitions.mjs';
import {sceneTargets,projectSceneTargets,scenePuzzleSession,scenePuzzleIssues} from '../public/world-scene-puzzles.mjs';
import {createWorldModel} from '../public/world-model.mjs';
import {checkWorld,exploreWorld} from '../world-check.mjs';
import {smallLearnerProfile} from '../world-small-learner.mjs';
import {worldLines} from '../world-service.mjs';
const layouts=JSON.parse(await readFile(new URL('../book-art-layouts.json',import.meta.url)));
const background=g=>layouts[SMALL.ROOMS[g.room].bg];
const targets=g=>sceneTargets(g,background(g),{width:1366,height:768});

test('every authored numerical scene puzzle agrees with both actual paintings',()=>{
 for(const [id,g]of Object.entries(SMALL.GATES))if(['count','order','subtract','compare','add','missing','difference'].includes(g.scenePuzzle.mode))assert.deepEqual(scenePuzzleIssues(g,background(g)),[],id);
 assert.deepEqual(targets(SMALL.GATES.stones),background(SMALL.GATES.stones).targets.stones);
 assert.deepEqual(targets(SMALL.GATES.flowers),background(SMALL.GATES.flowers).targets['yellow-flowers']);
});
test('numerical choices stay locked until every required painted object has been tapped',()=>{
 for(const g of Object.values(SMALL.GATES).filter(g=>['count','order','subtract','compare','add','missing','difference'].includes(g.scenePuzzle.mode))){
  const ts=targets(g),s=scenePuzzleSession(g,ts);assert.equal(s.answer(g.answer),false);
  const removed=g.scenePuzzle.takeAway||0;
  for(const t of ts.slice(0,removed)){assert.equal(s.tap(t.id).removed,true);assert.equal(s.answer(g.answer),false);}
  for(const [i,t]of ts.slice(removed).entries()){
   assert.equal(s.tap(t.id).accepted,true);
   assert.equal(s.answer(g.answer),i===ts.length-removed-1);
  }
  assert.equal(s.answer('wrong'),false);assert.equal(s.tap(ts.at(-1).id).accepted,false);
 }
});
test('actual mat course rejects out-of-order taps and keeps a full return path',()=>{
 const g=SMALL.GATES.mats,s=scenePuzzleSession(g,targets(g));assert.equal(s.tap('3').accepted,false);
 for(const id of ['1','2','3','4'])assert.equal(s.tap(id).accepted,true);
 assert.equal(s.ready,true);assert.equal(s.answer('13'),true);
});
test('take away removes four real stones, leaves eight, and never counts a removed stone',()=>{
 const g=SMALL.GATES['stone-subtract'],s=scenePuzzleSession(g,targets(g));
 for(const id of ['3','5','8','11'])s.tap(id);
 assert.equal(s.phase,'count');assert.equal(s.tap('5').accepted,false);
 for(const id of ['1','2','4','6','7','9','10','12'])s.tap(id);
 assert.equal(s.seen.length,8);assert.equal(s.answer('8'),true);
});
test('count-on uses twelve real stones to practise spoken numbers nine through twenty',()=>{
 const g=SMALL.GATES['count-twenty'],s=scenePuzzleSession(g,targets(g));
 const counts=targets(g).map(t=>s.tap(t.id).count);assert.deepEqual(counts,Array.from({length:12},(_,i)=>i+9));
});
test('painted rings retain measured positions across phone, tablet and laptop crops',()=>{
 for(const [width,height]of [[390,844],[844,390],[1024,768],[1366,768]])for(const g of Object.values(SMALL.GATES)){
  const projected=projectSceneTargets(g,background(g),{width,height});
  for(const t of projected){assert.ok(t.tap.w>=64&&t.tap.h>=64);assert.ok(t.tap.x>=0&&t.tap.y>=0&&t.tap.x+t.tap.w<=width&&t.tap.y+t.tap.h<=height);assert.ok(t.paint.w>0&&t.paint.h>0);}
 }
});
test('certification rejects mismatched answers, missing paintings and groups that overlap',()=>{
 for(const mutate of [g=>g.answer='99',g=>g.scenePuzzle.painted='missing',g=>g.equation='12 = ?',g=>g.title='All seven stones']){const g=structuredClone(SMALL.GATES.stones);mutate(g);assert.ok(scenePuzzleIssues(g,background(g)).length);}
 const g=structuredClone(SMALL.GATES.gift);g.scenePuzzle.groups[1].push('1');assert.ok(scenePuzzleIssues(g,background(g)).length);
});
test('nine places include enterable interiors, two loops, and at least three concurrent reachable goals',()=>{
 const m=createWorldModel(SMALL),s={...m.freshWorld(),questStarted:true};
 assert.ok(Object.keys(m.ROOMS).length>=9);assert.equal(Object.values(m.ROOMS).filter(r=>r.door?.return).length,3);
 const open=Object.entries(m.GATES).filter(([id,g])=>!m.targetStatus(s,'gate',id).missing.length&&m.routeTo(s.room,g.room,s).length);
 assert.ok(open.length>=3);assert.equal(open.length,11);
 const outside=Object.values(m.ROOMS).filter(r=>!r.door?.return),edges=outside.reduce((n,r)=>n+Object.keys(r.exits).length,0)/2;
 assert.ok(edges-outside.length+1>=2,'at least two independent loops');
 assert.equal(SMALL.toys.length,2);for(const t of SMALL.toys)assert.ok(m.ROOMS[t.room]);
 const r=checkWorld({model:m,taughtLetters:['O'],lines:worldLines({},SMALL)});assert.deepEqual(r.issues,[]);assert.ok(r.states>100);
});
test('each reachable unfinished state has an actionable goal, and a copied old ending has five new discoveries',()=>{
 const m=createWorldModel(SMALL),r=exploreWorld({model:m});
 for(const s of r.states.values()){const g=m.nextGoal(s);assert.ok(m.ROOMS[g.room]);assert.ok(m.routeTo(s.room,g.room,s).length);}
 const old={...m.freshWorld(),room:'tetherball-yard',solved:['stones','flowers','sound','pizzas','mats','gift'],items:['stone','flower','thought','pizza','ribbon','gift'],flags:['gift-door'],doorOpen:true,treasureOpen:true,questStarted:true};
 const copied=m.upgradeWorld(structuredClone(old));assert.deepEqual(old.solved,copied.solved);assert.equal(m.nextGoal(copied).key,'next-stone-subtract');
 for(const [id,g]of Object.entries(m.GATES).filter(([,g])=>g.optional)){copied.room=g.room;Object.assign(copied,m.worldAction(copied,{action:'solve',gate:id,answer:g.answer}).state);assert.ok(copied.treasureOpen&&copied.doorOpen);}
 assert.equal(copied.items.filter(id=>m.ITEMS[id]?.collection).length,6);
});
test('private learner focus and actual Pattern Parade level drive sounds and pattern complexity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'world-scene-learner-')),learnerDir=join(root,'learner'),numberParkDir=join(root,'numbers');await mkdir(learnerDir);await mkdir(numberParkDir);
 const files={
  [join(learnerDir,'young-learner.json')]:{bookPlan:{letterFocus:{letter:'T'}}},
  [join(learnerDir,'young.json')]:{literacy:{letters:['O','A','T']},math:{countTo:13}},
  [join(numberParkDir,'young.json')]:{history:Array.from({length:5},()=>({question:{patternVersion:3},ok:true,helped:false}))}
 };
 for(const [path,data]of Object.entries(files))await writeFile(path,JSON.stringify(data));
 const before=await Promise.all(Object.keys(files).map(path=>readFile(path)));
 const p=await smallLearnerProfile(join(root,'book'),'young',{age:5},{learnerDir,numberParkDir}),d=smallWorldForLearner(p);
 assert.equal(d.GATES.sound.answer,'T');assert.match(d.GATES.sound.prompt,/\[\[t\]\]/);assert.equal(d.GATES['pattern-studio'].scenePuzzle.level,3);assert.equal(d.GATES['pattern-studio'].answer,'flower');
 assert.ok(worldLines({},d)['sound-sound-T']);assert.deepEqual(checkWorld({model:createWorldModel(d),taughtLetters:d.learning.taughtLetters,lines:worldLines({},d)}).issues,[]);
 assert.deepEqual(await Promise.all(Object.keys(files).map(path=>readFile(path))),before);
});

test('world-check rejects replacing arithmetic with pure counting below the demonstrated level',()=>{
 const d=structuredClone(SMALL),g=d.GATES.stones;g.kind='count';g.answer='12';g.options=['10','12','14'];g.pictures={'10':'10','12':'12','14':'14'};g.scenePuzzle={mode:'count',painted:'stones'};
 assert.match(checkWorld({model:createWorldModel(d),taughtLetters:['O']}).issues.join('|'),/pure counting.*demonstrated arithmetic level/);
});

test('arithmetic and difference guards catch incorrect missing parts and group direction',()=>{
 for(const [id,change]of [['mats',g=>g.answer='12'],['pizzas',g=>g.scenePuzzle.total=10],['mat-compare',g=>g.answer='3'],['flower-fewer',g=>g.answer='right']]){
  const g=structuredClone(SMALL.GATES[id]);change(g);assert.ok(scenePuzzleIssues(g,background(g)).length,id);
 }
});
