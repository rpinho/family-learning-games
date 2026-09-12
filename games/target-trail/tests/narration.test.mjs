import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('Controls speak once per player session; manual replay and literacy targets still speak',async()=>{
 const source=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');const funcs=source.split('\n').filter(x=>/^let controlsIntroSpoken=|^function announceControls\(|^function announce\(/.test(x)).join('\n');assert(funcs.includes('function announceControls'));
 const stored=new Map(),said=[],node={};let cue=null;
 const make=()=>{const s={player:'admin',sound:true,WORDS:{start:'Controls'},sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},$:()=>node,currentChallenge:()=>cue,speak:line=>said.push(line),log:()=>{}};vm.createContext(s);vm.runInContext(funcs+'\nglobalThis.run=announce;',s);return s;};
 const a=make();for(let i=0;i<25;i++)a.run();assert.deepEqual(said,['Controls']);a.run(true);assert.equal(said.length,2);
 const b=make();b.run();assert.equal(said.length,2);cue={kind:'letter',cue:'Find A'};b.run();b.run();assert.deepEqual(said.slice(-2),['Find A','Find A']);
 cue=null;b.player='explorer';b.sound=false;b.run();assert.equal(said.length,4);b.sound=true;b.run();assert.equal(said.length,5);
});
