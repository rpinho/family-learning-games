import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,advance,replay,encodeInput,LIVE_RULES,tuning} from '../public/dribble-live.mjs';
import {createMatch as before,advance as advanceBefore,replay as replayBefore} from '../public/dribble-live-v2.mjs';
import {fresh} from '../dribble.mjs';import {actLive} from '../live-state.mjs';
function play(level,steer,old=false){const s=(old?before:createMatch)(level,0);let inputs='';while(!s.outcome){const t=steer(s);inputs+=encodeInput(t.x,t.y);(old?advanceBefore:advance)(s,t);}return{s,inputs};}
const formerCut=s=>s.time<.3?{x:620,y:420}:s.time<.9?{x:220,y:400}:s.player.y>140?{x:220,y:105}:{x:400,y:105};
const closeApproach=s=>s.time<.3?{x:620,y:420}:s.time<1.3?{x:600,y:400}:s.player.y>140?{x:600,y:105}:{x:400,y:105};
test('Close marking blocks the earlier cut while high levels retain a beatable opening',()=>{
 assert.equal(tuning(8).speed,429);assert.equal(play(12,formerCut,true).s.outcome,'goal');assert.equal(play(12,formerCut).s.outcome,'tackled');
 for(const level of [8,12]){const {s,inputs}=play(level,closeApproach);assert.equal(s.outcome,'goal');assert(s.lunges>0);assert.deepEqual(replay(level,0,inputs),s);}
});
test('Levels one through five retain their previous movement exactly',()=>{
 for(let level=1;level<=5;level++){const a=createMatch(level),b=before(level);for(let i=0;i<20&&!a.outcome;i++){const t={x:600,y:400};advance(a,t);advanceBefore(b,t);assert.deepEqual(a.player,b.player);assert.deepEqual(a.defender,b.defender);assert.equal(a.outcome,b.outcome);}}
});
test('V2 replay and goals survive upgrade; legacy tab receives a clear refresh request',()=>{
 const p=fresh('admin');actLive(p,{type:'live-start',liveRules:2,revision:0});actLive(p,{type:'live-checkpoint',liveRules:2,revision:p.revision,roundId:p.live.round.id,inputs:'iwee'});const old=structuredClone(p.live.round);p.live.goals=4;p.live.wins=30;p.live.reading={level:2,stars:8,pending:null};
 actLive(p,{type:'live-start',liveRules:LIVE_RULES,revision:p.revision});assert.equal(p.live.round.rules,3);assert.equal(p.live.goals,4);assert.equal(p.live.wins,30);assert.equal(p.live.reading.stars,8);assert.deepEqual(p.live.previousRound,old);assert.deepEqual(replay(old.level,old.seed,old.inputs,2),replayBefore(old.level,old.seed,old.inputs));assert.throws(()=>actLive(p,{type:'live-start',liveRules:2,revision:p.revision}),e=>e.code==='CLIENT_UPDATE');
});
