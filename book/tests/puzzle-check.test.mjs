import test from 'node:test';
import assert from 'node:assert/strict';
import {checkBeat,checkBeats,spokenNumbers} from '../puzzle-check.mjs';
import {planChapter} from '../plan.mjs';
import {older,young} from './fixtures.mjs';

test('every planned number game is well-formed, at his level and said in full (many days, every book style)',()=>{
 for(let d=0;d<90;d++){const date=`2026-${String(1+d%12).padStart(2,'0')}-${String(1+d%28).padStart(2,'0')}`;
  for(const [m,profile] of [[older,{bookStyle:'quest'}],[older,{}],[young,{}],[{...older,sage:{practising:['place value']}},{bookStyle:'quest'}]])
   assert.deepEqual(checkBeats(planChapter(m,{date,profile}).beats),[],`${m.player} ${date} ${profile.bookStyle||''}`);}
});
test('the checker refuses nonsense and unsaid boards',()=>{
 assert.ok(checkBeat({id:'q',kind:'puzzle',variant:'nines',display:'n/45 = 4',answer:'4',options:['4','5','6'],spoken:'Solve it.'}).length);
 assert.ok(checkBeat({id:'q',kind:'remainder',total:24,groups:6,answer:'0',options:['0','1','2'],spoken:'24 cookies on six plates',ask:'left over?'}).some(i=>/at most 20|2 to 5/.test(i)));
 assert.ok(checkBeat({id:'q',kind:'puzzle',variant:'skip',display:'10, 20, ?, 40, 50',answer:'30',options:['30','31','40'],spoken:'Which number is missing?'}).some(i=>/never says/.test(i)));
 assert.deepEqual(checkBeat({id:'q',kind:'puzzle',variant:'skip',display:'10, 20, ?, 40, 50',answer:'30',options:['30','31','40'],spoken:'We count by tens: 10, 20, what, 40, 50. Which number is missing?'}),[]);
 assert.ok(checkBeat({id:'q',kind:'no',pv:{n:45,digit:4,claimed:4},right:'4',claim:'The 4 in 45 is worth 4!'}).length);
 assert.ok(spokenNumbers('forty-five and twenty-something').has(45));
});
test('route and play-card questions never say a step twice in a row', async()=>{
 const {repeatedWords}=await import('../lint.mjs');const {routeBeat}=await import('../quest-beats.mjs');
 let seed=3;const r=()=>((seed=(seed*48271)%2147483647)/2147483647);
 for(let k=0;k<300;k++)for(const flavor of [null,'american football']){const b=routeBeat('q',r,{flavor});assert.deepEqual(repeatedWords(b.spoken),[],b.spoken);}
});
