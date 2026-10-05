import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {needsRefresh,refresh} from '../refresh.mjs';
const ch=(source,generatedAt='2026-10-02T01:19:15Z')=>({meta:{source,generatedAt}});
test('the 03:30 refresh rewrites only a template, a missing chapter, or one older than a day note for that child',()=>{
 assert.equal(needsRefresh({chapter:null,player:'beginner'}),'no chapter for today');
 assert.equal(needsRefresh({chapter:ch('template (model chapter failed lint)'),player:'beginner'}),'fell back to the template');
 const notes=[{child:'beginner',at:'2026-10-02T01:40:00Z'},{child:'explorer',at:'2026-10-02T00:30:00Z'},{child:'both',at:'2026-10-01T20:00:00Z'}];
 assert.match(needsRefresh({chapter:ch('codex:x'),notes,player:'beginner'}),/1 day note/);
 assert.equal(needsRefresh({chapter:ch('codex:x'),notes,player:'explorer'}),null,'a note from before the chapter changes nothing');
 assert.equal(needsRefresh({chapter:ch('codex:x'),notes:[],player:'explorer'}),null);
});
test('dry run decides per child and never touches anything after 05:30',async()=>{
 const book=await mkdtemp(join(tmpdir(),'refresh-'));process.env.FAMILY_BOOK=book;process.env.FAMILY_TZ='America/New_York';
 await writeFile(join(book,'profiles.json'),JSON.stringify({_comment:'x',beginner:{},explorer:{}}));
 for(const p of ['beginner','explorer'])await mkdir(join(book,p),{recursive:true});
 await writeFile(join(book,'beginner','2026-10-02.json'),JSON.stringify(ch('template (model chapter failed lint)')));
 await writeFile(join(book,'explorer','2026-10-02.json'),JSON.stringify(ch('codex:gpt (repaired)','2026-10-02T01:07:02Z')));
 await mkdir(join(book,'daynotes'));await writeFile(join(book,'daynotes','2026-10-01.json'),JSON.stringify({notes:[{child:'explorer',at:'2026-10-02T01:45:00Z',text:'x'}]}));
 const logs=[];let r=await refresh({now:Date.parse('2026-10-02T07:30:00Z'),dryRun:true,log:m=>logs.push(m)});
 assert.deepEqual(r.done.map(d=>d.player).sort(),['beginner','explorer']);
 r=await refresh({now:Date.parse('2026-10-02T09:45:00Z'),dryRun:true,log:()=>{}});
 assert.equal(r.skipped,'too late');assert.deepEqual(r.done,[]);
 delete process.env.FAMILY_BOOK;delete process.env.FAMILY_TZ;
});
