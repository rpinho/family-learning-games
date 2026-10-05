import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {writeStory,generateOne,readLibrary,actorIdsFor,DEFAULT_MODELS} from '../generate.mjs';
import {templateChapter} from '../template.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {speechLines,assemble,attachClips,voicesFor} from '../assemble.mjs';
import {buildPrompt} from '../prompt.mjs';
import {drawnBeats} from '../quest-beats.mjs';
import {COUNT_THINGS} from '../plan.mjs';
import {deployment,NOW,plans} from './fixtures.mjs';
const reply=obj=>({text:'Here you go:\n'+JSON.stringify(obj),source:'fake:model'});
const library=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url),'utf8'));
const ready=p=>{drawnBeats(p,library,{countThings:COUNT_THINGS});const ids=actorIdsFor(p,library);p.actorIds=ids;return {library,actors:ids.all,speakers:['narrator','dad',...p.cast.map(c=>c.id)]};};

test('Chapters are written by Claude Opus 5.5, with GPT-6 Sol as the fallback',()=>{
 assert.deepEqual(DEFAULT_MODELS,{claude:'claude-opus-5-5',codex:'gpt-6-sol'});
});
test('A clean model chapter is used as written',async()=>{
 const p=plans(['2026-03-10'])[1],o=ready(p);const story={...templateChapter(p,library),title:'The Model Wrote This'};
 const r=await writeStory(p,{...o,ask:async()=>reply(story)});
 assert.equal(r.source,'fake:model');assert.equal(r.story.title,'The Model Wrote This');assert.deepEqual(r.lint,[]);
});
test('Repairs from the best version so far, up to three times, then the template',async()=>{
 const p=plans(['2026-03-10'])[0],o=ready(p),good=templateChapter(p,library),bad={...good,pages:good.pages.map(x=>({...x,say:[...x.say,['narrator','A scary ghost!']]}))};
 let calls=0;
 let r=await writeStory(p,{...o,ask:async()=>{calls++;return calls===1?reply(bad):reply(good);}});
 assert.equal(calls,2);assert.match(r.source,/repaired/);assert.ok(r.lint.some(i=>i.startsWith('scary')));
 calls=0;r=await writeStory(p,{...o,ask:async()=>{calls++;return reply(bad);}});
 assert.equal(calls,4);assert.match(r.source,/^template/);assert.deepEqual(r.story,templateChapter(p,library));
 r=await writeStory(p,{...o,ask:async()=>({text:'not json at all',source:'x'})});assert.match(r.source,/^template/);
 r=await writeStory(p,{...o,ask:async()=>null});assert.equal(r.source,'template (no model reachable)');
});
test('The brief lists the beats, the picture library and the magic words',()=>{
 const [young,older]=plans(['2026-03-10']);ready(young);ready(older);
 const a=buildPrompt(young,{library,actors:young.actorIds.all});
 assert.match(a,/teach-letter/);assert.match(a,/stones/);assert.match(a,/NO!/);assert.match(a,/meadow/);assert.match(a,/cannot read yet/);
 const b=buildPrompt(older,{library,actors:older.actorIds.all});
 assert.match(b,/MAGIC WORDS/);for(const w of older.magic)assert.ok(b.includes(`"${w}"`));assert.match(b,/spell/);
});
test('Nightly generation writes a quest with one intro atomically, is idempotent, and replaces an older format',async()=>{
 const {root,env}=await deployment();const paths=bookPaths(env),profiles=readProfiles(paths);const logs=[];
 const r=await generateOne('older',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:m=>logs.push(m),ask:async()=>null});
 const ch=JSON.parse(await readFile(r.file,'utf8'));
 assert.equal(ch.schema,'family-book-chapter-2');assert.equal(ch.name,'Robin');assert.equal(ch.number,1);
 assert.equal(ch.pages.length,1);assert.equal(ch.episode.schema,'family-world-episode-1');assert.equal(ch.episode.rooms.length,4);assert.ok(ch.episode.puzzles.some(g=>g.kind==='tiles'&&g.soundSupport));assert.ok(ch.episode.puzzles.some(g=>g.math?.type==='multiply'));assert.ok(ch.episode.rooms.some(r=>r.door&&!r.door.return));assert.equal(ch.episode.checks.certified,false);
 assert.ok(ch.meta.dadLines.includes('Robin scored a goal'));
 assert.ok(!(await readdir(join(root,'book','older'))).some(f=>f.endsWith('.html')),'no printable bedtime page any more');
 assert.deepEqual((await readdir(join(root,'book','.staging'))),[],'no half-published files');
 assert.equal(((await stat(r.file)).mode&0o777),0o600);
 const again=await generateOne('older',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:()=>{},ask:async()=>null});assert.equal(again.skipped,true);
 await mkdir(join(root,'book','young'),{recursive:true});await writeFile(join(root,'book','young','2026-03-10.json'),JSON.stringify({schema:'family-book-chapter-1',pages:[]}));
 const young=await generateOne('young',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:()=>{},ask:async()=>null});
 assert.equal(young.skipped,undefined,'an older-format chapter is replaced');
 assert.equal(young.chapter.level,'early');assert.equal(young.chapter.pages.length,1);assert.ok(young.chapter.episode.puzzles.some(g=>g.kind==='count'));assert.ok(young.chapter.episode.learning.taughtLetters.length);
});
test('Every spoken line carries a voice and gets its clip; friends and Dad have their own voices',()=>{
 const p=plans(['2026-03-10'])[0],o=ready(p);p.cast=[{...p.cast[0],voice:'am_puck',speed:1.05}];
 const v=voicesFor(p);const ch=assemble(templateChapter(p,library),p,{library,actors:o.actors,voices:v});
 const lines=speechLines(ch);assert.ok(lines.every(l=>l.voice&&l.speed&&l.text));
 assert.ok(lines.some(l=>l.voice==='am_michael'),'Dad speaks');assert.ok(lines.some(l=>l.voice==='am_puck'),'the friend speaks in its own voice');
 const clips=Object.fromEntries(lines.map((l,i)=>[`${l.voice}|${l.speed}|${l.text}`,String(i).padStart(16,'0')+'.wav']));attachClips(ch,clips);
 const all=[];const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x))return x.forEach(walk);if(typeof x.text==='string'&&x.voice)return all.push(x);Object.values(x).forEach(walk);};walk(ch);
 assert.ok(all.length>30&&all.every(l=>l.clip),'every line on every page has narration');
 for(const pg of ch.pages)assert.ok(pg.say.length||pg.beat,`page ${pg.id} is narrated`);
});
test('A failed narration leaves the existing chapter intact and never publishes an unvoiced replacement',async()=>{
 const {root,env}=await deployment(),paths=bookPaths(env),profiles=readProfiles(paths),date='2026-03-10';
 await mkdir(join(paths.book,'older'),{recursive:true});const file=join(paths.book,'older',date+'.json');
 const before=JSON.stringify({schema:'family-book-chapter-2',title:'Keep this chapter',pages:[]});await writeFile(file,before);
 await assert.rejects(generateOne('older',{paths:{...paths,python:'false'},profiles,date,force:true,noLLM:true,now:NOW,log:()=>{}}),/Deterministic quest failed|narration failed|write EPIPE/);
 assert.equal(await readFile(file,'utf8'),before);
});
test('The generic picture library ships with the repository and resolves',()=>{
 const lib=readLibrary(bookPaths({FAMILY_DEPLOY_ROOT:'/nonexistent'}));
 assert.equal(lib.private,false);assert.ok(lib.actors.hero&&lib.actors['grown-up']&&lib.backgrounds.meadow);
});

