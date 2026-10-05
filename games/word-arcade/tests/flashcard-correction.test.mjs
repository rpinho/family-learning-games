import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,act,voiceLines} from '../lib/engine.mjs';
import {flashcardCorrection} from '../lib/flashcard-correction.mjs';
const send=(p,input)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id});

for(const deck of ['words','letters'])test(`${deck}: two misses teach, persist, and advance without awarding a win`,()=>{
 let p=fresh('admin');p.xp=120;send(p,{kind:'start',game:'flashcards',deck});
 const q=structuredClone(p.session.q),wrong=q.tiles.find(c=>c!==q.answer);
 assert.equal(send(p,{kind:'answer',answer:wrong,durationMs:1600}).kind,'wrong');
 assert.equal(p.session.phase,'question');
 p=JSON.parse(JSON.stringify(p));
 const correction=send(p,{kind:'answer',answer:wrong,durationMs:2600});
 assert.equal(correction.kind,'taught');assert.equal(correction.ok,false);
 assert.equal(correction.line,flashcardCorrection(q));assert.ok(voiceLines().includes(correction.line));
 assert.equal(p.xp,120);assert.equal(p.session.correct,0);assert.equal(p.session.assisted,0);assert.equal(p.session.score,0);
 assert.equal(p.drills[q.drillKey].skills[q.word].hits,0);
 assert.equal(p.drills[q.drillKey].skills[q.word].errors,2);
 p=JSON.parse(JSON.stringify(p));
 assert.deepEqual(p.session.results[0],{q,answer:wrong,ok:false,taught:true,independent:false,points:0,misses:2,help:true,durationMs:2600});
 assert.throws(()=>send(p,{kind:'answer',answer:q.answer,durationMs:500}),/Already/);
 send(p,{kind:'next'});assert.notEqual(p.session.q.id,q.id);assert.notEqual(p.session.q.word,q.word);
 assert.equal(p.session.help,false);assert.equal(p.session.misses,0);
 assert.equal(send(p,{kind:'answer',answer:p.session.q.answer,durationMs:1500}).independent,true);
});
test('Existing second-miss saves resolve on the next miss; spelling remains a child-built answer',()=>{
 const p=fresh('admin');send(p,{kind:'start',game:'flashcards'});p.session.misses=4;p.session.help=true;
 assert.equal(send(p,{kind:'answer',answer:'!',durationMs:1500}).kind,'taught');
 send(p,{kind:'start',game:'flashcards',deck:'spelling'});
 for(let i=0;i<2;i++)send(p,{kind:'answer',durationMs:1600});
 assert.equal(p.session.phase,'question');assert.equal(p.session.help,true);
 assert.equal(flashcardCorrection(p.session.q),null);
});
test('An eight-card teaching flight ends with zero independent wins or earned XP',()=>{
 const p=fresh('admin');send(p,{kind:'start',game:'flashcards'});
 for(let i=0;i<8;i++){send(p,{kind:'answer',answer:'!',durationMs:1500});send(p,{kind:'answer',answer:'!',durationMs:1500});send(p,{kind:'next'});}
 assert.equal(p.session.phase,'complete');assert.equal(p.session.results.length,8);
 assert.equal(p.session.correct,0);assert.equal(p.session.score,0);assert.equal(p.xp,0);
 assert.equal(p.session.results.filter(r=>r.independent).length,0);
});
