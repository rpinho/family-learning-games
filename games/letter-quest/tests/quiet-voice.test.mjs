import test from 'node:test';
import assert from 'node:assert/strict';
import {CoachVoice,briefLine} from '../public/voice.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(t){
 const original={document:globalThis.document,fetch:globalThis.fetch};
 class Player extends EventTarget{constructor(){super();this.dataset={};this.played=[];this.ended=false;}pause(){}removeAttribute(){}load(){}async play(){this.ended=false;this.played.push(this.src);}}
 const player=new Player(),events=[];
 globalThis.document={createElement:()=>player,body:{append(){}}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:{A:'a',B:'b',C:'c',D:'d',prompt:'prompt',newPrompt:'new',help:'help','Nice!':'nice','Got it!':'got','Try again.':'retry'}})});
 const voice=new CoachVoice(()=>{},(kind,detail)=>events.push({kind,...detail}));
 t.after(()=>{voice.stop();globalThis.document=original.document;globalThis.fetch=original.fetch;});
 return {voice,player,events};
}
test('Automatic feedback never cuts off clues and waits for quiet space',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:1000});
 const {voice,player,events}=harness(t);
 voice.instruction('prompt');t.mock.timers.tick(250);await tick();
 await voice.feedback();assert.deepEqual(player.played,['prompt']);
 player.dispatchEvent(new Event('ended'));await voice.feedback();assert.deepEqual(player.played,['prompt']);
 t.mock.timers.tick(3001);await voice.feedback();assert.deepEqual(player.played,['prompt','nice']);
 player.dispatchEvent(new Event('ended'));t.mock.timers.tick(4000);await voice.feedback();assert.equal(player.played.length,2);
 t.mock.timers.tick(11001);await voice.feedback();assert.equal(player.played.at(-1),'got');
 assert.ok(events.some(e=>e.reason==='breathing_room'));
});
test('New questions replace scheduled speech; familiar directions stay quiet, manual repeat always works',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:1000});
 const {voice,player}=harness(t);
 voice.instruction('prompt');voice.instruction('newPrompt');
 t.mock.timers.tick(251);await tick();assert.deepEqual(player.played,['new']);
 player.dispatchEvent(new Event('ended'));
 voice.instruction('prompt',{key:'reading',essential:false});t.mock.timers.tick(251);await tick();player.dispatchEvent(new Event('ended'));
 voice.instruction('prompt',{key:'reading',essential:false});t.mock.timers.tick(251);await tick();assert.deepEqual(player.played,['new','prompt']);
 await voice.speak('prompt');assert.equal(player.played.length,3);
 voice.instruction('newPrompt');voice.stop();t.mock.timers.tick(251);await tick();assert.equal(player.played.length,3);
});
test('Rapid letter taps finish the current name and keep only the newest pending letter',async t=>{
 const {voice,player,events}=harness(t);
 const a=voice.letter('A');await tick();
 const b=voice.letter('B'),c=voice.letter('C'),d=voice.letter('D');await tick();
 assert.deepEqual(player.played,['a']);player.dispatchEvent(new Event('ended'));await tick();
 assert.deepEqual(player.played,['a','d']);assert.ok(events.some(e=>e.reason==='superseded_letter'));
 player.dispatchEvent(new Event('ended'));await Promise.all([a,b,c,d]);
 const next=voice.letter('A');await tick();const canceled=voice.letter('B');voice.stop();await Promise.all([next,canceled]);assert.equal(player.played.at(-1),'a');
});
test('Slower letter taps all speak, and delayed manifests cannot resurrect canceled audio',async t=>{
 const {voice,player}=harness(t);
 for(const letter of ['A','B','C']){const done=voice.letter(letter);await tick();player.dispatchEvent(new Event('ended'));await done;}
 assert.deepEqual(player.played,['a','b','c']);
 let finish;voice.ready=new Promise(resolve=>finish=resolve);const pending=voice.speak('prompt');voice.stop();finish({voice:'test',clips:{prompt:'prompt'}});await pending;
 assert.deepEqual(player.played,['a','b','c']);
 assert.equal(briefLine('Build cat. Tap the letters in order.'),'Build cat.');
});
