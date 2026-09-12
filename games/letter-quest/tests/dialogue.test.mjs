import test from 'node:test';
import assert from 'node:assert/strict';
import {DIALOGUE,createDialoguePicker,feedbackCategory,allVoiceLines} from '../public/dialogue.mjs';
import {rng,WORDS,taskPrompt} from '../public/engine.mjs';

test('Reaction bags do not repeat until exhausted, including across refills',()=>{
 const pick=createDialoguePicker(rng(42));
 for(const [category,lines] of Object.entries(DIALOGUE)){
  let previous;
  for(let cycle=0;cycle<4;cycle++){
   const observed=[];
   for(let i=0;i<lines.length;i++){
    const line=pick(category);assert.notEqual(line,previous);observed.push(line);previous=line;
   }
   assert.equal(new Set(observed).size,lines.length);
  }
 }
});
test('Feedback responds to the task, assistance and result',()=>{
 assert.equal(feedbackCategory({type:'trace',level:3},{ok:true},false),'memory');
 assert.equal(feedbackCategory({type:'trace',level:3},{ok:true},true),'assisted');
 assert.equal(feedbackCategory({type:'trace',level:0},{ok:false,reason:'direction'}),'direction');
 assert.equal(feedbackCategory({type:'find'},{ok:false}),'retry');
 assert.equal(feedbackCategory({type:'find'},{ok:true,lesson:true}),'lesson');
});
test('The voice inventory includes every reaction and all family name prompts',()=>{
 const lines=new Set(allVoiceLines());
 for(const {word} of WORDS)for(const type of ['spell','gap'])assert.ok(lines.has(taskPrompt({type,word})));
 assert.ok(lines.has(taskPrompt({type:'sequence'})));
 for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')assert.ok(lines.has(`The letter ${letter}.`));
 for(const line of Object.values(DIALOGUE).flat())assert.ok(lines.has(line));
 for(const name of ['Explorer','Beginner','Admin','Helper','Rook'])assert.ok(lines.has(`Build ${name}. Start at the left. Tap the letters in order.`));
 assert.ok(lines.has('Find little Z.'));assert.ok(lines.has('Trace 9. Start at the gold dot. Follow the arrow.'));
});
