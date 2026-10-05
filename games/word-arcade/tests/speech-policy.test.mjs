import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {CoachVoice} from '../lib/voice.mjs';
// Content (the target word/sentence) always plays and repeats when idle; how-to prompts once per session; praise obeys coach chat.
const ui=await readFile(new URL('../app/Arcade.jsx',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Word-break content passes essential through; how-to prompts are once per session',()=>{
 assert.ok(ui.includes("speak:(line,essential)=>{if(soundRef.current||essential)return voice.current?.speakToEnd(line,essential);}"));
 assert.ok(ui.includes('if(!content&&!onceThisSession(`word-arcade:${next.game}:how`))return;'));
 assert.ok(ui.includes('{key:next.game,essential:content}'));assert.ok(!ui.includes('essential:first'));
 assert.ok(ui.includes('if(content)askAgain(next.id,shortPrompt(next));'));assert.ok(ui.includes('left:IDLE_REPEATS'));
 assert.ok(ui.includes('void say(`Yes! ${old.session.q.word}.`);'),'builder praise follows coach chat');
});
test('An essential line blocked by autoplay plays on the next touch; praise does not',async t=>{
 const original={document:globalThis.document,fetch:globalThis.fetch},listeners={};
 class Player extends EventTarget{constructor(){super();this.dataset={};this.played=[];this.block=true;}pause(){}removeAttribute(){}load(){}async play(){if(this.block){const e=Error('blocked');e.name='NotAllowedError';throw e;}this.played.push(this.src);}}
 const player=new Player();
 globalThis.document={createElement:()=>player,body:{append(){}},addEventListener:(n,f)=>{(listeners[n]??=[]).push(f);},removeEventListener:(n,f)=>{listeners[n]=(listeners[n]||[]).filter(x=>x!==f);}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:{word:'w','Nice!':'nice'}})});
 const voice=new CoachVoice(()=>{},()=>{});t.after(()=>{voice.stop();globalThis.document=original.document;globalThis.fetch=original.fetch;});
 await voice.speak('Nice!');assert.equal(listeners.pointerup?.length||0,0);
 await voice.speak('word',true);assert.equal(listeners.pointerup.length,1);
 player.block=false;listeners.pointerup[0]();await tick();await tick();
 assert.deepEqual(player.played,['w']);assert.equal(listeners.pointerup.length,0);assert.equal(listeners.click.length,0);
});
test('Word-break speech keeps the audio-finished contract in both Arcade and Slalom',async t=>{
 const slalom=await readFile(new URL('../app/SlalomApp.jsx',import.meta.url),'utf8');
 assert.ok(slalom.includes("speak:(line,essential)=>{if(soundRef.current||essential)return voice.current?.speakToEnd(line,essential);}"));
 const original={document:globalThis.document,fetch:globalThis.fetch},listeners={};
 class Player extends EventTarget{constructor(){super();this.dataset={};this.played=[];this.block=false;this.ended=false;}pause(){}removeAttribute(){}load(){}async play(){if(this.block){const e=Error('blocked');e.name='NotAllowedError';throw e;}this.ended=false;this.played.push(this.src);}}
 const player=new Player();
 globalThis.document={createElement:()=>player,body:{append(){}},addEventListener:(n,f)=>{(listeners[n]??=[]).push(f);},removeEventListener:(n,f)=>{listeners[n]=(listeners[n]||[]).filter(x=>x!==f);}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({voice:'test',clips:{word:'w','Yes!':'yes'}})});
 const voice=new CoachVoice(()=>{},()=>{});t.after(()=>{voice.stop();globalThis.document=original.document;globalThis.fetch=original.fetch;});
 let s=null;const p=voice.speakToEnd('word',true).then(v=>s=v);await tick();await tick();assert.equal(s,null,'still playing');
 player.ended=true;player.dispatchEvent(new Event('ended'));await p;assert.equal(s,'ended');
 player.ended=false;s=null;const q=voice.speakToEnd('Yes!').then(v=>s=v);await tick();await tick();voice.stop();player.dispatchEvent(new Event('pause'));await q;assert.equal(s,'stopped');
 // Blocked before the first touch: the question settles only after the retried clip finishes.
 player.block=true;s=null;const r=voice.speakToEnd('word',true).then(v=>s=v);await tick();await tick();assert.equal(s,null);
 player.block=false;listeners.pointerup[0]();await tick();await tick();assert.equal(s,null,'retried clip is playing');
 player.ended=true;player.dispatchEvent(new Event('ended'));await r;assert.equal(s,'ended');
 player.block=true;assert.equal(await voice.speakToEnd('Yes!'),'failed','blocked praise is not retried');
});
