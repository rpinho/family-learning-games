import test from 'node:test';
import assert from 'node:assert/strict';
import {dragFlightAim} from '../lib/flight.mjs';
import {fresh,act} from '../lib/engine.mjs';
test('Relative steering clamps both edges, reverses immediately, and does not teleport on a new touch',()=>{
 assert.equal(dragFlightAim(0,0,900),0);
 assert.equal(dragFlightAim(95,400,900),100);
 assert.equal(dragFlightAim(100,-90,900),90);
 assert.equal(dragFlightAim(5,-400,900),0);
 assert.equal(dragFlightAim(0,90,900),10);
 for(const width of [240,600,1100])for(const delta of [-5000,0,5000]){const x=dragFlightAim(50,delta,width);assert(x>=0&&x<=100);}
});
test('Accidental repeat flight shots do not add misses, help, time or skill penalties; deliberate retry remains possible',()=>{
 for(const game of ['rhyme','blaster','asteroids']){
  let p=fresh('admin');const send=i=>act(p,{revision:p.revision,questionId:p.session?.q?.id,...i});
  send({kind:'start',game,level:3});const wrong=p.session.q.options.find(x=>x!==p.session.q.answer);
  assert.equal(send({kind:'answer',flight:true,answer:wrong,durationMs:100}).kind,'wrong');
  p=JSON.parse(JSON.stringify(p));const before=structuredClone(p);
  assert.equal(send({kind:'answer',flight:true,answer:wrong,durationMs:100}).kind,'repeat-ignored');
  assert.equal(p.session.misses,1);assert.equal(p.session.help,false);assert.equal(p.session.activeMs,before.session.activeMs);assert.equal(p.session.level,before.session.level);
  assert.deepEqual(p.foundation,before.foundation);assert.deepEqual(p.lowercase,before.lowercase);
  p.session.lastFlightMiss.at-=1500;
  assert.equal(send({kind:'answer',flight:true,answer:wrong,durationMs:100}).kind,'wrong');
  assert.equal(p.session.misses,2);assert.equal(p.session.help,true);
  assert.equal(send({kind:'answer',flight:true,answer:p.session.q.answer,durationMs:100}).kind,'correct');
 }
});
