import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('Book feedback cannot fetch or start an ambient bed on any page',async()=>{
 const fetched=[],sources=[],idle=[];
 class Context{state='running';destination={};createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
  createBufferSource(){const s={loop:false,connect(){},start(){sources.push(this);}};return s;}
  async decodeAudioData(){return {duration:10};}close(){}
 }
 const ctx=vm.createContext({AudioContext:Context,requestIdleCallback:f=>idle.push(f),
  fetch:async u=>{fetched.push(u);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 const src=await readFile(new URL('../public/calm-sound.mjs',import.meta.url),'utf8');
 vm.runInContext(src.replaceAll('export ',''),ctx);
 const snd=ctx.calmSound();snd.unlock();snd.prefetch();idle.forEach(f=>f());
 for(const background of ['meadow','forest','water','night','castle','home','pond']){snd.page({page:1,background});snd.pageTurn();}
 await snd.soft();await snd.pluck();
 assert.ok(fetched.length);assert.ok(fetched.every(u=>/^\/calm\/(harp-[a-z0-9-]+|soft)\.m4a$/.test(u)));
 assert.ok(sources.every(s=>!s.loop));assert.equal((ctx.__calmLog||[]).filter(x=>x.bed).length,0);
 assert.doesNotMatch(src,/ambient-|createOscillator|loop\s*=/);
 const hunt=await readFile(new URL('../public/hunt.mjs',import.meta.url),'utf8');assert.doesNotMatch(hunt,/snd\.bed|ambient-/);
 const book=await readFile(new URL('../public/book.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(book,/snd\.bed|backgroundBed|ambient-/);
 assert.match(book,/mountPond\(el,\{ambient:false/);
});
test('Pond with ambient disabled never constructs a water element, even on later gestures',async()=>{
 const src=await readFile(new URL('../public/pond/sound.mjs',import.meta.url),'utf8');let elements=0;
 const ctx=vm.createContext({clearTimeout,Audio:class{constructor(){elements++;}},document:{hidden:false,addEventListener(){},removeEventListener(){}}});
 vm.runInContext(src.replaceAll('export ',''),ctx);const snd=ctx.calmSound(null);
 snd.start();snd.setEnabled(false);snd.setEnabled(true);snd.start();snd.destroy();assert.equal(elements,0);
});
