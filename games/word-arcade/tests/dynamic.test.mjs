import test from 'node:test';
import assert from 'node:assert/strict';
import {flightWorld,launchShot,stepFlight,dockAt,orbitPosition,raceDistance,raceRival} from '../lib/flight.mjs';
import {fresh,act,WORDS,voiceLines} from '../lib/engine.mjs';
import {arcadeQuestion} from '../lib/arcade-curriculum.mjs';
const send=(p,input)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id});
test('Targets move continuously; time is bounded, pause freezes the whole simulation',()=>{
 const w=flightWorld(['A','B','C','D']);const before=structuredClone(w);stepFlight(w,1,{paused:true});assert.deepEqual(w,before);stepFlight(w,5);assert.ok(w.targets[0].y>before.targets[0].y);assert.ok(w.targets[0].y-before.targets[0].y<1);assert.equal(w.time,.05);
});
test('Shots have travel time, home fairly to moving targets and hit exactly once',()=>{
 for(let target=0;target<4;target++){const w=flightWorld(['A','B','C','D'],{mode:'arcade',level:3});assert.equal(launchShot(w,target),true);assert.equal(launchShot(w,target),false);assert.equal(stepFlight(w,.016).hit,null);let hit;for(let i=0;i<160&&!hit;i++)hit=stepFlight(w,.016).hit;assert.equal(hit?.value,['A','B','C','D'][target]);for(let i=0;i<30;i++)assert.equal(stepFlight(w,.016).hit,null);}
});
test('Expired targets recycle rather than inventing wrong reading answers',()=>{const w=flightWorld(['A']);w.targets[0].y=93;assert.deepEqual(stepFlight(w,.02).escaped,['A']);assert.equal(w.targets[0].y,-12);assert.equal(w.wraps,1);});
test('A target tapped beside or below the ship still receives a fair hit',()=>{for(const y of [80,87,90,91.9]){const w=flightWorld(['A']);w.targets[0].y=y;launchShot(w,0);let hit;for(let i=0;i<160&&!hit;i++)hit=stepFlight(w,.016).hit;assert.equal(hit?.value,'A');}});
test('Orbit positions stay in bounds; dock edges and race finish are clamped',()=>{for(let i=0;i<9;i++)for(let t=0;t<200;t++){const p=orbitPosition(i,9,t);assert.ok(p.x>=16&&p.x<=84&&p.y>=19&&p.y<=79);}assert.equal(dockAt(100,4),3);assert.equal(dockAt(-10,4),0);assert.equal(raceDistance(Array(20)),100);assert.equal(raceRival(999),100);});
test('Each flashcard deck and orbit retain varied independent history and valid answers',()=>{
 const lines=new Set(voiceLines());for(const game of ['orbit','flashcards'])for(const deck of ['words','letters','spelling']){const p=fresh('admin');const seen=[];for(let i=0;i<40;i++){const q=arcadeQuestion(p,game,WORDS,deck);assert.ok(lines.has(q.prompt),q.prompt);assert.ok(lines.has(q.help),q.help);assert.ok([...q.answer].every(c=>q.tiles.includes(c)));if(deck!=='letters'){assert.ok(!seen.slice(-8).includes(q.word));seen.push(q.word);}if(game==='orbit'){const pool=[...q.nodes];for(const c of q.word){const index=pool.indexOf(c);assert.ok(index>=0);pool.splice(index,1);}}}if(deck!=='letters')assert.equal(new Set(seen.slice(0,36)).size,36);}
});
test('All flashcard decks persist mode, help and progress; assistance never becomes independent',()=>{
 for(const deck of ['words','letters','spelling']){let p=fresh('beginner');send(p,{kind:'start',game:'flashcards',mode:'arcade',deck});const original=p.session.q.id;send(p,{kind:'help'});p=JSON.parse(JSON.stringify(p));if(deck==='spelling')send(p,{kind:'draft',draft:[...p.session.q.answer]});const r=send(p,{kind:'answer',answer:p.session.q.answer,durationMs:3000});assert.equal(r.independent,false);assert.equal(p.session.mode,'arcade');assert.equal(p.session.deck,deck);assert.equal(p.session.score,40);assert.equal(p.session.results.length,1);send(p,{kind:'next'});assert.notEqual(p.session.q.id,original);}
});
test('Arcade and Practice change motion not the reading assessment or starting word bank',()=>{const a=fresh('admin'),b=fresh('admin');send(a,{kind:'start',game:'orbit',mode:'arcade'});send(b,{kind:'start',game:'orbit',mode:'practice'});assert.deepEqual(a.session.q,b.session.q);assert.throws(()=>send(fresh('admin'),{kind:'start',game:'flashcards',deck:'unknown'}));});
test('Letter flashcards cover the alphabet and rotate answer positions',()=>{const p=fresh('admin'),letters=new Set(),slots=new Set();for(let i=0;i<26;i++){const q=arcadeQuestion(p,'flashcards',WORDS,'letters');letters.add(q.answer);slots.add(q.tiles.indexOf(q.answer));assert.equal(new Set(q.tiles).size,4);}assert.equal(letters.size,26);assert.ok(slots.size>=3);});
test('Race time accumulates active answer attempts across retries and reloads',()=>{let p=fresh('admin');send(p,{kind:'start',game:'flashcards',mode:'arcade',deck:'letters'});send(p,{kind:'answer',answer:p.session.q.tiles.find(c=>c!==p.session.q.answer),durationMs:2500});p=JSON.parse(JSON.stringify(p));send(p,{kind:'answer',answer:p.session.q.answer,durationMs:3500});assert.equal(p.session.activeMs,6000);assert.equal(p.session.results[0].independent,false);});
