import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile,action,targetFor,targetAt,scoreAim,targetsFor,challengeFor,aimAt,FLIGHT_MS,scoreShot} from '../engine.mjs';
const act=(p,v)=>action(p,{...v,revision:p.revision});
function aimedInput(r,index,id=challengeFor(r,index)?.answerIndex||0){const t=targetsFor(r,index,500+FLIGHT_MS)[id],drift=aimAt(r,400,250,500);return {type:'shot',rules:2,shot:index,x:t.x-(drift.x-400),y:t.y-(drift.y-250),elapsed:500,pointer:'touch'};}
function shootCenter(p){act(p,aimedInput(p.round,p.round.shots.length));}
test('Targets are varied, stay reachable at all levels and scoring is deterministic',()=>{
 const layouts=new Set();for(let level=1;level<=10;level++)for(let seed=1;seed<=30;seed++)for(let i=0;i<5;i++){const t=targetFor({seed,level},i);layouts.add(JSON.stringify(t));for(const time of [0,800,2400,10000]){const v=targetAt(t,time);assert.ok(v.x-v.radius>=0&&v.x+v.radius<=800);assert.ok(v.y-v.radius>=0&&v.y+v.radius<=500);assert.equal(scoreAim(v.x,v.y,v).points,10);assert.equal(scoreAim(v.x+v.radius*.7,v.y,v).points,4);assert.equal(scoreAim(v.x+v.radius*1.2,v.y,v).points,0);}}assert.ok(layouts.size>1000);
});
test('Five arrows auto-advance within a round, persist honest scores and adapt gently',()=>{
 const p=freshProfile('beginner');assert.equal(p.level,1);assert.equal(freshProfile('explorer').level,3);
 for(let r=0;r<2;r++){act(p,{type:'start'});for(let i=0;i<5;i++)shootCenter(p);assert.equal(p.round.done,true);assert.equal(p.round.score,50);assert.throws(()=>shootCenter(p));}
 assert.equal(p.level,2);assert.equal(p.best,50);assert.equal(p.bullseyes,10);assert.equal(p.shots,10);assert.equal(p.stars,6);
 act(p,{type:'start'});const saved=structuredClone(p.round);act(p,{type:'start'});assert.deepEqual(p.round,saved);act(p,{type:'level',level:7});for(let i=0;i<5;i++)shootCenter(p);assert.equal(p.level,7);act(p,{type:'start'});assert.equal(p.round.level,7);
});
test('Bad inputs and duplicate arrows cannot spend arrows or corrupt a round',()=>{
 const p=freshProfile('admin');act(p,{type:'start'});const before=structuredClone(p);for(const v of [{x:NaN,y:100,elapsed:0},{x:400,y:-1,elapsed:0},{x:400,y:200,elapsed:Infinity},{x:'400',y:200,elapsed:0}]){assert.throws(()=>act(p,{type:'shot',shot:0,...v}));assert.deepEqual(p,before);}shootCenter(p);assert.throws(()=>action(p,{type:'shot',revision:before.revision,shot:0,x:400,y:200,elapsed:0}));assert.equal(p.shots,1);for(const level of [0,21,'2'])assert.throws(()=>act(p,{type:'level',level}));
});
test('Letter and word choices are unique, varied and never overlap at any aiming level',()=>{
 for(let stage=1;stage<=5;stage++){const seen=new Set();for(let sequence=0;sequence<12;sequence++){const r={rules:2,mode:'learn',sequence,seed:(sequence+1)*9013+31,readingLevel:stage};for(let i=0;i<5;i++){const c=challengeFor(r,i);seen.add(c.answer.toLowerCase());assert.equal(new Set(c.labels.map(v=>v.toLowerCase())).size,c.labels.length);assert.equal(c.labels[c.answerIndex],c.answer);for(const level of [1,5,10,15,20])for(const time of [0,500,3000,15000]){const targets=targetsFor({...r,level},i,time);for(const t of targets){assert.ok(t.x-t.radius>=0&&t.x+t.radius<=800);assert.ok(t.y-t.radius>=0&&t.y+t.radius<=500);for(const other of targets.filter(v=>v.id!==t.id))assert.ok(Math.hypot(t.x-other.x,t.y-other.y)>t.radius+other.radius);}}}}assert.ok(seen.size>=26,stage+' must not repeat the same five targets');}
});
test('Wrong-letter bullseyes earn zero; aim misses do not count as wrong-letter hits',()=>{
 const p=freshProfile('beginner');act(p,{type:'start'});const c=challengeFor(p.round,0),wrong=(c.answerIndex+1)%c.labels.length;
 act(p,aimedInput(p.round,0,wrong));assert.equal(p.round.shots[0].aimPoints,10);assert.equal(p.round.score,0);assert.equal(p.learning.wrong,1);assert.equal(p.learning.correct,0);
 act(p,{type:'shot',rules:2,shot:1,x:0,y:500,elapsed:500});assert.equal(p.round.shots[1].outcome,'miss');assert.equal(p.learning.misses,1);assert.equal(p.learning.wrong,1);
 shootCenter(p);assert.equal(p.learning.correct,1);assert.equal(p.round.score,10);
});
test('Arrival-time collision and visible sway are deterministic; legacy rounds remain intact',()=>{
 const r={rules:2,mode:'learn',level:20,readingLevel:2,sequence:1,seed:18057};const input=aimedInput(r,0),s=scoreShot(r,0,input);assert.equal(s.points,10);assert.deepEqual(scoreShot(r,0,input),s);assert.deepEqual({x:s.x,y:s.y},aimAt(r,input.x,input.y,input.elapsed));
 const released=targetsFor(r,0,500)[challengeFor(r,0).answerIndex];assert.ok(Math.hypot(s.target.x-released.x,s.target.y-released.y)>10);
 const p=freshProfile('beginner');p.round={id:'legacy',seed:9044,level:2,theme:0,shots:[],score:0,done:false};const saved=structuredClone(p.round);act(p,{type:'mode',mode:'learn'});act(p,{type:'reading',level:4});act(p,{type:'start'});assert.deepEqual(p.round,saved);
 const t=targetAt(targetFor(p.round,0),0);act(p,{type:'shot',shot:0,x:t.x,y:t.y,elapsed:0});assert.equal(p.round.score,10);assert.equal(p.round.rules,undefined);
});
