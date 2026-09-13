import test from 'node:test';import assert from 'node:assert/strict';
import {fresh} from '../dribble.mjs';import {actLive} from '../live-state.mjs';
import {createMatch,advance,encodeInput} from '../public/dribble-live.mjs';
const send=(p,a)=>actLive(p,{liveRules:3,revision:p.revision,...a});
function finish(p,win=false){
 const r=p.live.round,s=createMatch(r.level,r.seed);let inputs='';
 while(!s.outcome){const t=win?(s.time<.3?{x:620,y:420}:s.time<1.3?{x:600,y:400}:s.player.y>140?{x:600,y:105}:{x:400,y:105}):{x:400,y:535};inputs+=encodeInput(t.x,t.y);advance(s,t);}
 assert.equal(s.outcome,win?'goal':'tackled');
 return send(p,{type:'live-finish',roundId:r.id,inputs});
}
test('Two losses ease high levels by two, lower levels by one, without clearing scores or changing physics',()=>{
 const p=fresh('admin');send(p,{type:'live-start'});p.live.goals=5;p.live.wins=8;p.live.reading={stars:4};
 send(p,{type:'live-level',level:12});
 finish(p);assert.equal(p.live.level,12);send(p,{type:'live-start'});
 const r=finish(p);assert.equal(p.live.level,10);assert.equal(r.easierNext,true);assert.equal(r.fromLevel,12);assert.equal(r.nextLevel,10);
 const revision=p.revision;assert.deepEqual(send(p,{type:'live-finish',roundId:p.live.round.id,inputs:p.live.round.inputs}),r);assert.equal(p.revision,revision);
 assert.equal(p.live.goals,5);assert.equal(p.live.wins,8);assert.equal(p.live.reading.stars,4);
 send(p,{type:'live-level',level:4});finish(p);send(p,{type:'live-start'});finish(p);assert.equal(p.live.level,3);
 send(p,{type:'live-level',level:1});finish(p);send(p,{type:'live-start'});finish(p);assert.equal(p.live.level,1);
 send(p,{type:'live-level',level:12});assert.equal(p.live.round.level,12);assert.equal(p.live.round.inputs,'');
});
test('Four wins, not three, raise one level; each goal keeps its reward',()=>{
 const p=fresh('admin');send(p,{type:'live-start'});
 // Same synthetic seed isolates the progression rule from route variety.
 for(let i=1;i<=4;i++){p.live.round.seed=0;finish(p,true);assert.equal(p.live.level,i===4?2:1);assert.equal(p.live.goals,i);if(i<4)send(p,{type:'live-start'});}
});
