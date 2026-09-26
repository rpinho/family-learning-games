import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {writeStory,generateOne,recapLines} from '../generate.mjs';
import {templateChapter} from '../template.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {speechLines,assemble} from '../assemble.mjs';
import {deployment,NOW,plans} from './fixtures.mjs';
const reply=obj=>({text:'Here you go:\n'+JSON.stringify(obj),source:'fake:model'});

test('A clean model chapter is used as written',async()=>{
 const p=plans(['2026-03-10'])[1];const story={...templateChapter(p),title:'The Model Wrote This'};
 const r=await writeStory(p,{ask:async()=>reply(story)});
 assert.equal(r.source,'fake:model');assert.equal(r.story.title,'The Model Wrote This');assert.deepEqual(r.lint,[]);
});
test('One repair pass, then the template',async()=>{
 const p=plans(['2026-03-10'])[0],good=templateChapter(p),bad={...good,pages:good.pages.map(x=>({...x,text:x.text+' A scary ghost!'}))};
 let calls=0;
 let r=await writeStory(p,{ask:async(prompt)=>{calls++;return calls===1?reply(bad):reply(good);}});
 assert.equal(calls,2);assert.match(r.source,/repaired/);assert.ok(r.lint.some(i=>i.startsWith('scary')));
 calls=0;r=await writeStory(p,{ask:async()=>{calls++;return reply(bad);}});
 assert.equal(calls,2);assert.match(r.source,/^template/);assert.deepEqual(r.story,templateChapter(p));
 r=await writeStory(p,{ask:async()=>({text:'not json at all',source:'x'})});assert.match(r.source,/^template/);
 r=await writeStory(p,{ask:async()=>null});assert.equal(r.source,'template (no model reachable)');
});
test('The repair prompt carries the lint issues',async()=>{
 const p=plans(['2026-03-10'])[1],good=templateChapter(p);const prompts=[];
 await writeStory(p,{ask:async(prompt)=>{prompts.push(prompt);return prompts.length===1?reply({...good,title:''}):reply(good);}});
 assert.match(prompts[1],/title missing/);assert.match(prompts[0],/CATCH THE MISTAKE/);assert.ok(prompts[0].includes(p.mistake.claim));
});
test('Nightly generation publishes chapter, markdown and bedtime page atomically, and is idempotent',async()=>{
 const {root,env}=await deployment();const paths=bookPaths(env),profiles=readProfiles(paths);const logs=[];
 const r=await generateOne('older',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:m=>logs.push(m),ask:async()=>null});
 const ch=JSON.parse(await readFile(r.file,'utf8'));
 assert.equal(ch.schema,'family-book-chapter-1');assert.equal(ch.name,'Leo');assert.equal(ch.number,1);assert.equal(ch.companion.name,'Gizmo');
 assert.ok(ch.pages.some(p=>p.kind==='mistake')&&ch.pages.filter(p=>p.kind==='challenge').length===4);
 assert.ok(ch.meta.dadLines.includes('Leo scored a goal'));
 const html=await readFile(join(root,'book','older','2026-03-10.html'),'utf8');
 assert.match(html,/Catch the mistake/);assert.match(html,/Leo scored a goal/);assert.match(html,/about 12 min/);assert.doesNotMatch(html,/Smithers/);
 assert.deepEqual((await readdir(join(root,'book','.staging'))),[],'no half-published files');
 assert.equal(((await stat(r.file)).mode&0o777),0o600);
 assert.ok((await readdir(join(root,'learner'))).includes('older.json'));
 const again=await generateOne('older',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:()=>{},ask:async()=>null});assert.equal(again.skipped,true);
 const young=await generateOne('young',{paths,profiles,date:'2026-03-10',noVoice:true,now:NOW,log:()=>{},ask:async()=>null});
 assert.equal(young.chapter.level,'early');assert.ok(young.chapter.pages.some(p=>p.teach));
});
test('Every line a chapter can speak is in its narration list',()=>{
 const p=plans(['2026-03-10'])[1],ch=assemble(templateChapter(p),p);const lines=new Set(speechLines(ch));
 for(const pg of ch.pages){pg.lines.forEach(l=>assert.ok(lines.has(l)));if(pg.item)assert.ok(lines.has(pg.item.spoken));if(pg.mistake){assert.ok(lines.has(pg.mistake.caught));assert.ok(lines.has(pg.mistake.fix.spoken));}}
 assert.ok(lines.has(ch.cover));assert.ok(lines.has('Uh oh. I think I made a mistake. Can you find it?'));
});
test('Recap lines for one child only',()=>{
 assert.deepEqual(recapLines('## Leo\n- **Time:** 5 min\n- **Worth a look:**\n\n## Ada\n- x','Leo'),['Time: 5 min']);
});
test('Chapters carry their cast; pages know who is on them; portraits only when the file exists',()=>{
 const p={...plans(['2026-03-10'])[1]};p.cast=[{id:'dragon',name:'Dragon',emoji:'🐉'},{id:'cat',name:'the Twin Cats',emoji:'🐱'}];p.companion=p.cast[0];
 const ch=assemble(templateChapter(p),p,{portraits:new Set(['dragon'])});
 assert.deepEqual(ch.cast.map(c=>[c.id,c.portrait]),[['dragon','dragon.jpg'],['cat',null]]);
 assert.deepEqual(ch.pages[0].cast,['dragon','cat']);
 assert.ok(ch.pages.some(pg=>pg.cast.length===1&&pg.cast[0]==='dragon'));
});
