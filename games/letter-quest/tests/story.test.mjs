import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,startDuel,nextChallenge,applyAttempt,useMatchHint,expectedAnswer} from '../public/engine.mjs';
import {storyState,storyBoard,storyRoute,storyAction,storyVoiceLines,STORY_RESCUES,STORY_CHAPTERS} from '../public/story.mjs';
import {storyView} from '../public/story-ui.mjs';
import {allVoiceLines} from '../public/dialogue.mjs';
import {summarize} from '../diagnostic-report.mjs';
test('Local reports separate story movement, help and rescues from literacy mastery',async()=>{
 const rows=['move','blocked','hint','wrong','won'].map(kind=>({type:'story_action',player:'beginner',session:'test-story',input:{kind:kind==='hint'?'hint':'move'},result:{kind}}));
 const r=await summarize(rows);assert.equal(r.attempts,0);assert.deepEqual(r.skills,[]);
 assert.deepEqual(r.stories,[{player:'beginner',actions:5,moves:3,blocked:1,wrongOrder:1,hints:1,rescues:1}]);
 assert.deepEqual((await summarize(rows,{player:'explorer'})).stories,[]);
});
test('Exactly one point per match round, with server-owned immediate and idempotent hint points',()=>{
 const p=freshProfile('beginner');startDuel(p,1);
 const c=nextChallenge(p),revision=p.revision;useMatchHint(p);
 assert.equal(p.duel.rook,1);assert.equal(p.duel.round,0);assert.equal(p.revision,revision+1);
 useMatchHint(p);assert.equal(p.duel.rook,1);assert.equal(p.revision,revision+1);
 const after=nextChallenge(p);assert.equal(after.word,c.word);assert.notEqual(after.id,c.id);
 let r=applyAttempt(p,after,{answer:expectedAnswer(after),helped:false,durationMs:1000});
 assert.equal(r.duel.alreadyAwarded,true);assert.equal(r.duel.you,0);assert.equal(r.duel.rook,1);assert.equal(p.history.at(-1).helped,true);
 for(let i=1;i<5;i++){
  const c=nextChallenge(p);r=applyAttempt(p,c,{answer:i===2?'?':expectedAnswer(c),helped:false,durationMs:6000});
  assert.equal(r.duel.you+r.duel.rook,i+1);
 }
 assert.equal(p.duel.you,3);assert.equal(p.duel.rook,2);assert.equal(p.duel.outcome,'win');
});
test('Older in-progress matches retain past scores and mark the scoring boundary',()=>{
 const p=freshProfile();startDuel(p);delete p.duel.scoring;p.duel.round=2;p.duel.you=2;p.duel.rook=2;
 useMatchHint(p);assert.deepEqual(p.duel.carriedScore,{rounds:2,you:2,rook:2});assert.equal(p.duel.rook,3);assert.equal(p.duel.you,2);
});
test('All written rescues and repeat voyages are solvable, continuing beyond the old ending without duplicate rewards',()=>{
 const p=freshProfile('beginner'),original=JSON.stringify(p);storyState(p);storyBoard(p);storyRoute(p);assert.equal(JSON.stringify(p),original);
 assert.equal(storyState(p).guided,true);
 for(let chapter=0;chapter<STORY_RESCUES*3;chapter++){
  let moves=0;
  while(!storyState(p).done){const route=storyRoute(p);assert.ok(route.length>1);storyAction(p,{kind:'move',position:route[1]});assert.ok(++moves<100);}
  assert.equal(p.xp,(chapter+1)*20);assert.equal(p.gems,(chapter+1)*5);
  assert.throws(()=>storyAction(p,{kind:'move',position:3}));
  storyAction(p,{kind:'next'});
 }
 assert.equal(storyBoard(p).finished,false);assert.equal(p.story.history.length,STORY_RESCUES*3);
 assert.throws(()=>storyAction(p,{kind:'next'}));assert.equal(p.xp,STORY_RESCUES*3*20);assert.deepEqual(p.skills,{});assert.equal(p.seq,0);
 assert.equal(storyBoard(p).voyage,4);
});
test('An old chapter-nine ending resumes at the snow island without modifying earned rescues',()=>{
 const p=freshProfile('explorer');p.story={...storyState(p),chapter:9,history:Array.from({length:9},(_,chapter)=>({chapter})),done:false};p.xp=180;
 const before=structuredClone(p),b=storyBoard(p);assert.equal(b.episode.theme,'ice');assert.equal(b.word,'snow');assert.equal(b.finished,false);assert.deepEqual(p,before);
 assert.doesNotMatch(storyView(p),/More chapters are not built|adventure complete/);
 const themes=new Set(),layouts=new Set();for(let chapter=9;chapter<81;chapter++){p.story.chapter=chapter;const board=storyBoard(p);themes.add(board.episode.theme);layouts.add(JSON.stringify([board.blocked,board.letters]));assert.equal(new Set(board.letters.map(l=>l.position)).size,board.word.length);}
 assert.equal(themes.size,STORY_CHAPTERS.length);assert.equal(STORY_RESCUES,63);assert.ok(layouts.size>35);
});
test('Story prevents teleporting and invalid moves; wrong-order keys do not disappear',()=>{
 const p=freshProfile(),snapshot=JSON.stringify(p);assert.equal(storyAction(p,{kind:'move',position:4}).kind,'blocked');
 assert.equal(p.revision,0);assert.equal(storyState(p).position,15);assert.equal(p.xp,0);
 for(const position of [16,17,12])storyAction(p,{kind:'move',position});
 assert.equal(p.story.collected,0);assert.equal(p.story.mistakes,1);
 storyAction(p,{kind:'hint'});assert.equal(p.story.hints,1);assert.equal(p.gems,0);assert.equal(p.story.position,12);
 assert.throws(()=>storyAction(p,{kind:'move',position:NaN}));
 const restored=JSON.parse(JSON.stringify(p));assert.deepEqual(storyRoute(restored),storyRoute(p));
 p.name='<img onerror=evil>';assert.doesNotMatch(storyView(p),/<img onerror/);assert.match(storyView(p),/&lt;img/);
 assert.equal(storyState(freshProfile('beginner')).position,15);
});
test('Story narration and letter prompts are included in the American voice inventory',()=>{
 const lines=new Set(allVoiceLines());for(const line of storyVoiceLines())assert.ok(lines.has(line));
});
