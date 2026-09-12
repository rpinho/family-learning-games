import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,advance,replay,encodeInput,metrics,LIVE_RULES} from '../public/dribble-live-v1.mjs';
import {actLive} from '../live-state.mjs';import {fresh} from '../dribble.mjs';
const go=(p,a,initial=1)=>actLive(p,{revision:p.revision,liveRules:LIVE_RULES,roundId:p.live?.round?.id,...a},initial);
function play(level,seed,steer){const s=createMatch(level,seed);let inputs='';while(!s.outcome){const target=steer(s),token=encodeInput(target.x,target.y);inputs+=token;advance(s,target);}return {s,inputs};}
const straight=()=>({x:400,y:105});
const wide=s=>s.time<1?{x:650,y:535}:{x:650,y:105};
test('Direct charging is blocked; a wide dribble works against gentle defenders but not fast ones',()=>{
 for(let l=1;l<=8;l++)assert.equal(play(l,0,straight).s.outcome,'tackled');
 assert.equal(play(1,0,wide).s.outcome,'escaped');assert.equal(play(8,0,wide).s.outcome,'tackled');
});
test('Replay matches local simulation; no teleport, runaway coordinates or unbounded replay',()=>{
 const {s,inputs}=play(1,0,wide);assert.deepEqual(replay(1,0,inputs),s);
 const q=createMatch(8,0);advance(q,{x:800,y:0});assert(Math.hypot(q.player.x-400,q.player.y-535)<23);assert(q.player.x<=q.cfg.right-23);
 assert.throws(()=>replay(1,0,'bad'));assert.throws(()=>replay(1,0,'zzzz'));assert.throws(()=>replay(1,0,'0000'.repeat(901)));assert.throws(()=>replay(1,0,inputs+'0000'));
 assert(Math.hypot(s.player.x-s.ball.x,s.player.y-s.ball.y)<=25.001);
});
test('Live progression is separate; server validates finishes, checkpoints resume, repeats do not double-score',()=>{
 const p=fresh('admin',8);p.dribbles=42;p.goals=19;const old=structuredClone(p);
 go(p,{type:'live-start'},1);assert.equal(p.live.level,1);
 const {inputs}=play(p.live.round.level,p.live.round.seed,wide),id=p.live.round.id;
 assert.throws(()=>go(p,{type:'live-finish',inputs:''}),/not ended/);
 go(p,{type:'live-checkpoint',inputs:inputs.slice(0,20)});assert.equal(p.live.round.inputs.length,20);
 assert.throws(()=>go(p,{type:'live-checkpoint',inputs:'0000'}),/match/);
 const r=go(p,{type:'live-finish',inputs});assert.equal(r.outcome,'escaped');assert.equal(p.live.wins,1);
 actLive(p,{type:'live-finish',liveRules:LIVE_RULES,roundId:id,revision:0,inputs});assert.equal(p.live.wins,1);
 assert.equal(p.dribbles,old.dribbles);assert.equal(p.goals,old.goals);assert.equal(p.level,old.level);
 const q=fresh('admin');go(q,{type:'live-start'},3);assert.equal(q.live.level,3);
});
test('Settings immediately cancel, old round cannot save; wins raise and three tackles lower difficulty',()=>{
 const p=fresh('admin');go(p,{type:'live-start'});const old=p.live.round.id;go(p,{type:'live-level',level:8});assert.equal(p.live.round.level,8);assert.notEqual(p.live.round.id,old);
 assert.throws(()=>go(p,{type:'live-finish',roundId:old,inputs:''}),/changed/);
 assert.throws(()=>go(p,{type:'live-level',level:9}),/1 to 8/);
 for(let i=0;i<3;i++){go(p,{type:'live-start'});const {inputs}=play(p.live.round.level,p.live.round.seed,s=>({x:s.defender.x,y:105}));go(p,{type:'live-finish',inputs});}assert.equal(p.live.level,7);
 const q=fresh('admin');for(let i=0;i<3;i++){go(q,{type:'live-start'});const {inputs}=play(q.live.round.level,q.live.round.seed,wide);go(q,{type:'live-finish',inputs});}assert.equal(q.live.level,2);assert.equal(q.live.wins,3);
});
test('Defender reacts to history, commits a lunge and cannot instantly reverse it',()=>{
 const s=createMatch(3,0);for(let i=0;i<8;i++)advance(s,{x:510,y:400});
 const before=s.defender.x;advance(s,{x:80,y:535});assert(Math.abs(s.defender.x-before)<35);
 let sawWindup=false,sawLunge=false,sawRecovery=false;
 const t=createMatch(1,0);for(let i=0;i<55&&!t.outcome;i++){advance(t,{x:470,y:435});sawWindup||=t.defender.mode==='windup';sawLunge||=t.defender.mode==='lunge';sawRecovery||=t.defender.mode==='recover';}
 assert(sawWindup&&sawLunge);assert(metrics(t).lunges>0);
});
test('Hard defenders can be beaten with a real direction change, not a scripted win',()=>{
 for(let level=5;level<=8;level++){
  const a=level===6?.3:.5,b=level===6?.6:2,x=level===6?140:160;
  const {s}=play(level,0,s=>s.time<a?{x:620,y:level===6?420:440}:s.time<a+b?{x,y:420}:{x,y:105});
  assert.equal(s.outcome,'escaped','Level '+level);assert(s.changes>=1);assert(s.lunges>=1);
 }
});
