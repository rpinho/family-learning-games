import {certifyTestChapter} from './episode-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {deployment,NOW} from './fixtures.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {generateOne} from '../generate.mjs';
import {publishOne} from '../publish.mjs';
import {deadline} from '../deadline.mjs';
import {draft} from '../draft.mjs';
import {slot,readJSON,atomicJSON,requestChanges,withSlotLock} from '../review.mjs';
import {needsRefresh} from '../refresh.mjs';
const date='2026-03-10';
async function fixture(){const {env}=await deployment(),paths=bookPaths(env),profiles=readProfiles(paths);return {paths,profiles};}
const gen=async(player,opts)=>{const r=await generateOne(player,{...opts,noLLM:true,noVoice:true,now:NOW,log:()=>{}});if(r.chapter){await certifyTestChapter(r.chapter,{paths:opts.paths});await atomicJSON(r.file,r.chapter);}return r;};
const fakeCalm=async ch=>({schema:'family-book-calm-1',date:ch.date,player:ch.player,pages:{}});
test('review generation preserves live chapter, saves, profiles and learners; uses the same chapter number and supplies a checked quest',async()=>{
 const {paths,profiles}=await fixture();const before=await gen('young',{paths,profiles,date});
 const live=await readFile(before.file),learner=await readFile(join(paths.learner,'young.json')),profile=await readFile(paths.profiles),save=await readFile(join(paths.data['number-park'],'young.json'));
 const r=await gen('young',{paths,profiles,date,review:true});assert.match(r.file,/review/);assert.equal(r.chapter.number,1);assert.equal(r.chapter.meta.review.state,'pending');assert.ok(r.chapter.episode.checks.certified);
 assert.deepEqual(await readFile(before.file),live);assert.deepEqual(await readFile(join(paths.learner,'young.json')),learner);assert.deepEqual(await readFile(paths.profiles),profile);assert.deepEqual(await readFile(join(paths.data['number-park'],'young.json')),save);
 assert.equal((await gen('young',{paths,profiles,date,review:true})).skipped,true);
});
test('request changes are retained on redo and applied to writer; stale approval refused, failed redo preserves draft',async()=>{
 const {paths,profiles}=await fixture(),r=await gen('young',{paths,profiles,date,review:true}),revision=r.chapter.meta.review.revision;
 await requestChanges({book:paths.book,player:'young',date,revision,note:'Use a warm meadow ending.'});assert.equal((await readJSON(r.file)).meta.review.state,'changes');
 const before=await readFile(r.file);await assert.rejects(generateOne('young',{paths:{...paths,python:'false'},profiles,date,review:true,force:true,noLLM:true,now:NOW,log:()=>{}}));assert.deepEqual(await readFile(r.file),before);
 const prompts=[];await generateOne('young',{paths,profiles,date,review:true,force:true,noVoice:true,now:NOW,log:()=>{},ask:async p=>{prompts.push(p);return null;}});assert.ok(prompts.some(p=>p.includes('Use a warm meadow ending.')));assert.equal((await readJSON(slot(paths.book,'young',date,true)+'.review.json')).notes[0].text,'Use a warm meadow ending.');
 await assert.rejects(publishOne('young',{paths,date,approve:true,revision}),/draft changed/);
});
test('publishing requires approval, backs up replaced chapter, atomically moves draft and protects approved chapter from refresh and force',async()=>{
 const {paths,profiles}=await fixture();await gen('young',{paths,profiles,date});const live=slot(paths.book,'young',date)+'.json',before=await readFile(live);const r=await gen('young',{paths,profiles,date,review:true});
 await assert.rejects(publishOne('young',{paths,date}),/not been approved/);
 const pub=await publishOne('young',{paths,date,approve:true,revision:r.chapter.meta.review.revision});assert.deepEqual(await readFile(join(pub.backup,date+'.json')),before);
 const ch=await readJSON(live);assert.equal(ch.meta.review.state,'approved');assert.ok(ch.episode.checks.certified);assert.equal(await readJSON(r.file),null);assert.equal((await publishOne('young',{paths,date,approve:true})).skipped,true);
 assert.equal(needsRefresh({chapter:{...ch,meta:{...ch.meta,source:'template',generatedAt:'2000-01-01'}},player:'young',notes:[{child:'young',at:'2026-03-11'}]}),null);
 const approved=await readFile(live);assert.equal((await gen('young',{paths,profiles,date,force:true})).skipped,true);assert.deepEqual(await readFile(live),approved);
});
test('deadline retains approval, auto-publishes changes, generates missing draft live and runs hunts; repeated runs do not regenerate',async()=>{
 const {paths,profiles}=await fixture();const r=await gen('young',{paths,profiles,date,review:true});await publishOne('young',{paths,date,approve:true});const approved=await readFile(slot(paths.book,'young',date)+'.json');
 await gen('older',{paths,profiles,date,review:true});let sends=0,hunts=0;
 const opts={paths,date,generate:gen,calm:fakeCalm,send:async({chapters})=>{sends++;assert.deepEqual(chapters.map(c=>c.player),['older']);},hunts:()=>{hunts++;return {status:0};}};
 const d=await deadline(opts);assert.deepEqual(await readFile(slot(paths.book,'young',date)+'.json'),approved);assert.equal((await readJSON(slot(paths.book,'older',date)+'.json')).meta.review.state,'auto');assert.equal(sends,1);assert.equal(hunts,1);
 await deadline({...opts,generate:()=>assert.fail('must not regenerate')});assert.equal(hunts,2);
 const next='2026-03-11';await deadline({...opts,date:next,players:['older'],send:async()=>{},generate:gen});assert.equal((await readJSON(slot(paths.book,'older',next)+'.json')).meta.review.state,'auto');
});
test('deadline still attempts the other child, notification and hunts on a generation failure',async()=>{
 const {paths}=await fixture();let hunts=0,sent=0;
 await assert.rejects(deadline({paths,date,generate:async(p,o)=>{if(p==='young')throw Error('writer down');return gen(p,o);},calm:fakeCalm,send:async()=>sent++,hunts:()=>{hunts++;},log:()=>{}}),/incomplete/);assert.equal(hunts,1);assert.equal(sent,1);assert.ok(await readJSON(slot(paths.book,'older',date)+'.json'));
});
test('slot lock rejects a concurrent publish while a draft is being generated',async()=>{
 const {paths}=await fixture();await withSlotLock(paths.book,'young',date,async()=>{await assert.rejects(publishOne('young',{paths,date,approve:true}),/busy/);});await assert.rejects(publishOne('young',{paths,date,approve:true}),/No review/);
});
test('daytime orchestrator drafts tomorrow and sends both titles without publishing',async()=>{
 const {paths}=await fixture();let sent=null;await draft({paths,date,generate:gen,send:async j=>sent=j,log:()=>{}});assert.equal(sent.kind,'draft');assert.equal(sent.chapters.length,2);assert.equal(await readJSON(slot(paths.book,'young',date)+'.json'),null);
});

test('a scheduled draft run that finds the drafts already written sends no second email',async()=>{
 const {draft}=await import('../draft.mjs');const sent=[];
 const paths={book:'/nonexistent-book-dir',timeZone:'America/New_York'};
 const r=await draft({paths,date:'2026-10-03',players:['beginner'],send:async m=>sent.push(m),generate:async()=>({skipped:true}),log:()=>{}});
 assert.equal(sent.length,0);assert.deepEqual(r.chapters,[]);
});
