import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarrationGate, narrationFor } from '../public/chess/narration.mjs';
import { freshChess, applyChessDefaults, actChess, lessonPuzzles, publicChess } from '../chess-state.mjs';

const action = (p, type, extra = {}) => actChess(p, {
  type, ...extra, revision: p.revision, requestId: crypto.randomUUID(),
});

test('Repeated task speech and hints stay quiet; explicit replay still works', () => {
  let time = 0;
  const allow = createNarrationGate(() => time);
  assert.equal(allow('Find two threats.'), true);
  time = 3000;
  assert.equal(allow('Find two threats.'), false);
  assert.equal(allow('Try a different automatic cue.'), false);
  assert.equal(allow('Look at the knight.', {kind:'hint'}), true);
  time = 4000;
  assert.equal(allow('Look at the knight.', {kind:'hint'}), false);
  assert.equal(allow('Look at the knight.', {force:true}), true);
  assert.equal(allow('Move the bishop.', {kind:'hint'}), true);
  time = 90001;
  assert.equal(allow('Find two threats.'), true);
});

test('Five repeated positions speak their task once while moves remain quiet', () => {
  const p = {session:{phase:'puzzle',feedback:{voice:'Try the knight.'}}};
  for (const action of ['start','move','game-move','retry-puzzle','game-undo','settings'])
    assert.equal(narrationFor(action,p,'Find two threats.'),null);
  let time=0,played=0;
  const allow=createNarrationGate(()=>time);
  for(let position=0;position<5;position++){
    const cue=narrationFor(position?'next':'begin',p,'Find two threats.');
    if(allow(cue.text,{kind:cue.kind}))played++;
    time+=10000;
  }
  assert.equal(played,1);
  assert.equal(narrationFor('hint',p,'').text,'Try the knight.');
});

test('Per-player defaults separate new lessons while preserving ongoing boards and manual choices', async () => {
  const p=freshChess();
  await action(p,'start',{lesson:'forcing-1'});
  await action(p,'begin');
  await action(p,'hint');
  const active=JSON.stringify(p.session),revision=p.revision;
  p.game={fen:'saved board',strength:'club'};
  applyChessDefaults(p,{band:'guided',strength:'friendly'});
  assert.equal(JSON.stringify(p.session),active);
  assert.equal(p.revision,revision);
  assert.equal(p.game.strength,'club');
  assert.equal(p.settings.band,'guided');
  const restored=JSON.parse(JSON.stringify(p));
  await action(restored,'start',{lesson:'forcing-2'});
  assert.deepEqual(restored.session.ids,lessonPuzzles('forcing-2','guided'));
  const advanced=applyChessDefaults(freshChess(),{band:'stretch',strength:'club'});
  await action(advanced,'start',{lesson:'forcing-2'});
  assert.notDeepEqual(restored.session.ids,advanced.session.ids);
  await action(restored,'settings',{band:'stretch',strength:'challenge'});
  applyChessDefaults(restored,{band:'guided',strength:'friendly'});
  assert.equal(restored.settings.band,'stretch');
  assert.equal(restored.settings.strength,'challenge');
});


test('Easier review never pulls harder puzzles from an earlier band; old review evidence remains', async () => {
  const p=freshChess();
  const prior=lessonPuzzles('forcing-1','stretch')[0];
  p.review[prior]={successes:0,due:0,needsPractice:true};
  applyChessDefaults(p,{band:'guided'});
  assert.equal(publicChess(p).reviewDue,0);
  await action(p,'start',{lesson:'review'});
  assert.deepEqual(p.session.ids,lessonPuzzles('forcing-1','guided'));
  assert.equal(p.review[prior].needsPractice,true);
  await action(p,'settings',{band:'stretch'});
  assert.equal(publicChess(p).reviewDue,1);
});


test('Small steps speaks the one necessary follow-up in a two-move fork, without routine move chatter',()=>{
 const p={session:{band:'steps',phase:'puzzle',ply:2}};assert.match(narrationFor('move',p,'').text,/take the rook/);p.session.phase='solved';assert.equal(narrationFor('move',p,''),null);
});


test('Task repeats stay quiet after long pauses, while replay and next lesson remain available',()=>{
 let time=0;const gate=createNarrationGate(()=>time);
 assert(gate('Rook to the star.',{kind:'task',scope:'one'}));
 time+=120000;assert.equal(gate('Rook to the star.',{kind:'task',scope:'one'}),false);
 assert(gate('Rook to the star.',{force:true,scope:'one'}));
 assert(gate('Now take the rook.',{kind:'continuation',scope:'one'}));
 time+=120000;assert.equal(gate('Now take the rook.',{kind:'continuation',scope:'one'}),false);
 assert(gate('Rook to the star.',{kind:'task',scope:'two'}));
});
