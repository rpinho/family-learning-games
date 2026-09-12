import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ArcadeAudio,TRACKS,LASERS,audioPreferences} from '../lib/arcade-audio.mjs';
import {AUDIO_FILES,PRIVATE_AUDIO_FILES,audioRange} from '../lib/audio-files.mjs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const tick=()=>new Promise(r=>setImmediate(r));
test('Correct answers get a distinct three-note chime, independent of music; effects mute is respected',async t=>{
 const h=harness(t);await h.audio.unlock();h.audio.feedback(true);
 assert.equal(h.oscillators.length,3);assert.ok(h.events.some(e=>e.name==='answer_chime'&&e.ok));
 h.audio.configure({...h.audio.prefs,effects:false});h.audio.feedback(true);assert.equal(h.oscillators.length,3);
});
function harness(t,{state='running',resumeError=false,fetchError=false}={}){
  const events=[],params=[],samples=[],oscillators=[],fetches=[];
  const param=()=>({setValueAtTime(...a){params.push(['set',...a]);},exponentialRampToValueAtTime(...a){params.push(['ramp',...a]);},setTargetAtTime(...a){params.push(['target',...a]);}});
  const source=()=>({connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}});
  class Player extends EventTarget{
    constructor(){super();this.paused=true;this.played=[];this.currentTime=0;}
    async play(){this.paused=false;this.played.push(this.src);this.dispatchEvent(new Event('playing'));}
    pause(){this.paused=true;} load(){} removeAttribute(){this.src='';}remove(){}
  }
  const player=new Player();
  const ctx={state,currentTime:0,destination:{},createGain(){return {gain:param(),connect(){},disconnect(){}};},createMediaElementSource:source,createBufferSource(){const s=source();samples.push(s);return s;},createOscillator(){const o={...source(),frequency:param()};oscillators.push(o);return o;},async decodeAudioData(){return {duration:0.3};},async resume(){if(resumeError)throw Error('Audio blocked');this.state='running';},async close(){this.state='closed';}};
  let created=0;const audio=new ArcadeAudio({createContext:()=>{created++;return ctx;},createPlayer:()=>player,fetchAudio:async file=>{fetches.push(file);return {ok:!fetchError,arrayBuffer:async()=>new ArrayBuffer(8)};},record:(name,detail)=>events.push({name,...detail})});
  t.after(()=>audio.dispose());return {audio,ctx,player,events,params,samples,oscillators,fetches,created:()=>created};
}
test('Defaults are louder, music remains opt-in, legacy selections/explicit zero volumes survive',async t=>{
  const h=harness(t);assert.equal(h.created(),0);assert.deepEqual(audioPreferences(),{track:'off',effects:true,volume:0.65,effectsVolume:0.6,laser:'pulse'});
  assert.equal(audioPreferences({volume:7}).volume,1);assert.equal(audioPreferences({volume:0,effectsVolume:0}).effectsVolume,0);
  assert.equal(audioPreferences({track:'stardrift',volume:0.35}).volume,0.35);
  assert.equal(audioPreferences({track:'bogus',laser:'unknown'}).laser,'pulse');
  await h.audio.unlock();await h.audio.unlock();assert.equal(h.created(),1);assert.equal(h.player.played.length,0);
});
test('Recorded laser fires once, caches downloads and remains independent of music/voice',async t=>{
  const h=harness(t);await h.audio.unlock();await h.audio.preloadLaser();assert.equal(h.audio.laser(),true);
  assert.equal(h.samples.length,1);assert.equal(h.events.filter(e=>e.name==='laser')[0].recorded,true);assert.equal(h.player.played.length,0);
  h.audio.laser();assert.equal(h.samples.length,2);assert.equal(h.samples[0].stopped,true);assert.equal(h.fetches.length,1);
  h.audio.configure({...h.audio.prefs,effects:false});h.audio.laser();assert.equal(h.samples.length,2);
});
test('All samples preload independently; pause suppresses and clears shots',async t=>{
  const h=harness(t);await h.audio.unlock();
  for(const laser of LASERS){h.audio.configure({...h.audio.prefs,laser:laser.id});await h.audio.preloadLaser();h.audio.laser();}
  assert.equal(h.samples.length,LASERS.length);assert.equal(new Set(h.fetches).size,LASERS.length);
  h.audio.setPaused(true);assert.equal(h.audio.nodes.size,0);assert.equal(h.audio.laser(),false);
  h.audio.setPaused(false);h.audio.laser();assert.equal(h.samples.length,LASERS.length+1);
});
test('Full tracks stream once, duck under speech, pause at position, and never layer during switching',async t=>{
  const h=harness(t);await h.audio.unlock();
  for(const track of TRACKS.filter(t=>t.file)){
    h.audio.configure({...h.audio.prefs,track:track.id,volume:0.4});await tick();
    assert.equal(h.player.src,track.file);const count=h.player.played.length;await h.audio.unlock();assert.equal(h.player.played.length,count);
    h.audio.duck(true);assert.ok(h.params.some(p=>p[0]==='target'&&Math.abs(p[1]-0.4*0.9*0.22)<1e-9));
    h.audio.duck(false);assert.ok(h.params.some(p=>p[0]==='target'&&Math.abs(p[1]-0.4*0.9)<1e-9));
    h.player.currentTime=33;h.audio.setPaused(true);assert.equal(h.player.paused,true);
    h.audio.setPaused(false);await tick();assert.equal(h.player.currentTime,33);assert.equal(h.player.paused,false);
  }
  h.audio.configure({track:'off'});assert.equal(h.player.paused,true);assert.equal(h.player.src,'');
  assert.equal(h.created(),1);
});
test('Muted effects and volume zero do not pause music; late play errors cannot restart stopped music',async t=>{
  const h=harness(t);await h.audio.unlock();let reject;
  h.player.play=()=>{h.player.paused=false;return new Promise((_,r)=>reject=r);};
  h.audio.configure({track:'pixel',effects:false,volume:0});assert.equal(h.player.paused,false);assert.equal(h.audio.laser(),false);
  h.audio.configure({track:'off'});reject(Error('Old play aborted'));await tick();assert.equal(h.player.paused,true);
  assert.equal(h.events.filter(e=>e.name==='audio_error').length,0);
});
test('Failed decode uses short rounded fallback, not previous sawtooth; recovery stays possible',async t=>{
  const h=harness(t,{fetchError:true});await h.audio.unlock();await h.audio.preloadLaser();h.audio.laser();
  assert.equal(h.oscillators.length,1);assert.equal(h.oscillators[0].type,'sine');assert.equal(h.samples.length,0);
  assert.ok(h.events.some(e=>e.name==='audio_error'&&e.reason==='laser_file'));
});
test('Suspended-context first input resumes; disposal cancels pending playback',async t=>{
  const h=harness(t,{state:'suspended'});h.audio.laser();await tick();assert.equal(h.events.filter(e=>e.name==='laser').length,1);
  h.ctx.state='suspended';h.audio.laser();h.audio.dispose();await tick();assert.equal(h.events.filter(e=>e.name==='laser').length,1);
  assert.equal(await h.audio.unlock(),false);
});
test('Resume failures are logged without throwing into gameplay',async t=>{
  const h=harness(t,{state:'suspended',resumeError:true});assert.equal(await h.audio.unlock(),false);assert.equal(h.events.at(-1).name,'audio_error');
});
test('Recordings exist locally, private assets stay outside public bundle, and byte ranges are bounded',async()=>{
  for(const f of AUDIO_FILES){const path=PRIVATE_AUDIO_FILES.has(f)?join(process.env.WORD_ARCADE_AUDIO||join(homedir(),'.local/share/family-learning-games/word-arcade/audio'),f):new URL('../public/audio/'+f,import.meta.url);const bytes=await readFile(path);assert.ok(bytes.length>100);if(PRIVATE_AUDIO_FILES.has(f))await assert.rejects(readFile(new URL('../public/audio/'+f,import.meta.url)),{code:'ENOENT'});}
  const credits=await readFile(new URL('../public/audio/CREDITS.md',import.meta.url),'utf8');assert.match(credits,/original/i);assert.match(credits,/CC0/);assert.match(credits,/Kenney/);
  assert.deepEqual(audioRange('bytes=0-99',1000),{start:0,end:99,partial:true});
  assert.deepEqual(audioRange('bytes=-100',1000),{start:900,end:999,partial:true});
  assert.deepEqual(audioRange('bytes=900-',1000),{start:900,end:999,partial:true});
  for(const bad of ['bytes=1000-','bytes=5-2','bytes=-0','bytes=0-5,9-12','foo'])assert.equal(audioRange(bad,1000),null);
});
test('All shot inputs share guarded path; sound preview never submits an answer',async()=>{
  const code=await readFile(new URL('../app/Arcade.jsx',import.meta.url),'utf8');
  assert.ok(code.includes("async function answer(value){if(lock.current||!active)return;"));
  assert.ok(code.indexOf('audio.current?.laser()')<code.indexOf("const d=await action({kind:'answer'"));
  assert.ok(code.includes('if(result.fire&&active&&result.index!==null)void answer'));
  assert.ok(code.includes('Test laser'));assert.ok(code.includes('await engine.preloadLaser();engine.laser();'));
  assert.ok(code.includes('word-arcade-audio-v1:'));assert.ok(code.includes('setPaused(paused||tutorial)'));
});
