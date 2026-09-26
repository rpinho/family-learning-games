import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {wordBreakItem,wordBreakLines,literacyFrom} from '../dist/word-break.mjs';
// The word-break module is shared; every game repo keeps an identical copy.
test('Shared word-break copy matches its siblings and every prompt is voiced',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex'),mine=hash(await readFile(new URL('../dist/word-break.mjs',import.meta.url)));
 for(const path of ['../../target-trail/dist/word-break.mjs','../../three-in-a-row/dist/word-break.mjs','../../maze-garden/public/word-break.mjs','../../word-arcade/lib/word-break.mjs','../../letter-quest/public/word-break.mjs','../../number-park/lib/word-break.mjs']){let other;try{other=await readFile(new URL(path,import.meta.url));}catch{continue;}assert.equal(hash(other),mine,path);}
 const lines=new Set(wordBreakLines());for(const track of ['letters','words'])for(let i=0;i<200;i++){const q=wordBreakItem(literacyFrom({completed:40},track));assert.ok(lines.has(q.spoken),q.spoken);}
});
