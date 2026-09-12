import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,act,question,voiceLines,WORDS} from '../lib/engine.mjs';
import {BUILDER_STARTERS} from '../lib/builder.mjs';
import {GAMES} from '../lib/engine.mjs';
import {GAME_IDENTITIES} from '../lib/game-identities.mjs';
const send=(p,input)=>act(p,{...input,revision:p.revision,questionId:p.session?.q?.id});
test('Every game has its own visual identity, including retained puzzles',()=>{const identities=GAMES.map(g=>GAME_IDENTITIES[g.id]);assert.ok(identities.every(x=>x?.icon&&x.label&&x.example));assert.equal(new Set(identities.map(x=>x.icon)).size,GAMES.length);});
test('Switching arcade games keeps ten recent words out of the next question',()=>{
 let p=fresh('explorer');const recent=[],games=['blaster','builder','orbit','flashcards','asteroids','rhyme','sort'];
 for(let i=0;i<100;i++){send(p,{kind:'start',game:games[i%games.length],deck:'words'});const q=p.session.q;assert.ok(!recent.slice(-10).includes(q.word),`${i}: ${q.word}`);recent.push(q.word);p=JSON.parse(JSON.stringify(p));}
 assert.equal(p.xp,0);assert.equal(p.variety.serial,100);assert.equal(p.builder.stage,1);assert.equal(p.drills['orbit:words'].stage,1);
});
test('Blaster varies whole words, gap positions and answer letters without forcing a harder level',()=>{
 const p=fresh('beginner'),words=new Set(),positions=new Set(),letters=new Set();
 for(let i=0;i<72;i++){send(p,{kind:'start',game:'blaster'});const q=p.session.q;words.add(q.word);positions.add(q.position);letters.add(q.answer);assert.equal(q.stage,1);assert.equal(q.options.length,2);assert.equal(q.word.length,3);}
 assert.equal(words.size,72);assert.equal(positions.size,3);assert.ok(letters.size>=16);assert.equal(BUILDER_STARTERS.length,new Set(BUILDER_STARTERS).size);
});
test('Rhyme and cargo sequences expose every member, not one fixed member per family',()=>{
 for(const game of ['rhyme','sort']){const words=new Set();for(let n=0;n<144;n++)words.add(question(game,1,n).word);assert.equal(words.size,48);}
 assert.equal(WORDS[0].length,24);
});
test('Existing saves seed recency without changing earned progress or a submitted answer',()=>{
 const p=fresh('beginner');p.xp=888;p.session={game:'builder',q:{word:'cat'},results:[]};
 send(p,{kind:'start',game:'orbit'});assert.notEqual(p.session.q.word,'cat');assert.equal(p.xp,888);assert.ok(p.variety.recent.includes('cat'));
 const q=structuredClone(p.session.q),history=structuredClone(p.variety);send(p,{kind:'draft',draft:[...q.answer]});send(p,{kind:'answer',durationMs:2500});assert.deepEqual(p.session.q,q);assert.deepEqual(p.variety,history);
});
test('All shared-scheduler prompts, hints and builder confirmations have a voice entry',()=>{
 const lines=new Set(voiceLines()),p=fresh('admin');for(const game of ['blaster','builder','orbit','flashcards','asteroids','rhyme','sort'])for(let n=0;n<144;n++){send(p,{kind:'start',game});const q=p.session.q;assert.ok(lines.has(q.prompt),q.prompt);assert.ok(lines.has(q.help),q.help);if(game==='builder')assert.ok(lines.has(`Yes! ${q.word}.`));}
});
