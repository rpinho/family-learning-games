import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../lib/math.mjs';
import {daySummary,stretches} from '../lib/day-summary.mjs';

const at='2026-06-01T19:00:00Z';
const round={at,game:'cookies',question:{kind:'cookies',total:24,plates:4,level:4},answer:6,ok:true,helped:false,durationMs:12*60*60*1000};

test('A round resumed after a long pause is still a win, not ten minutes of play or a struggle',()=>{
 const p=freshProfile('admin');p.history=[structuredClone(round)];const before=structuredClone(p);
 const s=daySummary(p,'2026-06-01','UTC');
 assert.equal(s.correct,1);assert.equal(s.independent,1);assert.equal(s.minutes,1);
 assert.equal(s.stretches[0].start,s.stretches[0].end);assert.deepEqual(s.stuck,[]);
 assert.deepEqual(p,before,'reporting must not rewrite saved progress');
});

test('A paused corrected round keeps its assistance and mistakes without presenting the pause as struggle',()=>{
 const p=freshProfile('admin');p.history=[{...round,helped:true,cookieChecks:2,askTries:1}];
 const s=daySummary(p,'2026-06-01','UTC');
 assert.equal(s.correct,1);assert.equal(s.independent,0);
 assert.match(s.stuck[0],/2 uneven\/extra checks, 1 wrong count/);
 assert.doesNotMatch(s.stuck[0],/43200|elapsed/);
});

test('Short round timing still contributes to the estimate, with a defined ten-minute boundary',()=>{
 assert.equal(stretches([{at,durationMs:180000}],'UTC')[0].minutes,3);
 assert.equal(stretches([{at,durationMs:600000}],'UTC')[0].minutes,10);
 assert.equal(stretches([{at,durationMs:600001}],'UTC')[0].minutes,1);
 const p=freshProfile('admin');p.history=[{...round,durationMs:180000}];
 assert.match(daySummary(p,'2026-06-01','UTC').stuck[0],/180 s elapsed/);
});

test('Balance recap describes the saved task and chosen animal or pan instead of numeric UI indexes',()=>{
 const cases=[
  [{kind:'balance',mode:'animals',direction:'lighter',left:{name:'cat'},right:{name:'horse'}},1,'lighter animal: cat or horse: chose horse'],
  [{kind:'balance',mode:'compare',left:{a:7,op:'×',b:8},right:{a:50,op:'+',b:5}},1,'compare 7 × 8 with 50 + 5: chose equal pans'],
  [{kind:'balance',mode:'complete',left:{a:6,op:'×',b:9},right:{a:50,op:'+',b:4}},5,'balance 6 × 9 against 50 + ?: answered 5'],
  [{kind:'balance',weights:{mode:'fixed',label:'7 × 8',target:56}},56,'balance 7 × 8 with number weights (target 56): pressed Help'],
  [{kind:'balance',weights:{mode:'free',label:'',target:24}},24,'make both pans total 24: pressed Help'],
  [{kind:'balance',mode:'blocks',target:8},8,'balance 8 counting blocks: pressed Help'],
 ];
 for(const [question,answer,text]of cases){
  const p=freshProfile('admin');p.history=[{at,game:'balance',question,answer,ok:text.includes('pressed Help'),helped:text.includes('pressed Help'),durationMs:5000}];
  const before=structuredClone(p),summary=daySummary(p,'2026-06-01','UTC');
  assert.ok(summary.stuck[0].endsWith(text),summary.stuck[0]);assert.doesNotMatch(summary.stuck[0],/undefined|NaN/);assert.deepEqual(p,before);
 }
});
