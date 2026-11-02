import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SETS} from '../public/word-blocks/content.mjs';
import {FAMILIES} from '../public/word-families.mjs';
const cvcWords=new Set([...Object.values(FAMILIES).flat(),...SETS.flatMap(s=>s.words)]);
import {neighbours,wordChoices,spellingOrder,sentenceChoices,freshBlocks,blocksAct,LOOK_MS,RUN_LENGTH} from '../public/word-blocks/model.mjs';
import {PICTURE_WORDS,SENTENCES,COIN_POOLS} from '../public/word-blocks/content.mjs';
import {picture,scenePicture} from '../public/word-blocks/art.mjs';
const known=['sun','fox','top','cup'],allowed=new Set([...cvcWords,'the','a','was']);
const context={known,practice:{words:{}},words:spellingOrder({},known),sentences:SENTENCES,allowed};
const solve=(p,now=LOOK_MS)=>{const s=p.current;for(let i=0;i<3;i++)while(s.values[i]!==s.answers[0][i])blocksAct(p,{type:'turn',index:i,direction:1},{...context,now});return blocksAct(p,{type:'press'},{...context,now});};
test('picture words are reviewed source vocabulary; teaching order starts with secure words then the authored sets',()=>{
 assert.equal(PICTURE_WORDS.length,47);assert.equal(new Set(PICTURE_WORDS).size,47);
 for(const word of PICTURE_WORDS){assert.ok(cvcWords.has(word),word);assert.match(picture(word),/^<svg/);assert.doesNotMatch(picture(word),/<image|href=|http.*(?:png|jpg)/);}
 assert.deepEqual(spellingOrder({},known).slice(0,8),['sun','fox','top','cup','mat','pan','man','map']);
});
test('every offered letter makes a real one-letter neighbour, with four faces maximum and b/d separated at the start',()=>{
 for(const word of cvcWords)for(let i=0;i<3;i++){
  const letters=neighbours(word,i);assert.ok(letters.length<=4);assert.equal(new Set(letters).size,letters.length);
  for(const letter of letters){const w=[...word];w[i]=letter;assert.ok(cvcWords.has(w.join('')),word+': '+w.join(''));}
  if(i===0)assert.ok(!(letters.includes('b')&&letters.includes('d')));
 }
});
test('cube steps are first letter, vowel, two, then all three, with other cubes fixed',()=>{
 for(let step=0;step<4;step++)assert.deepEqual(wordChoices('pin',step).map((a,i)=>a.length>1?i:-1).filter(i=>i>=0),[[0],[1],[0,1],[0,1,2]][step]);
 assert.equal(wordChoices('sun',1),null,'skip a word without a real vowel neighbour');
});
test('first right press and at least 2.5 server seconds are both required; spinning is allowed but repeated presses cannot count',()=>{
 for(const elapsed of [0,LOOK_MS-1,LOOK_MS]){
  const p=freshBlocks();blocksAct(p,{type:'start',activity:'spelling'},{...context,now:0});const r=solve(p,elapsed);assert.equal(r.counted,elapsed>=LOOK_MS);assert.equal(r.firstPressRight,true);
 }
 const p=freshBlocks();blocksAct(p,{type:'start',activity:'spelling'},{...context,now:0});let r=blocksAct(p,{type:'press'},{...context,now:LOOK_MS});assert.equal(r.right,false);assert.equal(r.firstPressRight,false);assert.equal(p.current.phase,'play');
 r=solve(p,10000);assert.equal(r.right,true);assert.equal(r.counted,false);assert.equal(r.firstPressRight,false);assert.equal(p.progress.spelling.review[0].id,'sun');
 assert.equal(p.words.sun.careful,0);assert.equal('words' in p.progress.spelling,false);
 assert.throws(()=>blocksAct(p,{type:'press'},{...context,now:20000}));
});
test('six pictures finish by action count, guessed words return after two intervening pictures, step changes only at a completed run',()=>{
 const p=freshBlocks();let now=0;blocksAct(p,{type:'start',activity:'spelling'},{...context,now});solve(p,1);blocksAct(p,{type:'next'},{...context,now:now+=4000});
 assert.equal(p.current.id,'fox');solve(p,now+LOOK_MS);blocksAct(p,{type:'next'},{...context,now:now+=4000});assert.equal(p.current.id,'top');solve(p,now+LOOK_MS);blocksAct(p,{type:'next'},{...context,now:now+=4000});assert.equal(p.current.id,'sun');
 for(let round=3;round<RUN_LENGTH;round++){solve(p,now+LOOK_MS);assert.equal(p.progress.spelling.step,0);blocksAct(p,{type:'next'},{...context,now:now+=4000});}
 assert.equal(p.current.phase,'finish');assert.equal(p.progress.spelling.step,1);
 const q=freshBlocks();blocksAct(q,{type:'start',activity:'spelling'},{...context,now:0});assert.throws(()=>blocksAct(q,{type:'next'},{...context,now:999999}));assert.equal(q.progress.spelling.step,0);
});
test('structured groups stay on one set and only advance after all cube steps',()=>{
 const p=freshBlocks();p.progress.spelling.group=1;
 for(let step=0;step<4;step++){
  blocksAct(p,{type:'start',activity:'spelling'},{...context,now:0});
  for(let n=0;n<6;n++){assert.ok(SETS[0].words.includes(p.current.id));solve(p,(n+1)*4000);blocksAct(p,{type:'next'},{...context,now:(n+1)*4000});}
  assert.equal(p.progress.spelling.step,(step+1)%4);
 }
 assert.equal(p.progress.spelling.group,2);
});
test('sentence steps turn subject, then action/object, then article/linking word, and unmet sight words cannot appear',()=>{
 for(const row of SENTENCES)for(let step=0;step<3;step++){
  const choices=sentenceChoices(row,step,allowed);assert.equal(choices.filter(c=>c.length>1).length,step+1);
 }
 assert.equal(sentenceChoices(SENTENCES[0],0,new Set(cvcWords)),null);
 const row=SENTENCES.find(s=>s.id==='cat-wet');assert.deepEqual(sentenceChoices(row,0,allowed).map(a=>a.length),[3,1,1]);
});
test('reload preserves first-press history, faces, progress, and paused activities; returning to shelf cannot reset a guess',()=>{
 let p=freshBlocks();blocksAct(p,{type:'start',activity:'spelling'},{...context,now:0});blocksAct(p,{type:'press'},{...context,now:4000});
 p=JSON.parse(JSON.stringify(p));const saved=structuredClone(p.current);blocksAct(p,{type:'start',activity:'coins'},{...context,now:5000,random:()=>.3});blocksAct(p,{type:'start',activity:'spelling'},{...context,now:6000});assert.deepEqual(p.current,saved);assert.equal(solve(p,9000).counted,false);
});
test('coins begin with teens, advance only after two complete boards, keep resume state and stop a visit after eighteen pair turns',()=>{
 const p=freshBlocks();let now=0;
 for(let run=0;run<4;run++){
  blocksAct(p,{type:'start',activity:'coins'},{...context,now,random:()=>.4,compact:run===0});const s=p.current;assert.equal(s.cards.length,run===0?8:12);for(const c of s.cards)assert.ok(COIN_POOLS[Math.floor(run/2)].includes(c.n));
  const copy=JSON.parse(JSON.stringify(p));assert.deepEqual(copy,p);
  for(const n of new Set(s.cards.map(c=>c.n)))for(const [i,c]of s.cards.entries())if(c.n===n)blocksAct(p,{type:'flip',index:i},{now:now+=1000});
  assert.equal(s.phase,'finish');assert.equal(p.progress.coins.step,Math.min(2,Math.floor((run+1)/2)));
 }
 const q=freshBlocks();blocksAct(q,{type:'start',activity:'coins'},{...context,now:0,random:()=>.3});
 const s=q.current,i=0,j=s.cards.findIndex(c=>c.n!==s.cards[i].n);
 for(let n=0;n<18;n++){blocksAct(q,{type:'flip',index:i},{now:now+=1000});const r=blocksAct(q,{type:'flip',index:j},{now:now+=1000});assert.equal(r.spoken,undefined);if(n<17)blocksAct(q,{type:'hide'},{now:now+=1000});}
 assert.equal(s.phase,'finish');assert.equal(q.progress.coins.runs,0);
});
test('a secure review word without a vowel neighbour yields to the first structured group rather than getting stuck',()=>{
 const p=freshBlocks(),ctx={...context,known:['fox'],words:spellingOrder({},['fox'])};p.progress.spelling.step=1;
 blocksAct(p,{type:'start',activity:'spelling'},{...ctx,now:0});assert.equal(p.progress.spelling.group,1);assert.equal(p.progress.spelling.step,0);assert.equal(p.current.id,'mat');
});