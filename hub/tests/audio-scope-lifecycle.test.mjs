import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/audio-scope.mjs',import.meta.url),'utf8');
function setup(contexts){
 const handlers=new Map(),events=[],stops=[];
 class Source{
  constructor(context){this.context=context;}
  start(){}
  stop(){stops.push(this.context);}
  disconnect(){}
  addEventListener(){}
 }
 const env=vm.createContext({document:{hidden:false,addEventListener:(name,fn)=>handlers.set(name,fn)},AudioBufferSourceNode:Source,setTimeout,Event,Promise,addEventListener(){},dispatchEvent:e=>events.push(e.type)});
 vm.runInContext(source,env);
 for(const c of contexts)new Source(c).start();
 return {stop:env.familyAudio.stop,env,events,stops,gesture:()=>handlers.get('pointerdown')()};
}
test('Repeated navigation skips already-closed contexts while still stopping active audio',async()=>{
 let calls=0;const closed={state:'closed',suspend(){throw Error('closed context must not be suspended');}},live={state:'running',suspend(){calls++;return Promise.resolve();}};
 const rig=setup([closed,live]);rig.stop();rig.stop();await new Promise(r=>setImmediate(r));
 assert.equal(calls,2);assert.equal(rig.stops.length,2);assert.equal(rig.env.familyAudio.blocked,true);assert.deepEqual(rig.events,['family-audio-stop','family-audio-stop']);
 rig.gesture();assert.equal(rig.env.familyAudio.blocked,false);
});
test('A context closed between the state check and suspend has its rejected promise consumed',async()=>{
 let calls=0;const c={state:'running',suspend(){calls++;this.state='closed';return Promise.reject(new Error('Cannot suspend a closed AudioContext'));}};
 const rig=setup([c]);rig.stop();await new Promise(r=>setImmediate(r));rig.stop();await new Promise(r=>setImmediate(r));
 assert.equal(calls,1);assert.equal(rig.env.familyAudio.epoch,2);assert.equal(rig.stops.length,1);
});
test('Synchronous suspension errors cannot interrupt the navigation barrier',()=>{
 const rig=setup([{state:'running',suspend(){throw Error('unavailable');}}]);
 assert.doesNotThrow(rig.stop);assert.equal(rig.env.familyAudio.blocked,true);assert.deepEqual(rig.events,['family-audio-stop']);
});
