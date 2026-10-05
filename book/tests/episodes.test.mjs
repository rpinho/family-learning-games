import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {checkEpisode,episodeDefinition} from '../episodes/format.mjs';
import {writeEpisode,episodeLearning,fallbackEpisode} from '../episodes/generate.mjs';
import {episodeDigest,verifyQuestPublication} from '../episodes/certify.mjs';
import {createWorldModel} from '../../hub/public/world-model.mjs';
import {CASTLE,SMALL} from '../../hub/public/world-definitions.mjs';
import {worldStore} from '../../hub/world-store.mjs';import {worldEpisodes} from '../../hub/world-episodes.mjs';
import {publishOne} from '../publish.mjs';import {atomicJSON,slot} from '../review.mjs';
import {generateOne,readLibrary} from '../generate.mjs';import {bookPaths,readProfiles} from '../paths.mjs';
import {deployment,NOW} from './fixtures.mjs';import {certifyTestChapter} from './episode-test-helpers.mjs';
const samples={};for(const level of ['reader','early'])samples[level]=JSON.parse(await readFile(new URL('../episodes/fixtures/'+level+'.json',import.meta.url),'utf8'));
const check=e=>checkEpisode(e,{...e.learning});
for(const level of ['reader','early'])test(`${level} sample: every state and optional subset is finishable`,()=>{const c=check(samples[level]);assert.deepEqual(c.issues,[]);assert.ok(c.states>20&&c.refusals>0);});
test('rejects wrong math, remainder division, lowered tables, non-CVC reading and missing sounds',()=>{
 const mutate=fn=>{const e=structuredClone(samples.reader);fn(e);assert.ok(check(e).issues.length);};
 mutate(e=>e.puzzles[0].answer='73');mutate(e=>e.puzzles[0].math.a=2);mutate(e=>e.puzzles.find(g=>g.math?.type==='divide').math.a=73);mutate(e=>e.puzzles.find(g=>g.kind==='tiles').soundSupport=false);mutate(e=>e.puzzles.find(g=>g.kind==='tiles').words=['lantern']);mutate(e=>e.puzzles.find(g=>g.math?.type==='multiply').math.a=102);mutate(e=>e.puzzles.find(g=>g.math?.type==='place').math.number=83);
});
test('rejects untaught sounds, wrong counts and Grown-up cast violations',()=>{for(const fn of [e=>e.learning.taughtLetters=[],e=>e.puzzles[0].count=21,e=>e.reveal='Mom has a gift.']){const e=structuredClone(samples.early);fn(e);assert.ok(check(e).issues.length);}});
test('finds dependency cycles, unattainable tools, disconnected regions and no return interior',()=>{for(const fn of [e=>e.puzzles[0].requires=['trail-lock'],e=>e.puzzles[0].rewards=[],e=>{e.rooms[0].exits={};e.rooms[1].exits.left=undefined;},e=>delete e.rooms[2].door]){const e=structuredClone(samples.reader);fn(e);const result=check(e);assert.ok(result.issues.length,result);}});
test('repair loop passes nightly context and rejections; four failures become a playable deterministic quest',async()=>{
 const {env}=await deployment(),paths=bookPaths(env),library=readLibrary(paths),plan={player:'older',name:'Knight',level:'reader',date:'2026-03-10',learnerFocus:[],daynotes:{thread:{id:'allegory'}},memory:{lastHook:{text:'A light in the grove'}},scenario:{id:'castle'},cast:[]};
 const valid=fallbackEpisode(plan,library),raw=structuredClone(valid),prompts=[];raw.puzzles[0].answer='1';let i=0;const r=await writeEpisode(plan,{library,ask:async p=>{prompts.push(p);return {source:'test-model',text:JSON.stringify(i++?valid:raw)};}});assert.equal(r.source,'test-model');assert.equal(prompts.length,2);assert.match(prompts[1],/incorrect answer/);assert.match(prompts[0],/allegory/);assert.match(prompts[0],/A light in the grove/);
 const f=await writeEpisode(plan,{library,ask:async()=>({source:'bad',text:'broken JSON'})});assert.equal(f.source,'deterministic quest fallback');assert.deepEqual(f.checks.issues,[]);
});
test('learner sound inventory and focus come from learner data',()=>{const l=episodeLearning({level:'early',letter:'M',learnerFocus:[{kind:'count',value:12}]},{literacy:{letters:['O'],learning:['F']}});assert.deepEqual(l.taughtLetters,['O','F','M']);assert.equal(l.focus[0].value,12);});
test('world upgrades retain inventory, prior rooms and progress; review preview never edits the child save',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'episode-persist-')),e=samples.reader,definitions={explorer:episodeDefinition(e,CASTLE)},store=worldStore({bookDir,players:['explorer'],definitions});await mkdir(join(bookDir,'world'));const original={schema:2,room:'castle-gate',items:['castle-key','spyglass'],solved:['chess'],flags:[],collected:[],visited:['castle-gate'],tutorial:{walk:true,talk:true},revision:7};const f=join(bookDir,'world','explorer.json');await writeFile(f,JSON.stringify(original));const bytes=await readFile(f);let s=await store.read('explorer',false);assert.deepEqual(s.items,original.items);assert.deepEqual(await readFile(f),bytes);
 let p=await store.read('explorer',e.id);await store.act('explorer',e.id,{action:'quest',revision:p.revision});assert.deepEqual(await readFile(f),bytes);
 const m=createWorldModel(definitions.explorer);s={...m.freshWorld(),items:['castle-key'],tutorial:{walk:true,talk:true}};s=m.worldAction(s,{action:'quest'}).state;const g=Object.keys(m.GATES)[0];s=m.worldAction(s,{action:'solve',gate:g,answer:m.GATES[g].answer}).state;
 const newer=structuredClone(e);newer.id='explorer-2026-10-06';newer.date='2026-10-06';const d=episodeDefinition(newer,CASTLE,[e]),n=createWorldModel(d).upgradeWorld(s);assert.ok(n.items.includes(e.id+'--rope'));assert.ok(d.ROOMS[s.room]);assert.equal(n.questStarted,false);assert.ok(createWorldModel(d).routeTo('castle-gate',d.startRoom,n).length>0);
});
test('only published episodes extend the map; a draft requires review mode and a future slot never leaks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'episode-dates-'));await mkdir(join(root,'explorer','review'),{recursive:true});await atomicJSON(join(root,'explorer','review','2026-10-05.json'),{player:'explorer',date:'2026-10-05',episode:samples.reader});assert.equal(await worldEpisodes(root,'explorer',{date:'2026-10-05',base:CASTLE}),null);assert.ok((await worldEpisodes(root,'explorer',{date:'2026-10-05',review:true,base:CASTLE})).episode);
 await atomicJSON(join(root,'explorer','2026-10-05.json'),{player:'explorer',date:'2026-10-05',episode:samples.reader});assert.equal(await worldEpisodes(root,'explorer',{date:'2026-10-04',base:CASTLE}),null);
});
test('quest publish refuses unverified or changed data and missing audio; approval commits the reviewed episode',async()=>{
 const {env}=await deployment(),paths=bookPaths(env),profiles=readProfiles(paths),date='2026-03-10';const r=await generateOne('older',{paths,profiles,date,noVoice:true,noLLM:true,review:true,now:NOW,log:()=>{}});await assert.rejects(publishOne('older',{paths,date,approve:true}),/state proof/);await certifyTestChapter(r.chapter,{paths});await atomicJSON(r.file,r.chapter);
 const changed=structuredClone(r.chapter);changed.episode.reveal='A different surprise.';await assert.rejects(verifyQuestPublication(changed,{paths}),/state proof/);
 const missing=structuredClone(r.chapter);missing.episode.lines.intro.clip='0000000000000000.wav';missing.episode.checks.digest=episodeDigest(missing.episode);await assert.rejects(verifyQuestPublication(missing,{paths}),/recorded bytes/);
 const result=await publishOne('older',{paths,date,approve:true,revision:r.chapter.meta.review.revision});assert.equal(result.state,'approved');const live=JSON.parse(await readFile(slot(paths.book,'older',date)+'.json','utf8'));assert.equal(live.episode.id,r.chapter.episode.id);
});
test('world-check accepts an episode model through its public guardrail API',async()=>{const {checkWorld}=await import('../../hub/world-check.mjs');assert.deepEqual(checkWorld({model:createWorldModel(episodeDefinition(samples.reader))}).issues,[]);});
test('first quest attempts feed learner evidence, with reading sounds and hints counted as help',async()=>{
 const {bookEvidence}=await import('../learner-profile.mjs'),ep=samples.reader,m=createWorldModel(episodeDefinition(ep));let s=m.worldAction(m.freshWorld(),{action:'quest'}).state;const k=Object.keys(m.GATES)[0],g=m.GATES[k];s=m.worldAction(s,{action:'solve',gate:k,answer:g.options.find(x=>x!==g.answer)}).state;s=m.worldAction(s,{action:'hint',gate:k}).state;s=m.worldAction(s,{action:'solve',gate:k,answer:g.answer}).state;assert.equal(s.attempts[k].misses,1);assert.equal(s.attempts[k].help,true);const saved=structuredClone(s.attempts[k]);s=m.worldAction(s,{action:'solve',gate:k,answer:g.options.find(x=>x!==g.answer)}).state;assert.deepEqual(s.attempts[k],saved);
 const evidence=bookEvidence({player:ep.player,chapters:{[ep.date]:{episode:ep}},progress:{days:{[ep.date]:{results:[{page:1,misses:1,hints:1}]}}}});assert.deepEqual(evidence[0].tags,['fact:8x9']);assert.equal(evidence[0].ok,false);assert.equal(evidence[0].help,true);
});
test('cached complete fallback recordings remain playable when the voice worker is unavailable',async()=>{
 const {env}=await deployment(),paths=bookPaths(env),r=await generateOne('older',{paths,profiles:readProfiles(paths),date:'2026-03-10',review:true,noLLM:true,noVoice:true,now:NOW,log:()=>{}});await certifyTestChapter(r.chapter,{paths});const {certifyEpisode}=await import('../episodes/certify.mjs');const result=await certifyEpisode(r.chapter,{paths,library:readLibrary(paths),narrate:async()=>{throw Error('worker unavailable');},audit:async()=>({issues:[],playable:true,viewports:[[1366,768],[390,844]],frames:12})});assert.equal(result.certified,true);assert.deepEqual(result.issues,[]);
});
test('first published quest inherits the completed prototype and migrates its bytes unchanged',async()=>{
 const bookDir=await mkdtemp(join(tmpdir(),'episode-prototype-')),definitions={explorer:episodeDefinition(samples.reader,CASTLE)},store=worldStore({bookDir,players:['explorer'],definitions});await mkdir(join(bookDir,'world'));const prior={schema:1,room:'castle-gate',items:['castle-key','spyglass','rope'],solved:['chess'],doorOpen:true,revision:5},file=join(bookDir,'world','explorer.preview.json');await writeFile(file,JSON.stringify(prior));const bytes=await readFile(file),s=await store.read('explorer',false);assert.deepEqual(s.items,prior.items);assert.equal(s.schema,3);assert.deepEqual(await readFile(file),bytes);assert.deepEqual(await readFile(join(bookDir,'world','explorer.json')),bytes);
});

