import test from 'node:test';
import assert from 'node:assert/strict';
import {flightWorld,flightAim,snapFlightAim,nearestFlyingTarget,launchShot,stepFlight} from '../lib/flight.mjs';
import {question,voiceLines} from '../lib/engine.mjs';
import {shortPrompt,shouldAnnounce} from '../lib/speech-plan.mjs';
test('Dragging clamps at both edges, keeps grab offset and never snaps across the screen',()=>{
 assert.equal(flightAim(-20,48,224),0);assert.equal(flightAim(400,48,224),100);
 assert.equal(flightAim(170,48,224,10),50);
 const w=flightWorld(['left','right']);w.targets[0].x=12;w.targets[0].y=89;w.targets[1].x=90;
 assert.equal(nearestFlyingTarget(w,0).value,'left');assert.equal(snapFlightAim(w,0),0);assert.equal(snapFlightAim(w,6),12);assert.equal(snapFlightAim(w,100),100);
});
test('Fire near either edge always has a target, does not teleport ship, and cannot get stuck at recycling',()=>{
 for(const x of [0,50,100])for(const y of [-12,12,83,89,91.9]){
  const w=flightWorld(['left','right'],{mode:'arcade',level:3});w.ship=x;for(const t of w.targets)t.y=y;
  const t=nearestFlyingTarget(w,x);assert.equal(launchShot(w,t.id),true);assert.equal(w.ship,x);
  assert.equal(launchShot(w,t.id),false);let hits=0;for(let i=0;i<200;i++){const {hit}=stepFlight(w,.016);if(hit)hits++;}
  assert.equal(hits,1,`${x}, ${y}`);assert.equal(w.shots.length,0);assert.equal(launchShot(w,t.id),true);
 }
});
test('Every rhyme target is spoken with chat off, including old saved prompts; clips cover every question',()=>{
 const clips=new Set(voiceLines());for(let n=0;n<240;n++){const q=question('rhyme',1,n);assert.equal(shortPrompt(q),`What rhymes with ${q.word}?`);assert.equal(shouldAnnounce(q,false),true);assert.ok(clips.has(shortPrompt(q)));q.prompt='Read the word. Choose a word that rhymes.';assert.equal(shortPrompt(q),`What rhymes with ${q.word}?`);}
});
