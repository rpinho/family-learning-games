import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sentence,placeName,goTo} from '../../hub/public/spoken-form.mjs';
import {episodeLines} from '../episodes/generate.mjs';

test('a goal becomes a sentence; a title becomes a place to go', ()=>{
 assert.equal(sentence('Share the lights'),'Share the lights.');
 for(const t of ['Find it!','Done.','Ready?','Tap "go."'])assert.equal(sentence(t),t);
 assert.equal(placeName('Toy shop (the big one)'),'Toy shop');
 assert.equal(placeName('Pool with a slide (+ cake)'),'Pool with a slide');
 assert.equal(placeName('Robot track / robot arm'),'Robot track');
 assert.equal(placeName('Costumes: everyone dresses up'),'Costumes');
 assert.equal(goTo('The Pitch'),'Go to the Pitch.');
 assert.equal(goTo('library tower'),'Go to the library tower.');
 assert.equal(goTo('toy workshop (upstairs)'),'Go to the toy workshop.');
});

test('every "what next" line is its own sentence before "Go to", and never says "the The"', async()=>{
 for(const level of ['reader','early']){
  const ep=JSON.parse(await readFile(new URL('../episodes/fixtures/'+level+'.json',import.meta.url),'utf8'));
  // A goal written without a full stop, in a room whose name starts with "The".
  const g=ep.puzzles.find(p=>p.goal);g.goal=g.goal.replace(/[.!?]+$/,'');ep.rooms.find(r=>r.id===g.room).name='The Meadow';
  const lines=episodeLines(ep),next=Object.entries(lines).filter(([k])=>k.startsWith('next-')&&k!=='next-done');assert.ok(next.length);
  for(const [k,l] of next)assert.doesNotMatch(l.text,/[A-Za-z0-9] Go to |the The/,`${k}: ${l.text}`);
  assert.ok(next.some(([,l])=>/\. Go to the Meadow\.$/.test(l.text)));}
});
