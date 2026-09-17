import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoachAudio} from '../public/chess/audio.mjs';
function fixture(){
 const pending=[],events=[],talk=[];let created=0;
 const audio={pause(){},play(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 const player=createCoachAudio({createAudio:()=>{created++;return audio;},event:(...e)=>events.push(e),talking:v=>talk.push(v)});
 return {audio,player,pending,events,talk,created};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Stopping or replacing a pending clip does not report an audio failure or mute its replacement',async()=>{
 const f=fixture();f.player.play('/first.mp3');const oldEnd=f.audio.onended;
 f.player.play('/second.mp3');f.audio.onplaying();f.pending[0].reject(Object.assign(Error('interrupted'),{name:'AbortError'}));oldEnd();await tick();
 assert.equal(f.events.filter(e=>e[0]==='chess_voice_unavailable').length,0);assert.equal(f.talk.at(-1),true);assert.equal(f.created,1);
 f.player.stop();f.pending[1].reject(Object.assign(Error('paused'),{name:'AbortError'}));await tick();assert.equal(f.events.length,1);
});
test('Real playback failures retain exception and media source; a later tap can replay',async()=>{
 const f=fixture();f.player.play('/cue.mp3');f.pending[0].reject(Object.assign(Error('gesture required'),{name:'NotAllowedError'}));await tick();
 assert.equal(JSON.parse(f.events[0][1]).name,'NotAllowedError');assert.equal(JSON.parse(f.events[0][1]).source,'/cue.mp3');
 f.player.play('/cue.mp3');f.audio.onplaying();assert.equal(f.talk.at(-1),true);
});
test('Gesture priming reuses the same element and cannot stop a later audible clip',async()=>{
 const f=fixture();f.player.unlock();f.player.play('/cue.mp3');f.audio.onplaying();f.pending[0].resolve();await tick();assert.equal(f.talk.at(-1),true);assert.equal(f.created,1);
});
