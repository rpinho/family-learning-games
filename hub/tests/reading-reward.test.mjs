import test from 'node:test';import assert from 'node:assert/strict';
import {makeReward,WORDS,READING_LINES} from '../public/reading-reward.mjs';
import {actLive} from '../live-state.mjs';import {fresh} from '../dribble.mjs';
import {createMatch,advance,encodeInput,LIVE_RULES} from '../public/dribble-live-v1.mjs';
const go=(p,a,initial=1)=>actLive(p,{revision:p.revision,liveRules:LIVE_RULES,roundId:p.live?.round?.id,...a},initial);
function win(p,initial=1){go(p,{type:'live-level',level:1},initial);const r=p.live.round,s=createMatch(1,r.seed);let inputs='';while(!s.outcome){const t=s.time<1?{x:650,y:535}:{x:650,y:105};inputs+=encodeInput(t.x,t.y);advance(s,t);}assert.equal(s.outcome,'escaped');go(p,{type:'live-finish',inputs,reading:true},initial);return p.live.reading.pending;}
const answer=(p,q,choice=q.answer,id=q.id+'-answer')=>go(p,{type:'live-reading-answer',questionId:q.id,answer:choice,actionId:id});
test('All rewards have one correct option, unique alternatives and cached speech; words rotate',()=>{
 for(let i=0;i<150;i++)for(let t=0;t<4;t++){const q=makeReward(i,t);assert.equal(new Set(q.options).size,3);assert(q.options.includes(q.answer));assert(READING_LINES.includes(q.cue));assert(READING_LINES.includes(q.model));}
 assert.equal(new Set(WORDS.map((_,i)=>makeReward(i,3).answer)).size,WORDS.length);
});
test('Winning opens a durable reward, refresh holds it, wrong answers never remove a dribble',()=>{
 const p=fresh('admin'),q=win(p),wins=p.live.wins;
 go(p,{type:'live-start'});assert.equal(p.live.reading.pending.id,q.id);assert(p.live.round.done);
 const wrong=q.options.find(x=>x!==q.answer);answer(p,q,wrong,'wrong1');answer(p,q,wrong,'wrong2');assert(q.helped);assert.equal(q.errors,2);assert.equal(p.live.wins,wins);
 const result=answer(p,q);assert.equal(result.independent,false);assert.equal(p.live.reading.stars,1);
 // Lost response retry cannot double-award or count another mistake.
 go(p,{type:'live-reading-answer',questionId:q.id,answer:q.answer,actionId:q.id+'-answer',revision:0});assert.equal(p.live.reading.stars,1);
 go(p,{type:'live-start'});assert(!p.live.round.done);
});
test('Reading advances separately, help/skip do not count as mastery, settings cancel immediately',()=>{
 const p=fresh('admin');for(let i=0;i<3;i++){const q=win(p);answer(p,q);}assert.equal(p.live.reading.level,1);assert.equal(p.live.level,1);
 let q=win(p);go(p,{type:'live-reading-help',questionId:q.id,actionId:'help'});answer(p,q);
 q=win(p);go(p,{type:'live-reading-skip',questionId:q.id,actionId:'skip'});assert.equal(p.live.reading.level,0);assert.equal(p.live.reading.stars,4);
 q=win(p);go(p,{type:'live-level',level:4});assert(p.live.reading.pending.done);assert.equal(p.live.round.level,4);
 const explorer=fresh('admin');assert.equal(win(explorer,3).tier,1);
});
test('Stale or invalid reading answers cannot alter another challenge',()=>{
 const p=fresh('admin'),q=win(p);assert.throws(()=>answer(p,q,'INVALID'),/Choose/);assert.throws(()=>answer(p,{...q,id:'old'}),/changed/);
});
