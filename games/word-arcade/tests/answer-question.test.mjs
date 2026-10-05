import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {answerQuestion} from '../lib/answer-question.mjs';import {act,fresh} from '../lib/engine.mjs';
const {rows}=JSON.parse(readFileSync(new URL('./answer-tagging.fixture.json',import.meta.url)));
test('Synthetic advancing rows: snapshot belongs to submitted id, never the next question',()=>{
 assert.ok(rows.length===16);for(const row of rows){const snap=answerQuestion(row.before,row.input);assert.deepEqual(snap,row.expected);assert.notEqual(snap.id,row.after.q?.id);if(row.before.q)row.before.q.answer='changed';assert.notEqual(snap.answer,'changed');}
});
test('Actual advancing engine logs the completed question, including the last round',()=>{
 const p=fresh('admin');act(p,{kind:'start',game:'slalom',revision:p.revision});
 for(let i=0;i<8;i++){const input={kind:'answer',questionId:p.session.q.id,answer:p.session.q.answer,durationMs:3000,revision:p.revision};const q=answerQuestion(p.session,input);act(p,input);assert.equal(q.id,input.questionId);assert.equal(q.answer,input.answer);if(i<7)assert.notEqual(p.session.q.id,q.id);}
 assert.equal(answerQuestion(p.session,{kind:'answer',questionId:'absent'}),null);
});
