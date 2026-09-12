import test from 'node:test';
import assert from 'node:assert/strict';
import {CoachVoice} from '../public/voice.mjs';
import {mazeTapLine,mazeLearning,mazeLearningLines} from '../public/maze-learning.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Maze taps say the chosen letter before the word association, and navigation cancels stale speech',async t=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 const player=Object.assign(new EventTarget(),{dataset:{},played:[],ended:false,pause(){},removeAttribute(){},load(){},async play(){this.ended=false;this.played.push(this.src);}});
 globalThis.document={createElement:()=>player,body:{append(){}}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:{'Letter B.':'b.wav','Letter B starts bus.':'bus.wav'}})});
 t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});const voice=new CoachVoice();t.after(()=>voice.stop());
 const q={type:'gap',word:'bus',blank:0,answer:'b'},learning=mazeLearning(q);
 assert.equal(learning.line,'Letter B starts bus.');assert.equal(mazeTapLine('b'),'Letter B.');assert.equal(mazeTapLine('bus'),'The word is bus.');
 assert.ok(mazeLearningLines([{word:'bus'}]).includes('Letter U is in bus.'));
 const tap=voice.letter(mazeTapLine('b')),follow=voice.enqueue(learning.line);await tick();assert.deepEqual(player.played,['b.wav']);
 player.dispatchEvent(new Event('ended'));await tick();assert.deepEqual(player.played,['b.wav','bus.wav']);
 voice.stop();await Promise.all([tap,follow]);assert.equal(voice.mode,null);
});
test('Rapid name taps queue all letters before praise; navigation cancels remaining audio',async t=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 class Player extends EventTarget{constructor(){super();this.dataset={};this.played=[];this.ended=false;}pause(){}removeAttribute(){}load(){}async play(){this.ended=false;this.played.push(this.src);}}
 const player=new Player();globalThis.document={createElement:()=>player,body:{append(){}}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:{A:'a.wav',B:'b.wav',praise:'praise.wav'}})});
 t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});
 const voice=new CoachVoice();t.after(()=>voice.stop());
 const a=voice.enqueue('A'),b=voice.enqueue('B'),praise=voice.enqueue('praise');
 await tick();assert.deepEqual(player.played,['a.wav']);
 player.dispatchEvent(new Event('ended'));await tick();assert.deepEqual(player.played,['a.wav','b.wav']);
 player.dispatchEvent(new Event('ended'));await tick();assert.deepEqual(player.played,['a.wav','b.wav','praise.wav']);
 player.dispatchEvent(new Event('ended'));await Promise.all([a,b,praise]);
 const canceled=[voice.enqueue('A'),voice.enqueue('B')];await tick();voice.stop();await Promise.all(canceled);
 assert.deepEqual(player.played,['a.wav','b.wav','praise.wav','a.wav']);
});
test('A tab refreshes its voice manifest when a deployment adds a new clip',async t=>{
 const oldDocument=globalThis.document,oldFetch=globalThis.fetch;
 const player=Object.assign(new EventTarget(),{dataset:{},pause(){},removeAttribute(){},load(){},async play(){this.played=this.src;}});
 globalThis.document={createElement:()=>player,body:{append(){}}};let requests=0;
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:++requests===1?{}:{newLine:'new.wav'}})});
 t.after(()=>{globalThis.document=oldDocument;globalThis.fetch=oldFetch;});
 const voice=new CoachVoice();await voice.speak('newLine');assert.equal(player.played,'new.wav');assert.equal(requests,2);voice.stop();
});
