import test from 'node:test';
import assert from 'node:assert/strict';
import {letterQuest,readerQuest,HOME_THINGS} from '../quests.mjs';
import {chooseCast} from '../plan.mjs';
test('Letter hunts come with hint pictures of things most homes have, the friend first', () => {
 const q=letterQuest('L',{sound:'lll',friend:{name:'Lulu',emoji:'🐶'}});
 assert.match(q.text,/Sound hunt: .*start with L/);assert.equal(q.hints[0].word,'Lulu');assert.ok(q.hints.length>=4);
 for(const h of q.hints.slice(1))assert.match(h.text,/starts with lll/);
 for(const [L,list] of Object.entries(HOME_THINGS))for(const [w] of list)assert.equal(w[0].toUpperCase()===L||w.includes('x'),true,`${w} for ${L}`);
});
test('Reader quests never ask for a printed word the house may not have', () => {
 for(let seed=0;seed<6;seed++){const q=readerQuest(['bed','mat','bat'],{seed});
  assert.doesNotMatch(q.text,/find the word/i);
  if(q.cards){assert.deepEqual(q.cards,['bed','mat','bat']);assert.match(q.dad,/print/i);}else{assert.match(q.text,/rhymes with/);assert.ok(q.hints.length>=2);assert.ok(q.hints.every(h=>!/\bbat\b/.test(h.word)));}}
 // No rhyme family with two findable things: word cards.
 const q=readerQuest(['said'],{seed:0});assert.deepEqual(q.cards,['said']);
});
test('Weighted rotation: favourites appear more often, fixed friends always', () => {
 const cast={cast:['a','b','c','d','e'].map(id=>({id,name:id})),children:{kid:{fixed:['a'],rotate:['b','c','d','e'],weights:{b:6,c:1,d:1,e:1},perChapter:1}}};
 const n={};for(let i=0;i<300;i++){const c=chooseCast({player:'kid'},{date:`2026-01-${String(i%28+1).padStart(2,'0')}-${i}`,cast});assert.equal(c[0].id,'a');assert.equal(c.length,2);n[c[1].id]=(n[c[1].id]||0)+1;}
 assert.ok(n.b>n.c*2&&n.b>n.d*2,JSON.stringify(n));
});
