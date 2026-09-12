import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerState,lowerQuestion,lowerAttempt,lowerReady} from '../lib/lowercase.mjs';
import {fresh,act,voiceLines} from '../lib/engine.mjs';
test('Lowercase flights keep their own adaptive track across restart and voice coverage',()=>{
 let p=fresh('explorer');const send=input=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id});send({kind:'start',game:'blaster',focus:'lowercase'});
 const lines=new Set(voiceLines());for(let i=0;i<8;i++){assert.ok(lines.has(p.session.q.prompt));assert.ok(lines.has(p.session.q.help));send({kind:'answer',answer:p.session.q.answer,durationMs:1000});send({kind:'next'});p=JSON.parse(JSON.stringify(p));}
 const stage=p.lowercase.stage;send({kind:'start',game:'blaster',focus:'lowercase'});assert.equal(p.session.q.stage,stage);assert.equal(fresh('beginner').lowercase,undefined);
});
test('Lowercase starts independently, gradually increases, fades cues and reaches all 26 letters',()=>{
 const p={id:'explorer',skills:{'find:A':{level:3}},games:{blaster:{level:3}}},seen=new Set();
 for(let i=0;i<100;i++){const q=lowerQuestion(p);seen.add(q.char);assert.ok(q.options.includes(q.char));assert.equal(new Set(q.options).size,q.options.length);assert.equal(q.options.length,q.stage===1?2:q.stage===2?3:4);assert.equal(!!q.upperCue,q.stage<=3);assert.deepEqual(lowerQuestion(JSON.parse(JSON.stringify(p))),q);lowerAttempt(p,q,{ok:true});}
 assert.equal(lowerState(p).stage,6);assert.equal(seen.size,26);assert.equal(lowerReady(p),true);assert.equal(p.skills['find:A'].level,3);
});
test('Mistakes ease the next challenge; hints and uppercase pairing never count as sound-only evidence',()=>{
 const p={};for(let i=0;i<9;i++)lowerAttempt(p,lowerQuestion(p),{ok:true});
 assert.equal(lowerState(p).stage,4);assert.equal(lowerReady(p),false);
 const q=lowerQuestion(p);lowerAttempt(p,q,{ok:true,helped:true});assert.equal(lowerState(p).skills[q.char].audioHits,0);assert.equal(lowerState(p).streak,0);
 lowerAttempt(p,lowerQuestion(p),{ok:false});lowerAttempt(p,lowerQuestion(p),{ok:false});assert.equal(lowerState(p).stage,3);
 const next=lowerQuestion(p);assert.ok(next.upperCue);lowerAttempt(p,next,{ok:true});assert.equal(lowerState(p).skills[next.char].audioHits,0);
 assert.equal(lowerState({id:'beginner'}).stage,1);
});
