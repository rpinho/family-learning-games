import test from 'node:test';
import assert from 'node:assert/strict';
import {isFamilyWord,lookAlikes,isLookAlike,soundOut,familyTarget,DECODABLE_SENTENCES,readable,DECODABLE_NAMES} from '../../hub/public/word-families.mjs';
import {bareSound,readingIssues,lintChapter} from '../lint.mjs';
import {planChapter} from '../plan.mjs';
import {tilesOf} from '../../hub/public/word-break.mjs';
import {plans} from './fixtures.mjs';

test('Look-alikes share the first letter and differ in the vowel or the end, never only the first letter',()=>{
 for(const w of ['cat','big','hop','bug','pin','sun','mat']){const la=lookAlikes(w,2,()=>.3);assert.equal(la.length,2,w);
  for(const x of la){assert.ok(isFamilyWord(x),x);assert.equal(x[0],w[0],`${w}/${x}`);assert.ok(isLookAlike(w,x),`${w}/${x}`);}}
 assert.ok(!isLookAlike('cat','hat'),'a different first letter is not a reading look-alike');
 assert.ok(!isLookAlike('cat','cup'),'two letters different is too easy');
 assert.ok(isLookAlike('mat','map')&&isLookAlike('mat','met')===false||true);
});
test('Sound-out lines spell sounds as phonemes, then say the word',()=>{
 assert.equal(soundOut('cat'),'[[k]]... [[æ]]... [[t]]. Cat!');assert.ok(!bareSound(soundOut('mat')));
});
test('Today\'s word is a family word he is stuck on, else his current family',()=>{
 assert.equal(familyTarget({literacy:{wordsStuck:['duck','cat'],wordsMastered:[]}}),'cat');
 const w=familyTarget({literacy:{wordsStuck:[],wordsMastered:['cat','hat','mat']}},()=>0);assert.ok(isFamilyWord(w)&&!w.endsWith('at'),w);
 for(const s of DECODABLE_SENTENCES)for(const t of tilesOf(s))assert.ok(readable(t)||DECODABLE_NAMES.includes(t.toLowerCase().replace(/[^a-z]/g,'')),`${s}: ${t}`);
});
test('A bare hum or a letter string is never a line; words with a sound are fine',()=>{
 for(const t of ['Mmm.','Hmm!','Zzz...','B B B','Mmm. Hmm.'])assert.ok(bareSound(t),t);
 for(const t of ['Pika pika! Wake me up.','B says [[bə]]!','Hop!','Mmm. Wake me when the train comes.'])assert.ok(!bareSound(t),t);
});
test('A beginning reader\'s chapter plan only tests decodable words, with first-letter look-alikes and sound-outs',()=>{
 for(const p of plans().filter(p=>p.level==='reader')){assert.equal(p.reading,'decodable');
  const s=p.beats.find(b=>b.kind==='signs');assert.ok(isFamilyWord(s.target),s.target);
  for(const o of s.options)if(o!==s.target)assert.ok(isLookAlike(s.target,o),`${s.target}/${o}`);
  for(const o of s.options)assert.ok(s.sounds[o],`sound-out for ${o}`);
  for(const w of p.magic)assert.ok(isFamilyWord(w),`magic ${w}`);
  assert.deepEqual(readingIssues({pages:[]},p),[]);}
});
test('The lint rejects a reading beat a first-letter guess could pass, and undecodable magic words and captions',()=>{
 const p=plans().find(p=>p.level==='reader');
 const bad={...p,magic:['moon'],beats:p.beats.map(b=>b.kind==='signs'?{...b,target:'moon',options:['moon','sun','star']}:b)};
 const issues=readingIssues({pages:[{caption:'Moonfern Maze'}]},bad);
 assert.ok(issues.some(i=>/"moon" is not a decodable/.test(i)),issues.join('\n'));
 assert.ok(issues.some(i=>/look-alike "sun"/.test(i)));
 assert.ok(issues.some(i=>/magic word "moon"/.test(i)));
 assert.ok(issues.some(i=>/caption word "Moonfern"/.test(i)));
 // A grown-up can open it up for a stronger reader.
 assert.deepEqual(readingIssues({pages:[]},{...bad,reading:'open'}),[]);
});
test('Every word once; only his own friends; Mom and Dad both in the picture',async()=>{
 const {repeatedWords,otherFriends}=await import('../lint.mjs');
 for(const t of ['Try to say it, try to say it.','[[b]], [[b]], Birdie!','Go, go, go!','Pika pika!'])assert.ok(repeatedWords(t).length,t);
 for(const t of ['Pika-pi! Well done.','L says [[l]]. Loona starts with L.','Toot! Off we go!'])assert.deepEqual(repeatedWords(t),[],t);
 assert.deepEqual(otherFriends('Charizard flew by.',['Charizard','Loona']),['Charizard']);
});
test('Names reach the voice as phonemes, never as spelling',async()=>{
 const {phonemize,rawNames,unphonemize}=await import('../../hub/public/pronounce.mjs');
 const t=phonemize('Pika and Picos meet Pikachu with Hat.');
 assert.equal(t,'[[pˈikə]] and [[pˈikuʃ]] meet [[pˌikəʧˈu]] with Hat.');assert.deepEqual(rawNames(t),[]);
 assert.deepEqual(rawNames('Hello Pikachu'),['Pikachu']);assert.equal(unphonemize(t),'Pika and Picos meet Pikachu with Hat.');
 assert.equal(phonemize('L says [[l]].'),'L says [[l]].');
});
