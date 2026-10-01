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