test('quest carries reading assessment and uses confidence words and parent-approved sound spelling',()=>{
 const plan={level:'reader',player:'explorer',date:'2026-03-10',nameSpelling:['ROBIN','ADA','MOM','GROWN-UP']};
 const model={literacy:{wordsAlmost:['cat','pin'],wordsAboveLevel:['thin'],readingFocus:['short-i'],readingFeatures:{'short-i':{rate:.2}},readingSupport:{hearIt:true},masteryRule:{minMasteryReads:4}}};
 const learning=episodeLearning(plan,model,{bookPlan:{confidenceWords:['cat','pin'],soundFocus:['final-consonant'],hearAndBuildWords:['thin']}});
 const e=fallbackEpisode(plan,{actors:{'grown-up':{}},backgrounds:{garden:{}}},learning);
 assert.equal(e.puzzles.find(g=>g.id==='clue').answer,'pin');
 const names=e.puzzles.find(g=>g.practice==='name-spelling');assert.deepEqual(names.words,['anna','eric']);assert.equal(names.answer,'anna eric');assert.equal(names.soundSupport,true);
 assert.equal(e.puzzles.find(g=>g.practice==='hear-and-build').answer,'thin');
 assert.equal(learning.masteryRule.minMasteryReads,4);assert.deepEqual(learning.soundFocus,['final-consonant']);assert.deepEqual(checkEpisode(e,{...learning}).issues,[]);
 const changed=structuredClone(e);changed.puzzles.find(g=>g.practice==='name-spelling').words=['mom'];assert.ok(checkEpisode(changed,{...learning}).issues.length);
});

test('an explicit private name-spelling goal overrides only its exact legacy denylist entry',async()=>{
 const plan={level:'reader',player:'explorer',date:'2026-03-10',nameSpelling:['ROBIN','ADA']},library={actors:{'grown-up':{}},backgrounds:{garden:{}}};
 const raw=fallbackEpisode(plan,library),r=await writeEpisode(plan,{library,extra:['Robin','Schooltown'],allow:['ROBIN','ADA'],ask:async()=>({source:'writer',text:JSON.stringify(raw)})});
 assert.equal(r.source,'writer');assert.deepEqual(r.checks.issues,[]);assert.deepEqual(r.episode.puzzles.find(g=>g.practice==='name-spelling').words,['anna','eric']);
 raw.intro='Visit Schooltown.';const unsafe=await writeEpisode(plan,{library,extra:['Robin','Schooltown'],allow:['ROBIN','ADA'],ask:async()=>({source:'writer',text:JSON.stringify(raw)})});assert.equal(unsafe.source,'deterministic quest fallback');assert.ok(unsafe.lint.some(x=>x.includes('Schooltown')));
});
