import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,startDuel,startAdventure,nextChallenge,applyAttempt,expectedAnswer,WORDS,DUEL_LEVELS,recommendedDuelLevel,questBoard,claimQuest} from '../public/engine.mjs';
import {matchLobby,matchReview,questsView,navItems,routeTab,mazeHome} from '../public/hub.mjs';

const answer=(p,ok=true,helped=false)=>{const c=nextChallenge(p);return applyAttempt(p,c,{answer:ok?expectedAnswer(c):'?',durationMs:8000,helped,strokes:c.paths});};
test('Each child gets their preferred maze first without changing progress or removing either route',()=>{
 for(const id of ['explorer','beginner']){
  const p=freshProfile(id);p.maze={level:65};p.rescue={mission:15};
  const before=JSON.stringify(p),primary=id==='explorer'?'maze':'rescue',other=primary==='maze'?'rescue':'maze';
  const home=mazeHome(p),nav=navItems(primary,p);
  assert.match(home,new RegExp(`class="button primary" data-action="tab:${primary}"`));
  assert.match(home,new RegExp(`class="button secondary" data-action="tab:${other}"`));
  assert.ok(home.indexOf('tab:'+primary)<home.indexOf('tab:'+other));
  assert.match(home,id==='explorer'?/LEVEL 65/:/RESCUE 15/);
  assert.match(nav,new RegExp(`data-action="tab:${primary}"[^>]*aria-current="page"`));
  assert.equal(JSON.stringify(p),before);
  assert.equal(routeTab('#maze'),'maze');assert.equal(routeTab('#rescue'),'rescue');
 }
 for(const id of ['admin','demo'])assert.equal(mazeHome(freshProfile(id)),'');
 const p=freshProfile('explorer');p.name='<img src=x onerror=alert(1)>';
 assert.doesNotMatch(mazeHome(p),/<img/);assert.match(mazeHome(p),/Play letter labyrinth/);
});
test('Match levels change word length, choices and trails without repeated words in one match',()=>{
 for(const {id} of DUEL_LEVELS){
  const p=freshProfile();startDuel(p,id);const words=[];
  for(let i=0;i<5;i++){
   const c=nextChallenge(p);assert.equal(c.difficulty,id);
   if(c.word){assert.equal(WORDS.find(w=>w.word===c.word).tier,id);assert.ok(!words.includes(c.word));words.push(c.word);}
   if(c.type==='spell')assert.equal(c.options.length===26,id===3);
   if(c.type==='sequence')assert.equal(c.letters.length,id===3?5:3);
   answer(p);
  }
 }
 assert.throws(()=>startDuel(freshProfile(),99));
});
test('Adventure really pauses a match, preserves tracing retry, and resume keeps score',()=>{
 const p=freshProfile();p.retryTrace='a';startDuel(p,2);answer(p);
 const before={...p.duel},old=nextChallenge(p).id;startAdventure(p);
 assert.equal(p.duel.paused,true);assert.equal(nextChallenge(p).type,'trace');assert.equal(nextChallenge(p).char,'a');
 answer(p);startDuel(p,3);
 assert.equal(p.duel.paused,false);assert.equal(p.duel.difficulty,2);assert.equal(p.duel.you,before.you);assert.equal(p.duel.round,1);assert.notEqual(nextChallenge(p).id,old);
});
test('Match notebook persists review evidence and suggests harder play only after independent success',()=>{
 const p=freshProfile('beginner');assert.equal(recommendedDuelLevel(p),1);startDuel(p);
 for(let i=0;i<5;i++)answer(p,true,i===0);
 assert.equal(p.duelHistory[0].independent,4);assert.equal(p.duelHistory[0].rounds.length,5);assert.equal(p.duelStats.played,1);assert.equal(recommendedDuelLevel(p),1);
 startDuel(p);for(let i=0;i<5;i++)answer(p);assert.equal(recommendedDuelLevel(p),2);
 startDuel(p);for(let i=0;i<5;i++)answer(p,true,true);
 assert.equal(recommendedDuelLevel(p),1);assert.equal(p.duelStats.played,3);
 assert.deepEqual(JSON.parse(JSON.stringify(p)).duelHistory,p.duelHistory);
});
test('Quest rewards are earned once, never expire, and all three claims unlock the next set',()=>{
 const p=freshProfile();const original=JSON.stringify(p);assert.equal(questBoard(p).chapter,1);assert.equal(JSON.stringify(p),original);assert.equal(claimQuest(p,'0:moves'),false);
 startDuel(p,2);for(let i=0;i<5;i++)answer(p);
 const gems=p.gems,board=questBoard(p);assert.ok(board.quests.every(q=>q.progress===q.target));
 for(const q of board.quests){assert.equal(claimQuest(p,q.id).gems,10);assert.equal(claimQuest(p,q.id),false);}
 assert.equal(p.gems,gems+30);assert.equal(questBoard(p).chapter,2);assert.ok(questBoard(p).quests.every(q=>q.progress===0));
 assert.equal(claimQuest(p,'999:moves'),false);
});
test('Hub navigation, lobby, quests and reviews render safely for old and new profiles',()=>{
 const p=freshProfile();assert.equal(routeTab('#matches'),'matches');assert.equal(routeTab('#bogus'),'practice');
 assert.match(navItems('matches',p),/aria-current="page"/);assert.match(matchLobby(p),/Your first match is waiting/);assert.match(questsView(p),/No deadlines/);
 startDuel(p,3);for(let i=0;i<5;i++)answer(p,i!==0);const match=p.duelHistory[0];
 assert.match(matchLobby(p),/Review/);assert.match(matchReview(p,match.id),/Try this next time/);
 p.name='<script>bad()</script>';assert.doesNotMatch(matchLobby(p),/<script>/);assert.match(matchLobby(p),/&lt;script&gt;/);
});
test('Every challenge invalidates pre-redesign tabs, including unchanged profile revisions',()=>{
 for(const id of ['admin','beginner','explorer']){
  const p=freshProfile(id);
  for(const seq of [0,13,49,51,52]){p.seq=seq;assert.ok(nextChallenge(p).id.endsWith(':story1'));}
  p.retryTrace='a';assert.ok(nextChallenge(p).id.endsWith(':story1'));
  startDuel(p);assert.ok(nextChallenge(p).id.endsWith(':story1'));
 }
});
