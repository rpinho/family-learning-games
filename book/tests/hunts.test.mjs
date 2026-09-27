import test from 'node:test';
import assert from 'node:assert/strict';
import {nextLetters,dayHunts,THINGS} from '../hunts.mjs';
import {repeatedWords,bareSound} from '../lint.mjs';
const model={literacy:{learning:['F','R','A','m','s'],lettersMastered:['B'],letters:['F','R','A','B'],lower:['m','s']},stuck:[{area:'letters',item:'A'}]};
test('Tomorrow\'s letters: the next one he is learning, then a weak one; never today\'s; deterministic',()=>{
 const [a,b]=nextLetters(model,{today:['F'],date:'2026-09-28'});assert.notEqual(a,'F');assert.notEqual(a,b);assert.ok(['R','A'].includes(a));
 assert.deepEqual(nextLetters(model,{today:['F'],date:'2026-09-28'}),nextLetters(model,{today:['F'],date:'2026-09-28'}));
 const [l]=nextLetters(model,{lower:true,date:'x'});assert.equal(l,l.toLowerCase());
});
test('Three hunts a day, every line clean: one letter sound each, no word twice in a row, hints that start with the sound',()=>{
 const who={greet:'Ahoy, Diogo!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1.05},lower:false};
 const hs=dayHunts(model,{date:'2026-09-28',today:['M'],interests:['soccer','robots'],who});assert.equal(hs.length,3);
 for(const h of hs){for(const l of [h.intro,h.goal.line,h.done,...h.hints.map(x=>x.line)]){assert.deepEqual(repeatedWords(l.text),[],l.text);assert.ok(!bareSound(l.text));
   assert.ok(!/\[\[(lll|mmm|sss|bə|[a-zæɛɪɑʌɹ]{3,})\]\]/.test(l.text),l.text);}
  if(h.kind==='sound')for(const x of h.hints)assert.ok(THINGS[h.letter.toLowerCase()].some(([w])=>w===x.word));}
});

test('every letter, both boys: no word said twice in a row, a/an right', async()=>{
 const {dayHunts,THINGS}=await import('../hunts.mjs');const {repeatedWords}=await import('../lint.mjs');
 const whos=[{greet:'Ahoy, Diogo!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1},lower:false},{greet:'Pika-pi! Conductor!',cheer:'Pika!',voice:{voice:'am_adam',speed:1},lower:true}];
 for(const who of whos)for(const k of Object.keys(THINGS).filter(k=>!'xq'.includes(k))){const L=who.lower?k:k.toUpperCase();
  const hs=dayHunts({literacy:{learning:[L]}},{date:'2026-09-28',who});
  for(const h of hs)for(const l of [h.intro,h.goal.line,h.done,...h.hints.map(x=>x.line)]){
   assert.deepEqual(repeatedWords(l.text),[],`${L}: ${l.text}`);assert.doesNotMatch(l.text,/\ba [aeiou]/i,`${L}: ${l.text}`);}}
});
