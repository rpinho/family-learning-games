// Helper's uppercase-first practice supersedes the earlier lowercase-first draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import {foundationState,foundationQuestion,foundationAttempt,FOUNDATION_WORDS} from '../public/foundation.mjs';
test('Uppercase CVC families consolidate before advancing, without longer words',()=>{
 const p={},words=new Set();
 for(let i=0;i<42;i++){const q=foundationQuestion(p);words.add(q.word);assert.equal(q.word.length,3);assert.match(q.answer,/^[A-Z]$/);assert.ok(q.options.every(c=>/^[A-Z]$/.test(c)));assert.equal(new Set(q.options).size,q.options.length);assert.deepEqual(foundationQuestion(JSON.parse(JSON.stringify(p))),q);foundationAttempt(p,q,{ok:true});if(i===4)assert.equal(foundationState(p).stage,1);if(i===5)assert.equal(foundationState(p).stage,2);}
 assert.equal(foundationState(p).stage,4);assert.equal(words.size,12);assert.equal(FOUNDATION_WORDS.includes('ball'),false);
});
test('Help does not advance; mistakes lower the next family; existing reading state stays separate',()=>{
 const p={reading:{skills:{decode:{level:3}}},lowercase:{stage:6}};
 for(let i=0;i<6;i++)foundationAttempt(p,foundationQuestion(p),{ok:true});
 assert.equal(foundationState(p).stage,2);
 for(let i=0;i<8;i++)foundationAttempt(p,foundationQuestion(p),{ok:true,helped:true});
 assert.equal(foundationState(p).stage,2);foundationAttempt(p,foundationQuestion(p),{ok:false});foundationAttempt(p,foundationQuestion(p),{ok:false});assert.equal(foundationState(p).stage,1);assert.equal(p.lowercase.stage,6);assert.equal(p.reading.skills.decode.level,3);
});

import {freshProfile,nextChallenge,applyAttempt,startDuel} from '../public/engine.mjs';
test('Explorer starts with uppercase CVC, not new lowercase drills; other tracks and retries remain',()=>{
 const p=freshProfile();let q=nextChallenge(p);assert.equal(q.focus,'uppercase-cvc');assert.equal(q.type,'gap');assert.equal(q.word.length,3);assert.equal(q.word,q.word.toUpperCase());applyAttempt(p,q,{answer:q.char,durationMs:3000,helped:false});assert.equal(p.foundation.serial,1);assert.equal(p.lowercase,undefined);assert.equal(nextChallenge(freshProfile('beginner')).foundation,undefined);startDuel(p);assert.equal(nextChallenge(p).duel,true);p.duel.paused=true;p.retryTrace='B';assert.equal(nextChallenge(p).retry,true);
});
import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('Foundation HTTP updates after each answer, persists and rejects replay',async t=>{
 const data=await mkdtemp(join(tmpdir(),'letter-quest-foundation-')),child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14328',HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());await once(child.stdout,'data');const base='http://127.0.0.1:14328';let state=await (await fetch(base+'/api/explorer/state')).json();
 for(let i=0;i<6;i++){const body=JSON.stringify({challengeId:state.challenge.id,answer:state.challenge.char,helped:false,durationMs:3000});const post=()=>fetch(base+'/api/explorer/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body});const res=await post();assert.equal(res.status,200);state=await res.json();assert.equal((await post()).status,409);}
 assert.equal(state.profile.foundation.stage,2);assert.equal(state.challenge.options.length,3);assert.equal(JSON.parse(await readFile(join(data,'explorer.json'))).foundation.stage,2);assert.equal((await (await fetch(base+'/api/beginner/state')).json()).profile.foundation,undefined);
});
