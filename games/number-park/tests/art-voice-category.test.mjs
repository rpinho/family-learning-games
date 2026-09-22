import test from 'node:test';
import assert from 'node:assert/strict';
import {PICTURE_LABELS} from '../lib/doodle.mjs';
import {guessLine,guessVoiceLines,labelVoiceLines,labelName,validArtLabel} from '../lib/symbol-recognition.mjs';
import {artVoiceLines} from '../lib/art.mjs';

test('Picture guesses and corrections keep picture language and cached audio',()=>{
 const cache=new Set(artVoiceLines());
 for(const picture of PICTURE_LABELS){
  assert(validArtLabel(picture));assert.equal(labelName(picture),picture);
  const cue=picture==='two people'?'Are they two people?':`Is it a ${picture}?`;
  assert.equal(guessLine(picture),cue);assert.deepEqual(guessVoiceLines(picture),[cue]);
  assert.deepEqual(labelVoiceLines(picture),['Thanks for telling me!']);
  assert(cache.has(cue),`cached picture cue: ${picture}`);
 }
});

test('Printed words with picture names still receive word narration',()=>{
 for(const word of ['TRIANGLE','SUN','PERSON']){
  assert.equal(labelName(word),'Word '+word[0]+word.slice(1).toLowerCase());
  assert.match(guessLine(word),/^Does it say /);
  assert.deepEqual(guessVoiceLines(word),['I see the word.',...[...word].map(c=>`Letter ${c}.`)]);
  assert.deepEqual(labelVoiceLines(word),['You wrote a word.',...[...word].map(c=>`Letter ${c}.`)]);
 }
 assert.deepEqual(guessVoiceLines('1044'),['I see the number.','1','0','4','4']);
 assert.deepEqual(guessVoiceLines('K'),['Is it the letter K?']);
});
