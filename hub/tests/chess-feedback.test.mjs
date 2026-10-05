import test from 'node:test';
import assert from 'node:assert/strict';
import {createTableFeedback} from '../public/chess/feedback.mjs';

test('Table sound is lazy, respects mute and speech, and releases its context on leaving',()=>{
  let created=0,closed=0;const notes=[];
  const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const context={currentTime:0,state:'running',destination:{},
    createOscillator(){const n={frequency:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};notes.push(n);return n;},
    createGain(){return {gain:param(),connect(){},disconnect(){}};},close(){closed++;return Promise.resolve();}};
  const sound=createTableFeedback({createContext:()=>{created++;return context;}});
  sound.play({enabled:false});sound.play({speaking:true});assert.equal(created,0);
  sound.play();sound.play({solved:true});assert.equal(created,1);assert.equal(notes.length,2);
  assert.ok(notes[0].stopped);assert.equal(notes[0].type,'sine');assert.equal(notes[1].type,'triangle');
  sound.stop();assert.ok(notes[1].stopped);sound.dispose();assert.equal(closed,1);
  sound.play();assert.equal(notes.length,2);
});

test('An unavailable audio device cannot interrupt chess',()=>{
  const sound=createTableFeedback({createContext:()=>{throw Error('unavailable');}});
  assert.doesNotThrow(()=>sound.play());assert.doesNotThrow(()=>sound.dispose());
});
