import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activityFor, rankPlay, menuOrderService } from '../menu-order.mjs';
import { CATALOG } from '../public/catalog.mjs';
const NOW = Date.parse('2026-09-15T12:00:00Z'), DAY = 86400000;
const point = (game, minutes, player = 'beginner') => ({game, player, at: NOW - minutes * 60000});

test('Old storage routes follow the refactored families; hints, voices and settings do not count', () => {
  for (const type of ['maze_action', 'rescue_action']) {
    assert.equal(activityFor('letter-quest', {type, input:{kind:'forward'}}),'maze-garden');
    assert.equal(activityFor('letter-quest', {type, input:{kind:'hint'}}),null);
  }
  assert.equal(activityFor('letter-quest',{type:'soccer_action',input:{kind:'answer'}}),'dribble-duel');
  assert.equal(activityFor('letter-quest',{type:'story_action',input:{kind:'move'}}),'letter-quest');
  assert.equal(activityFor('letter-quest',{type:'profile_action',action:'maze'}),null);
  assert.equal(activityFor('hub',{type:'client',kind:'chess_voice_play'}),null);
  assert.equal(activityFor('hub',{type:'chess',action:'hint'}),null);
  assert.equal(activityFor('hub',{type:'chess',action:'game-move'}),'chess');
  assert.equal(activityFor('target-trail',{type:'rejected',input:{type:'shot'}}),null);
  assert.equal(activityFor('three-in-a-row',{type:'action',input:{type:'bot'}}),null);
});
test('Frequency uses distinct sessions, not click volume, and keeps the players separate', () => {
  const manyMoves = Array.from({length:500},(_,i)=>point('maze-garden',100 + i/100));
  const events = [...manyMoves, point('chess',90),point('chess',60),point('number-park',2,'explorer')];
  const before=JSON.stringify(events), ranked=rankPlay(events,'beginner',NOW);
  assert.equal(ranked.visits['maze-garden'],1);
  assert.equal(ranked.visits.chess,2);
  assert.equal(ranked.order[0],'chess');
  assert.equal(rankPlay(events,'explorer',NOW).order[0],'number-park');
  assert.equal(JSON.stringify(events),before);
  assert.equal(new Set(ranked.order).size,8);
});
test('Recent visits outweigh old play, stale/future rows expire, ties are stable and daily repeats capped', () => {
  const events=[point('chess',1),point('maze-garden',12*1440),point('maze-garden',13*1440),point('word-arcade',15*1440),point('target-trail',-1)];
  assert.equal(rankPlay(events,'beginner',NOW).order[0],'chess');
  assert.equal(rankPlay(events,'beginner',NOW).visits['word-arcade'],0);
  assert.equal(rankPlay(events,'beginner',NOW).visits['target-trail'],0);
  assert.deepEqual(rankPlay([],'beginner',NOW).order,CATALOG.map(g=>g.id));
  assert.equal(rankPlay(Array.from({length:20},(_,i)=>point('chess',i*11)),'beginner',NOW).visits.chess,6);
  assert.deepEqual(rankPlay(events,'beginner',NOW+15*DAY).order,CATALOG.map(g=>g.id));
});
test('Log service reads rotated files, tolerates incomplete rows, refreshes new play and excludes reset test progress', async () => {
  const dir=await mkdtemp(join(tmpdir(),'menu-rank-'));let now=NOW;
  const file=join(dir,'2026-09-15-000.jsonl');
  const row=(type,minutes,extra={})=>JSON.stringify({type,player:'beginner',at:new Date(NOW-minutes*60000).toISOString(),...extra})+'\n';
  await writeFile(file,row('attempt',100)+row('profile_reset_completed',90)+row('maze_action',10,{input:{kind:'forward'}})+'{"partial":');
  const service=menuOrderService({sources:{'letter-quest':dir,hub:join(dir,'missing')},players:['beginner','explorer'],clock:()=>now});
  const first=await service.ranking('beginner');
  assert.equal(first.order[0],'maze-garden');assert.equal(first.visits['letter-quest'],0);
  await appendFile(file,'true}\n'+row('attempt',1)+row('attempt',20));now+=61000;
  assert.equal((await service.ranking('beginner')).order[0],'letter-quest');
  assert.deepEqual((await service.ranking('explorer')).order,CATALOG.map(g=>g.id));
  await assert.rejects(service.ranking('unknown'));
});
