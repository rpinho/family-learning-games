import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,advance,replay,encodeInput,tuning,GOAL,LIVE_RULES} from '../public/dribble-live.mjs';
import {replay as oldReplay,createMatch as oldMatch,advance as oldAdvance} from '../public/dribble-live-v1.mjs';
import {actLive} from '../live-state.mjs';import {fresh,act,RULES} from '../dribble.mjs';
const go=(p,a)=>actLive(p,{revision:p.revision,liveRules:LIVE_RULES,roundId:p.live?.round?.id,...a});
const wide=s=>s.time<1?{x:650,y:535}:s.player.y>140?{x:650,y:105}:{x:400,y:105};
const cut=s=>s.time<.3?{x:620,y:420}:s.time<.9?{x:220,y:400}:s.player.y>140?{x:220,y:105}:{x:400,y:105};
function play(level,seed,steer,old=false){const s=(old?oldMatch:createMatch)(level,seed);let inputs='';while(!s.outcome){const t=steer(s);inputs+=encodeInput(t.x,t.y);(old?oldAdvance:advance)(s,t);}return{s,inputs};}
test('Much faster defender; high levels stop the old wide run but a cut can win at the ceiling',()=>{
 assert.equal(tuning(8).speed,375);assert.equal(tuning(12).speed,475);
 for(let seed=0;seed<5;seed++){assert.equal(play(1,seed,wide).s.outcome,'goal');assert.equal(play(8,seed,wide).s.outcome,'tackled');assert.equal(play(12,seed,wide).s.outcome,'tackled');}
 const {s,inputs}=play(12,0,cut);assert.equal(s.outcome,'goal');assert(s.changes>=2);assert.deepEqual(replay(12,0,inputs),s);
});
test('Crossing the old end zone outside the posts is not a goal; ball crossing the mouth is',()=>{
 const edge=createMatch(1);edge.player.x=650;edge.player.y=106;edge.defender.y=400;advance(edge,{x:650,y:105});assert.equal(edge.outcome,null);
 const center=createMatch(1);center.player.y=106;center.defender.y=400;advance(center,{x:400,y:105});assert.equal(center.outcome,'goal');assert(center.ball.x>GOAL.left&&center.ball.x<GOAL.right);assert(center.ball.y<=GOAL.line);
 const chase=createMatch(8);chase.player.y=155;chase.defender.y=190;chase.defender.x=550;for(let i=0;i<10&&!chase.outcome;i++)advance(chase,{x:150,y:105});assert(chase.defender.y<160,'Defender can chase past its old end-zone boundary');
});
test('Upgrade keeps prior scores, reading and unfinished replay; old clients fail safely after upgrade',()=>{
 const p=fresh('admin');actLive(p,{type:'live-start',liveRules:1,revision:p.revision});
 actLive(p,{type:'live-checkpoint',liveRules:1,revision:p.revision,roundId:p.live.round.id,inputs:'iwee'});
 const before=structuredClone(p.live.round);p.live.wins=30;p.dribbles=10;p.live.reading={level:1,pending:null,serial:4,stars:3};
 go(p,{type:'live-start'});assert.equal(p.live.rules,2);assert.equal(p.live.round.rules,2);assert.equal(p.live.wins,30);assert.equal(p.live.goals,0);assert.equal(p.dribbles,10);assert.equal(p.live.reading.stars,3);assert.deepEqual(p.live.previousRound,before);assert.deepEqual(replay(before.level,before.seed,before.inputs,1),oldReplay(before.level,before.seed,before.inputs));
 assert.throws(()=>actLive(p,{type:'live-start',liveRules:1,revision:p.revision}),e=>e.code==='CLIENT_UPDATE');
});
test('Goal awards once, reading follows goal, level 12 settings work and classic progress stays separate',()=>{
 const p=fresh('admin');go(p,{type:'live-start'});const {inputs}=play(1,p.live.round.seed,wide),id=p.live.round.id;
 const result=go(p,{type:'live-finish',inputs,reading:true});assert.equal(result.outcome,'goal');assert.equal(p.live.goals,1);assert(p.live.reading.pending&&!p.live.reading.pending.done);
 go(p,{type:'live-finish',roundId:id,inputs,revision:0});assert.equal(p.live.goals,1);
 go(p,{type:'live-level',level:12});assert.equal(p.live.round.level,12);assert.equal(p.live.round.rules,2);
 const live=structuredClone(p.live);act(p,{type:'start',revision:p.revision,rulesVersion:RULES});assert.deepEqual(p.live,live);assert(p.round);
});
