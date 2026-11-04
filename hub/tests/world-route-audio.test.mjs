import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createCoachAudio} from '../public/chess/audio.mjs';

const scope=await readFile(new URL('../public/audio-scope.mjs',import.meta.url),'utf8');
const world=await readFile(new URL('../public/world.mjs',import.meta.url),'utf8');
// Run the actual route handler and narration guards without booting the page or a save server.
function declaration(name){
 const start=world.indexOf(`async function ${name}(`);
 assert.ok(start>=0);
 return world.slice(start,world.indexOf('\n}',start)+2);
}
function fixture(locked){
 const handlers=new Map(),heard=[],walks=[],captions=[],events=[];
 class Media{
  paused=true;
  play(){this.paused=false;heard.push(this.src);return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(){this.src='';}
  load(){}
 }
 const nodes={'#map':{hidden:true},'#world':{dataset:{}},'#sound':{}};
 const env=vm.createContext({
  document:{hidden:false,addEventListener:(key,fn)=>handlers.set(key,fn)},
  addEventListener:(key,fn)=>handlers.set(key,fn),dispatchEvent:e=>events.push(e.type),
  HTMLMediaElement:Media,Event,setTimeout,
  $:key=>nodes[key],disposed:false,challengeGate:null,['gates'.toUpperCase()]:{},voiceTurn:0,muted:false,
  interactionTurn:0,state:{room:'room-a'},lastLine:null,
  lines:{guidance:{text:'Find a key.',clip:'guidance.wav'},puzzle:{text:'Count the shapes.',clip:'puzzle.wav'}},
  targetStatus:()=>({missing:locked?['key']:[],next:{key:'guidance'}}),
  refuse:status=>env.speak(status.next.key),caption:text=>captions.push(text),
  heroSize:()=>({w:.1}),walk:async(to,side)=>{walks.push({to,side});},
 });
 vm.runInContext(scope,env);
 const old=new Media();old.src='old.wav';old.play();
 env.rewardAudio={stop:()=>{}};
 env.audio={stop:()=>old.pause(),play:src=>{const clip=new Media();clip.src=src;return clip.play();}};
 vm.runInContext(declaration('speak')+'\n'+declaration('walkToEdge'),env);
 return {env,old,heard,walks,captions,events,handlers};
}
for(const locked of [true,false])test(`${locked?'Locked':'Allowed'} internal exit cancels old audio and permits automatic narration`,async()=>{
 const f=fixture(locked);
 await f.env.walkToEdge('right');
 assert.equal(f.old.paused,true,'old clip cancelled');
 assert.equal(f.env.familyAudio.epoch,1,'pending audio invalidated');
 assert.deepEqual(f.events,['family-audio-stop']);
 assert.equal(f.env.familyAudio.blocked,false,'in-page travel must not set the navigation barrier');
 assert.equal(f.walks.length,locked?0:1);
 if(locked){assert.ok(f.heard.includes('/book-voice/guidance.wav?r=L1'));assert.ok(f.captions.includes('Find a key.'));}
 else assert.equal(f.walks[0].side,'right');
 await f.env.speak('puzzle'); // No new gesture between the route and the next automatic cue.
 assert.ok(f.heard.includes('/book-voice/puzzle.wav?r=L1'));
});
for(const boundary of ['stop','pagehide','hidden'])test(`${boundary} retains the navigation barrier across an internal route`,async()=>{
 const f=fixture(false);
 if(boundary==='stop')f.env.familyAudio.stop();
 else if(boundary==='hidden'){f.env.document.hidden=true;f.handlers.get('visibilitychange')();}
 else f.handlers.get(boundary)();
 f.env.document.hidden=false;
 const count=f.heard.length;
 await f.env.walkToEdge('right');
 await f.env.speak('puzzle');
 assert.equal(f.env.familyAudio.blocked,true);
 assert.equal(f.heard.length,count,'automatic audio cannot bypass departure cancellation');
 f.handlers.get('pointerdown')();
 await f.env.speak('puzzle');
 assert.equal(f.heard.length,count+1,'a fresh visible gesture releases the barrier');
});

test('new narration cancels a reaction primer even when its play promise completes later',async()=>{
 const f=fixture(false);let finishPrimer;
 const reaction={paused:true,play(){this.paused=false;return new Promise(r=>finishPrimer=r);},pause(){this.paused=true;}};
 f.env.rewardAudio=createCoachAudio({createAudio:()=>reaction});
 f.env.rewardAudio.unlock();
 assert.equal(reaction.paused,false);
 const play=f.env.audio.play;let pausedAtCue;
 f.env.audio.play=source=>{pausedAtCue=reaction.paused;return play(source);};
 await f.env.speak('puzzle');
 finishPrimer();await Promise.resolve();
 assert.equal(pausedAtCue,true,'reaction must stop before the cue starts');
 assert.equal(reaction.paused,true,'late primer completion must stay silent');
 assert.deepEqual(f.heard.filter(s=>s.includes('puzzle.wav')),['/book-voice/puzzle.wav?r=L1']);
});
