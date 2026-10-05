import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,mkdir,symlink,stat,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {onboardingStore} from '../onboarding-store.mjs';
import {bookPaths,readProfiles,readCast} from '../../book/paths.mjs';
import {learnerFor,bookPlayers} from '../../book/build-learner.mjs';
import {planChapter} from '../../book/plan.mjs';
import {artReferences,writeArtReferences} from '../../book/private-art.mjs';
const input={name:'River',age:6,grade:'Year 1',skills:{letters:'some',counting:10,reading:'starting',maths:'addition'},interests:['space'],favourites:['trains'],photos:[]};
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'family-setup-'));t.after(()=>rm(root,{recursive:true,force:true}));const paths=bookPaths({FAMILY_DEPLOY_ROOT:root,FAMILY_DATA:join(root,'hub')});return {root,paths,store:onboardingStore({paths})};}
const read=async f=>JSON.parse(await readFile(f,'utf8'));
test('zero-photo setup writes Book/cast/learner formats, private permissions, separate children, and preserves progress on edits',async t=>{
 const {paths,store}=await fixture(t);assert.equal((await store.read()).required,true);
 const a=await store.save(input),b=await store.save({...input,name:'Robin',age:9,skills:{...input.skills,reading:'words',maths:'tables'}}),c=await store.save({...input,name:'Sky'});
 assert.equal(a.id,'beginner_1');assert.equal(b.id,'explorer_1');assert.equal(c.id,'beginner_2');
 assert.equal((await store.read()).children.length,3);assert.equal((await store.read()).required,false);
 assert.equal(readProfiles(paths)[a.id].countsTo,10);assert.equal(readCast(paths).children[a.id].name,'River');
 const learner=await read(join(paths.learner,a.id+'.json'));assert.equal(learner.schema,'family-book-learner-1');assert.deepEqual(learner.literacy.wordsMastered,[]);assert.equal(learner.onboarding.startingSkills.source,'grown-up-report');
 learner.story={kept:true};await writeFile(join(paths.learner,a.id+'.json'),JSON.stringify(learner));
 await store.save({...input,id:a.id,name:'River Updated',placement:['independent','help','later','skip']});
 assert.deepEqual((await read(join(paths.learner,a.id+'.json'))).story,{kept:true});
 assert.equal((await stat(paths.profiles)).mode&0o777,0o600);assert.equal((await stat(paths.learner)).mode&0o777,0o700);
 assert.deepEqual((await readdir(paths.book)).sort(),['cast.json','profiles.json']);
 const rebuilt=await learnerFor(a.id,{paths});assert.equal(rebuilt.name,'River Updated');assert.equal(rebuilt.onboarding.placement.source,'grown-up-observation');assert.ok(rebuilt.interests.includes('trains'));
 const plan=planChapter(rebuilt,{date:'2026-10-05',profile:readProfiles(paths)[a.id],cast:readCast(paths)});assert.equal(plan.age,6);assert.equal(plan.grade,'Year 1');assert.equal(plan.startingSkills.letters,'some');assert.equal(plan.placement.source,'grown-up-observation');
 assert.deepEqual(bookPlayers({...paths,config:{players:[{id:'beginner'}]}},readProfiles(paths)).sort(),[a.id,b.id,c.id].sort());
});
test('path traversal, external configured paths, symlink directories/files and malformed input never write outside the private root',async t=>{
 const {root,paths,store}=await fixture(t),outside=await mkdtemp(join(tmpdir(),'family-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
 for(const id of ['../outside','/outside','__proto__','beginner_0'])await assert.rejects(store.save({...input,id}),/existing child/);
 await assert.rejects(store.save({...input,age:99}),/age/);await assert.rejects(store.save({...input,photos:['data:image/svg+xml;base64,PHN2Zz4=']}),/PNG or JPEG/);
 await assert.rejects(onboardingStore({paths:{...paths,learner:outside}}).save(input),/private data directory/);
 await mkdir(paths.book,{recursive:true});await symlink(outside,paths.learner);await assert.rejects(store.save(input),/symlinks/);await rm(paths.learner);
 const sentinel=join(outside,'sentinel');await writeFile(sentinel,'KEEP');await symlink(sentinel,paths.profiles);await assert.rejects(store.save(input),/symlinks/);
 assert.equal(await readFile(sentinel,'utf8'),'KEEP');assert.deepEqual(await readdir(outside),['sentinel']);assert.deepEqual(await readdir(root),['book']);
});
test('concurrent adds have unique save identities; failed validations leave the previous profile intact',async t=>{
 const {paths,store}=await fixture(t);const results=await Promise.all([store.save(input),store.save({...input,name:'Robin'})]);assert.equal(new Set(results.map(x=>x.id)).size,2);
 const before=await readFile(paths.profiles,'utf8');await assert.rejects(store.save({...input,id:results[0].id,skills:{...input.skills,counting:-1}}));assert.equal(await readFile(paths.profiles,'utf8'),before);
});
test('photos remain private; art consumes only enabled local references, and removal deletes originals',async t=>{
 const {paths,store}=await fixture(t);const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
 const a=await store.save({...input,photos:[png]});assert.equal(a.children[0].photoCount,1);assert.deepEqual((await artReferences(paths)).references,[]);
 const photo=readProfiles(paths)[a.id].artReferences.photos[0];assert.equal((await stat(join(paths.book,photo))).mode&0o777,0o600);
 await store.save({...input,id:a.id,privateArt:true});const refs=await artReferences(paths);assert.equal(refs.references[0].role,'child-likeness');assert.ok(refs.references[0].file.startsWith(await realpath(paths.root)));assert.equal((await read(await writeArtReferences(paths))).localOnly,true);
 await store.save({...input,id:a.id,removePhotos:true});await assert.rejects(stat(join(paths.book,photo)),{code:'ENOENT'});assert.deepEqual((await artReferences(paths)).references,[]);
});
async function hub(root,extraEnv={}){const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DEPLOY_DIR:'',FAMILY_DEPLOY_ROOT:root,FAMILY_DATA:join(root,'hub'),FAMILY_BOOK:join(root,'book'),FAMILY_LEARNER:join(root,'learner'),PORT:'0',HOST:'127.0.0.1',...extraEnv},stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',x=>err+=x);const output=await new Promise((ok,fail)=>{child.stdout.once('data',x=>ok(String(x)));child.once('error',fail);child.once('exit',()=>fail(Error(err)));});return {child,base:'http://127.0.0.1:'+output.match(/localhost:(\d+)/)[1]};}
async function stop(child){child.kill('SIGTERM');await new Promise(ok=>child.once('exit',ok));}
test('adult gate protects reads/writes; new child is immediately playable in hub/Book/World and survives restart',async t=>{
 const {root}=await fixture(t);let h=await hub(root);t.after(()=>h.child.exitCode===null?stop(h.child):null);
 const post=(path,body,cookie='')=>fetch(h.base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 assert.equal((await fetch(h.base+'/api/onboarding')).status,403);assert.equal((await post('/api/onboarding',input)).status,403);
 const gate=await(await fetch(h.base+'/api/book/review/gate')).json();const answer=gate.code.replace(/[^A-Z]/g,'').split('').reverse().join('');const unlocked=await post('/api/book/review/gate',{id:gate.id,answer});assert.equal(unlocked.status,200);const cookie=unlocked.headers.get('set-cookie').split(';')[0];
 const r=await post('/api/onboarding',input,cookie);assert.equal(r.status,200,await r.clone().text());const saved=await r.json();
 const cfg=await(await fetch(h.base+'/api/config')).json();assert.equal(cfg.onboardingRequired,false);assert.equal(cfg.players.find(p=>p.id===saved.id).name,'River');
 for(const path of ['/api/dribble?player=','/api/chess?player=','/api/book?player=']){const response=await fetch(h.base+path+saved.id);assert.equal(response.status,200,path+' '+await response.text());}
 assert.equal((await fetch(h.base+'/api/world?preview=1&player='+saved.id)).status,503); // Public worlds require the optional reviewed art library.
 assert.equal((await post('/api/onboarding',{...input,id:'../../escape'},cookie)).status,400);
 assert.equal((await fetch(h.base+'/book/photos/'+saved.id+'/anything.jpg')).status,404);
 assert.equal((await fetch(h.base+'/api/onboarding',{headers:{Cookie:cookie,Origin:'https://untrusted.example'}})).status,403);
 await stop(h.child);h=await hub(root);const after=await(await fetch(h.base+'/api/config')).json();assert.equal(after.players.find(p=>p.id===saved.id).name,'River');
});

test('the public nightly entry point generates valid Book quest episodes for onboarded children without photos or model/voice calls',async t=>{
 const {root,paths,store}=await fixture(t);
 const a=await store.save(input),b=await store.save({...input,name:'Robin',skills:{...input.skills,reading:'words',maths:'tables'}});
 const run=spawnSync(process.execPath,[new URL('../../scripts/family-nightly.mjs',import.meta.url).pathname,'--no-llm','--date','2026-10-05'],{env:{...process.env,FAMILY_DEPLOY_ROOT:root,FAMILY_DATA:join(root,'hub'),FAMILY_DEPLOY_DIR:'',FAMILY_CONFIG:'',FAMILY_BOOK:paths.book,FAMILY_LEARNER:paths.learner,FAMILY_PRIVATE_ART_SCRIPT:'',BOOK_BACKEND:'none'},encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stdout+run.stderr);
 for(const id of [a.id,b.id]){const ch=await read(join(paths.book,id,'2026-10-05.json'));assert.equal(ch.schema,'family-book-chapter-2');assert.equal(ch.episode.player,id);assert.equal(ch.meta.source,'deterministic quest fallback');assert.equal((await read(join(paths.learner,id+'.json'))).onboarding.startingSkills.source,'grown-up-report');}
});

test('managed staging reads and edits its own Book/learner paths inside the configured private root',async t=>{
 const {root,paths}=await fixture(t);await mkdir(paths.book,{recursive:true});await writeFile(paths.profiles,JSON.stringify({beginner:{name:'Live Demo'}}));const original=await readFile(paths.profiles,'utf8');
 const stagePaths=bookPaths({FAMILY_DEPLOY_ROOT:root,FAMILY_BOOK:join(root,'staging-data','book'),FAMILY_LEARNER:join(root,'staging-data','learner')});const saved=await onboardingStore({paths:stagePaths}).save(input);
 const h=await hub(root,{FAMILY_DEPLOY_DIR:join(root,'staging'),FAMILY_CHANNEL:'staging',FAMILY_BOOK:'',FAMILY_LEARNER:''});t.after(()=>stop(h.child));const cfg=await(await fetch(h.base+'/api/config')).json();assert.equal(cfg.players.find(p=>p.id===saved.id).name,'River');
 const gate=await(await fetch(h.base+'/api/book/review/gate')).json();const post=(path,body,cookie='')=>fetch(h.base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 const unlock=await post('/api/book/review/gate',{id:gate.id,answer:gate.code.replace(/[^A-Z]/g,'').split('').reverse().join('')});const cookie=unlock.headers.get('set-cookie').split(';')[0];assert.equal((await post('/api/onboarding',{...input,id:saved.id,name:'Stage Demo'},cookie)).status,200);
 assert.equal(readProfiles(stagePaths)[saved.id].name,'Stage Demo');assert.equal(await readFile(paths.profiles,'utf8'),original);
});
