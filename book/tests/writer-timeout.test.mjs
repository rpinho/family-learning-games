import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {askModel} from '../generate.mjs';
import {episodeLearning,writeEpisode,WRITER_TURN_MS} from '../episodes/generate.mjs';
const library={actors:{'grown-up':{}},backgrounds:{garden:{}}};
const plan={level:'reader',player:'explorer',date:'2026-10-05',mathFloor:{tables:[2,3,4,5,6,7,8,9]},math:{factsStuck:['3x9']},learnerFocus:[{kind:'signs',value:'pig'},{kind:'spell',value:'dig'}]};
const learning=episodeLearning(plan);

test('the quest writer gives its first turn more than the 240 s default',async()=>{
 const limits=[];
 const r=await writeEpisode(plan,{library,learning,ask:async(p,o)=>{limits.push(o.timeoutMs);return {source:'writer',text:'not JSON'};}});
 assert.ok(WRITER_TURN_MS>240000);assert.equal(limits[0],WRITER_TURN_MS);
 assert.equal(r.source,'deterministic quest fallback');
});

test('writer turns share one time budget, then the checked fallback is used',async()=>{
 let now=0;const limits=[],logs=[];
 const r=await writeEpisode(plan,{library,learning,clock:()=>now,log:m=>logs.push(m),ask:async(p,o)=>{limits.push(o.timeoutMs);now+=9*60e3;return {source:'writer',text:'not JSON'};}});
 assert.deepEqual(limits,[8*60e3,8*60e3,2*60e3]);
 assert.ok(logs.some(m=>/Writer time used/.test(m)));
 assert.equal(r.source,'deterministic quest fallback');assert.deepEqual(r.checks.issues,[]);
});

test('a model turn that runs over its limit is stopped and reported as a timeout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'writer-timeout-')),bin=join(dir,'slow-model');
 await writeFile(bin,'#!/bin/sh\nexec sleep 30\n');await chmod(bin,0o755);
 const messages=[],started=Date.now();
 const r=await askModel('Synthetic request.',{env:{...process.env,BOOK_BACKEND:'claude,none',BOOK_CLAUDE_BIN:bin},log:m=>messages.push(m),timeoutMs:1000});
 assert.equal(r,null);assert.ok(Date.now()-started<10000);
 assert.match(messages[0],/claude unavailable \(timed out after 1 s\)/);
});
