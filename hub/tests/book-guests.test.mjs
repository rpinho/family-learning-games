import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCast} from '../../book/plan.mjs';
test('occasional guests preserve fixed friends and do not visit every chapter',()=>{
 const cast={cast:[{id:'friend'},{id:'guest'}],children:{kid:{fixed:['friend'],rotate:[],perChapter:0,guests:[{id:'guest',every:3}]}}};
 let visits=0;
 for(let n=1;n<=30;n++){
  const out=chooseCast({player:'kid'},{date:`2026-09-${String(n).padStart(2,'0')}`,cast,level:'early'});
  assert.equal(out[0].id,'friend');visits+=out.some(c=>c.id==='guest')?1:0;
 }
 assert.equal(visits,10);
 cast.children.kid.guests=[{id:'guest',every:1},{id:'unknown',every:3}];
 assert.deepEqual(chooseCast({player:'kid'},{date:'2026-09-30',cast,level:'early'}),[{id:'friend'}]);
});
import {assemble} from '../../book/assemble.mjs';
import {templateChapter} from '../../book/template.mjs';
import {plans} from '../../book/tests/fixtures.mjs';
import {readFileSync} from 'node:fs';
test('a recorded guest speaks only its recorded words; narrator handles other text',()=>{
 const library=JSON.parse(readFileSync(new URL('../public/book-art/library.json',import.meta.url)));
 const plan=plans(['2026-03-10'])[1];plan.cast[0].recordedLines=['I have an idea.'];
 const who=plan.cast[0].id,story=templateChapter(plan,library);
 story.pages[0].say=[[who,'I have an idea.'],[who,'Try another way.']];
 const chapter=assemble(story,plan,{library});
 const lines=chapter.pages.flatMap(p=>p.say);
 assert.equal(lines.find(l=>l.text==='I have an idea.').who,who);
 assert.equal(lines.find(l=>l.text==='Try another way.').who,'narrator');
});
