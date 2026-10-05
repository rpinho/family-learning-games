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
test('Four hunts, three letters a day, every line clean: one letter sound each, no word twice in a row, hints that start with the sound',()=>{
 const who={greet:'Ahoy, Beginner!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1.05},lower:false};
 const hs=dayHunts(model,{date:'2026-09-28',today:['M'],interests:['soccer','robots'],who});assert.equal(hs.length,4);assert.equal(new Set(hs.map(h=>h.letter)).size,3);
 for(const h of hs){for(const l of [h.intro,h.goal.line,h.done,...h.hints.map(x=>x.line)]){assert.deepEqual(repeatedWords(l.text),[],l.text);assert.ok(!bareSound(l.text));
   assert.ok(!/\[\[(lll|mmm|sss|bə|[a-zæɛɪɑʌɹ]{3,})\]\]/.test(l.text),l.text);}
  if(h.kind==='sound')for(const x of h.hints)assert.ok(THINGS[h.letter.toLowerCase()].some(([w])=>w===x.word));}
});

test('every letter, both boys: no word said twice in a row, a/an right', async()=>{
 const {dayHunts,THINGS}=await import('../hunts.mjs');const {repeatedWords}=await import('../lint.mjs');
 const whos=[{greet:'Ahoy, Beginner!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1},lower:false},{greet:'Pip-pi! Explorer!',cheer:'Pip!',voice:{voice:'am_adam',speed:1},lower:true}];
 for(const who of whos)for(const k of Object.keys(THINGS).filter(k=>!'xq'.includes(k))){const L=who.lower?k:k.toUpperCase();
  const hs=dayHunts({literacy:{learning:[L]}},{date:'2026-09-28',who});
  for(const h of hs)for(const l of [h.intro,h.goal.line,h.done,...h.hints.map(x=>x.line)]){
   assert.deepEqual(repeatedWords(l.text),[],`${L}: ${l.text}`);assert.doesNotMatch(l.text,/\ba [aeiou]/i,`${L}: ${l.text}`);}}
});

test('an older hunts file is migrated: legacy word hunts kept, friend from the child\'s cast, labels per mode', async()=>{
 const {migrate}=await import('../hunts.mjs');
 const cast={children:{explorer:{fixed:['pip']}},cast:[{id:'pip',name:'Pip',voice:'am_adam',speed:0.88}]};
 const cfg={label:'Word hunt',friend:{id:'rainbow-hedgehog',name:'Picos'},tomorrow:{text:'Bye!',voice:'af_bella',speed:1,clip:'x.wav'},
  hunts:[{id:'cat-rhymes',kind:'sound'},{id:'M-sound',letter:'M'}]};
 migrate(cfg,'explorer',{cast});
 assert.equal(cfg.hunts[0].mode,'word');assert.equal(cfg.hunts[1].mode,undefined);
 assert.equal(cfg.friend.name,'Pip');assert.equal(cfg.tomorrow.voice,'am_adam');assert.equal(cfg.tomorrow.clip,undefined);
 assert.equal(cfg.byMode.letter.label,'Letter hunt');
 const again=JSON.stringify(cfg);migrate(cfg,'explorer',{cast});assert.equal(JSON.stringify(cfg),again);
});

test('hunt letters always have a shared recorded sound', async()=>{
 const {nextLetters}=await import('../hunts.mjs');const {hasSound}=await import('../../hub/public/word-families.mjs');
 const m={literacy:{learning:['L','W','J','Z','F'],letters:['L','V','Y','R']},stuck:[{area:'letters',item:'L'}]};
 const [a,b]=nextLetters(m,{date:'2026-09-28'});assert.ok(hasSound(a)&&hasSound(b),`${a} ${b}`);
});

test('the day\'s book letter leads the hunts (one letter for the day)', ()=>{
 const m={literacy:{learning:['F','R'],letters:['F','R','B']}};
 const who={greet:'Ahoy!',cheer:'Ahoy!',voice:{voice:'bm_fable',speed:1},lower:false};
 const hs=dayHunts(m,{date:'2026-09-29',today:['B','F'],who,book:'B'});
 assert.equal(hs[0].letter,'B');assert.equal(hs[1].letter,'B');assert.notEqual(hs[2].letter,'B');
 assert.equal(dayHunts(m,{date:'2026-09-29',who})[0].letter!=null,true);
});
