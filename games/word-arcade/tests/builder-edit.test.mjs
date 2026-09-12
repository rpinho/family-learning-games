import test from 'node:test';import assert from 'node:assert/strict';
import {fresh,act} from '../lib/engine.mjs';import {editBuilderDraft} from '../lib/builder.mjs';
const send=(p,a)=>act(p,{revision:p.revision,questionId:p.session?.q?.id,...a});
test('Start over and delete preserve question, scores, and past errors after a wrong word',()=>{
 const p=fresh('admin');send(p,{kind:'start',game:'builder'});const id=p.session.q.id,xp=p.xp,word=p.session.q.word;
 send(p,{kind:'draft',draft:Array(word.length).fill(p.session.q.tiles.find(c=>c!==word[0]))});send(p,{kind:'answer',durationMs:100});assert.equal(p.session.phase,'question');
 send(p,{kind:'draft',draft:editBuilderDraft(p.session.draft,'backspace')});assert.equal(p.session.draft.length,word.length-1);
 send(p,{kind:'draft',draft:editBuilderDraft(p.session.draft,'clear')});assert.deepEqual(p.session.draft,[]);assert.equal(p.session.q.id,id);assert.equal(p.xp,xp);assert.equal(p.session.misses,1);
 send(p,{kind:'draft',draft:[...word]});assert(send(p,{kind:'answer',durationMs:100}).ok);
});
test('Removing a middle letter leaves its position open without losing the other letters',()=>{
 assert.deepEqual(editBuilderDraft(['b','a','d'],'remove',1),['b','','d']);assert.deepEqual(editBuilderDraft(['b','a','d'],'remove',2),['b','a']);assert.deepEqual(editBuilderDraft([],'backspace'),[]);assert.deepEqual(editBuilderDraft(['b','','d'],'backspace'),['b']);
 const p=fresh('admin');send(p,{kind:'start',game:'builder'});const word=p.session.q.word;
 const draft=editBuilderDraft([...word],'remove',1);send(p,{kind:'draft',draft});assert.equal(p.session.draft[1],'');draft[1]=word[1];send(p,{kind:'draft',draft});assert(send(p,{kind:'answer',durationMs:100}).ok);
});