test('Release picture additions remain available with a private library; private entries take precedence',async()=>{
 const {root,env}=await deployment(),paths=bookPaths(env);await mkdir(join(paths.book,'art','lib'),{recursive:true});
 await writeFile(join(paths.book,'art','lib','library.json'),JSON.stringify({backgrounds:{own:{file:'own.svg'}},actors:{custom:{}},props:{}}));
 const lib=readLibrary(paths);assert.ok(lib.backgrounds.castle);assert.deepEqual(lib.backgrounds.own,{file:'own.svg'});assert.ok(lib.actors.custom);assert.equal(lib.private,true);
 await writeFile(join(paths.book,'art','lib','library.json'),JSON.stringify({backgrounds:{'circle-car':{file:'private.webp'}},actors:{},props:{}}));
 assert.equal(readLibrary(paths).backgrounds['circle-car'].file,'private.webp');
});

test('Release picture additions augment the private library without overwriting or mutating it',async()=>{
 const {mergeLibraryAdditions}=await import('../generate.mjs');
 const own={backgrounds:{room:{file:'private-room.webp'}},actors:{guide:{name:'Guide'}},props:{basket:{file:'basket.svg'}}};
 const additions={backgrounds:{room:{file:'default-room.webp'},park:{file:'park.webp'}}};const before=JSON.stringify(own);
 const out=mergeLibraryAdditions(own,additions);assert.equal(out.backgrounds.park.file,'park.webp');assert.equal(out.backgrounds.room.file,'private-room.webp');assert.deepEqual(out.actors,own.actors);assert.deepEqual(out.props,own.props);assert.equal(JSON.stringify(own),before);
});

test('A repair that drops a beat never replaces the better draft (the 2026-10-02 Volcano fallback)',async()=>{
 const p=plans(['2026-03-10'])[0],o=ready(p),good=templateChapter(p,library);
 // first draft: one flagged line; repair 1: drops the last page (a beat); repair 2: clean
 const draft={...good,pages:good.pages.map((x,i)=>i===0?{...x,say:[...x.say,['narrator','A scary ghost!']]}:x)};
 const bi=good.pages.findIndex(x=>x.beat);assert.ok(bi>=0);const dropped={...good,pages:good.pages.filter((_,i)=>i!==bi)};
 const seen=[];let calls=0;
 const r=await writeStory(p,{...o,ask:async prompt=>{calls++;seen.push(prompt);return calls===1?reply(draft):calls===2?reply(dropped):reply(good);}});
 assert.equal(calls,3);assert.match(r.source,/repaired twice/);
 // the second repair was asked from the first draft (fewer serious problems), not from the version that lost a beat
 assert.ok(seen[2].includes('A scary ghost!'),'repair 2 must start from the first draft');
 assert.match(seen[1],/Keep every beat/);
});

test('Issue weights: a missing beat outweighs synthetic copy and duration errors',async()=>{
 const {writeStoryScore}=await import('../generate.mjs');
 const draft=['page 4: "ahead" is said twice in a row; say every word once','the chapter would run about 245 s (max 240 s); cut story lines or pages','the friend Rook must be named in the story'];
 const repaired=['beat volcano-path (puzzle) must appear exactly once (found 0)'];
 assert.ok(writeStoryScore(draft)<writeStoryScore(repaired));
});
