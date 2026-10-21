// A chapter title keeps no asides: a cover once read "Chapter 25. Pool day with a slide ( plus poolside cake)." aloud.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chapterTitle} from '../../hub/public/spoken-form.mjs';
import {planChapter} from '../plan.mjs';
import {assemble} from '../assemble.mjs';
import {young} from './fixtures.mjs';

test('asides go, a lead or subtitle after a colon stays', ()=>{
 assert.equal(chapterTitle('Halloween: Pool day with a slide (+ poolside cake)'),'Halloween: Pool day with a slide');
 assert.equal(chapterTitle('Robot line track / robot arm'),'Robot line track');
 assert.equal(chapterTitle('Nature walk (class field trip)'),'Nature walk');
 assert.equal(chapterTitle('Costumes: everyone dresses up'),'Costumes: everyone dresses up');
 assert.equal(chapterTitle('(just an aside)'),'(just an aside)');
});

test('the Book cover shows and says the clean title', async()=>{
 const library=JSON.parse(await readFile(new URL('../../hub/public/book-art/library.json',import.meta.url),'utf8'));
 const story={title:'Pool day with a slide (+ poolside cake)',pages:[{scene:'meadow',actors:['grown-up'],say:[['narrator','The pool is ready.']]}]};
 const ch=assemble(story,planChapter(young,{date:'2026-03-10'}),{library});
 assert.equal(ch.title,'Pool day with a slide');
 assert.doesNotMatch(JSON.stringify(ch.cover.line),/plus|\(/);
});
