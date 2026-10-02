import test from 'node:test';
import assert from 'node:assert/strict';
import {calmSound} from '../lib/calm-sound.mjs';
test('background start and enable never create or fetch ambient media and do not hook speech',()=>{
 const old={Audio:globalThis.Audio,fetch:globalThis.fetch,speechSynthesis:globalThis.speechSynthesis};
 const speak=()=>{};globalThis.speechSynthesis={speak};globalThis.Audio=class{constructor(){assert.fail('ambient media created')}};globalThis.fetch=()=>assert.fail('ambient request');
 try{const s=calmSound('/water.m4a');s.start();s.setEnabled(true);s.start();s.duck()();assert.equal(s.level(),0);assert.equal(speechSynthesis.speak,speak);s.setEnabled(false);s.start();s.destroy();s.start();}finally{Object.assign(globalThis,old)}
});
test('brief plucks remain available and respect effects mute and disposal',()=>{
 const old={AudioContext:globalThis.AudioContext,document:globalThis.document};let starts=0,closed=0;
 globalThis.document={hidden:false};globalThis.AudioContext=class{constructor(){this.currentTime=0;this.destination={}}resume(){return Promise.resolve()}close(){closed++;return Promise.resolve()}createOscillator(){return {frequency:{value:0},connect(){},start(){starts++},stop(){},disconnect(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}};
 try{const s=calmSound();s.pluck();assert.equal(starts,3);s.setEnabled(false);s.pluck();assert.equal(starts,3);s.setEnabled(true);s.pluck();assert.equal(starts,6);document.hidden=true;s.pluck();assert.equal(starts,6);s.destroy();assert.equal(closed,1);document.hidden=false;s.pluck();assert.equal(starts,6)}finally{Object.assign(globalThis,old)}
});
