import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {literacyFrom,wordBreakItem,wordBreakLines,scramble,tilesOf,SENTENCES,WORD_GROUPS,WORD_BREAK_VERSION} from '../dist/word-break.mjs';
const seq=seed=>{let a=seed;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296;};};
test('Levels follow Letter Quest progress without exposing the save',()=>{
 const beginner=literacyFrom({completed:17,skills:{'find:B':{level:3}}},'letters');
 assert.deepEqual(beginner.letters,[...'FRANCISOETL']);assert.deepEqual(beginner.lower,['f','r','a']);assert.equal(beginner.track,'letters');assert.ok(!beginner.learning.includes('B'));
 const reader=literacyFrom({completed:39,placement:{letters:['E','X']},maze:{practiceSkills:{reading:{level:2}}},reading:{skills:{sentence:{level:1}}}},'words');
 assert.equal(reader.wordLevel,2);assert.equal(reader.sentenceLevel,1);assert.ok(reader.letters.includes('X'));
 const none=literacyFrom(null,'words');assert.equal(none.source,'default');assert.equal(none.track,'words');
 assert.equal(literacyFrom({completed:'x',maze:{practiceSkills:{reading:{level:99}}}}).wordLevel,3);
});
test('Letter items stay inside the child\'s letters and use look-alikes',()=>{
 const level=literacyFrom({completed:17},'letters'),r=seq(7);
 for(let i=0;i<300;i++){const q=wordBreakItem(level,{r});assert.ok(['find-letter','first-letter'].includes(q.kind));assert.ok(q.options.includes(q.answer));assert.equal(new Set(q.options).size,q.options.length);
  assert.ok([...level.letters,...level.lower].includes(q.answer)||q.kind==='first-letter'&&level.letters.includes(q.answer));}
});
test('Sentence tiles defeat position guessing',()=>{
 const flat=SENTENCES.flat(),tiles=flat.map(tilesOf);
 const nameLast=tiles.filter(t=>/^[A-Z]/.test(t.at(-1))).length,saidPenultimate=tiles.filter(t=>['said','asked'].includes(t.at(-2))).length,multiCaps=tiles.filter(t=>t.filter(w=>/^[A-Z]/.test(w)).length>=2).length;
 assert.ok(nameLast/flat.length<.35,'names are not usually last');assert.equal(saidPenultimate,0);assert.ok(multiCaps/flat.length>.6,'most sentences have several capitalised tiles');
 assert.ok(tiles.some(t=>['said','asked'].includes(t[1])));
 const r=seq(3);for(const t of tiles)for(let k=0;k<20;k++){const s=scramble(t,r);assert.deepEqual([...s].sort(),[...t].sort());assert.notDeepEqual(s,t);assert.ok(s.filter((w,i)=>w===t[i]).length<=1);
  for(let n=1;n<t.length;n++)assert.notDeepEqual(s,[...t.slice(n),...t.slice(0,n)]);}
 const level=literacyFrom({completed:39,reading:{skills:{sentence:{level:2}}}},'words');let distractors=0;
 for(let i=0;i<200;i++){const q=wordBreakItem(level,{r});if(q.kind!=='sentence')continue;assert.ok(q.answer.every(w=>q.tiles.includes(w)));if(q.tiles.length>q.answer.length)distractors++;}
 assert.ok(distractors>0);
});
test('Every spoken prompt has a voice line',()=>{
 const lines=new Set(wordBreakLines()),r=seq(11);
 for(const track of ['letters','words','mixed'])for(let lv=1;lv<=3;lv++){const level={...literacyFrom({completed:60},track),wordLevel:lv,sentenceLevel:lv};for(let i=0;i<150;i++){const q=wordBreakItem(level,{r});assert.ok(lines.has(q.spoken),q.spoken);}}
 for(const g of WORD_GROUPS.flat())assert.equal(new Set(g).size,g.length);
});
test('Shared copy is identical in sibling game repos',async()=>{
 const mine=createHash('sha256').update(await readFile(new URL('../dist/word-break.mjs',import.meta.url))).digest('hex');
 for(const path of ['../../three-in-a-row/dist/word-break.mjs','../../maze-garden/public/word-break.mjs','../../word-arcade/lib/word-break.mjs','../../letter-quest/public/word-break.mjs','../../number-park/lib/word-break.mjs']){let other;try{other=await readFile(new URL(path,import.meta.url));}catch{continue;}
  assert.equal(createHash('sha256').update(other).digest('hex'),mine,path);}
 assert.match(WORD_BREAK_VERSION,/^word-break-/);
});
test('Sentences use the small recurring cast and no odd verbs',()=>{
 const cast=new Set(['Bo','Max','Mom','Dad','Cookie','Buddy']);
 for(const s of SENTENCES.flat()){const t=tilesOf(s);t.slice(1).filter(w=>/^[A-Z]/.test(w)).forEach(w=>assert.ok(cast.has(w),`${w} in "${s}"`));
  assert.ok(t.some(w=>cast.has(w)),`a friend appears in "${s}"`);assert.ok(!/\b(lied|lay|laid)\b/.test(s),s);
  assert.equal(new Set(t.map(w=>w.toLowerCase())).size,t.length,`no repeated tile in "${s}"`);}
 for(const s of SENTENCES[0])for(const w of tilesOf(s))assert.ok(w.length<=5,`level 1 stays short: ${w}`);
});
test('A break opens with nothing pre-selected: focus goes to the dialog',async()=>{
 const src=await readFile(new URL('../dist/word-break.mjs',import.meta.url),'utf8');
 assert.match(src,/d\.tabIndex=-1;d\.autofocus=true;.*d\.showModal\(\).*d\.focus\(/);assert.doesNotMatch(src,/\.wb-choice[^{]*\{[^}]*outline:[^n]/);
});
