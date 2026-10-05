import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {skillEvidence} from '../skill-evidence.mjs';
import {skillModel, firstAnswers, normalizeProfile, ageWeight, cardFit, nudgeCandidates, primarySkill, SKILLS, CARD_FIT} from '../skill-model.mjs';
import {smartHome, TEMPLATE} from '../home-order.mjs';
import {menuOrderService} from '../menu-order.mjs';
import {SHORTCUTS} from '../public/home-shortcuts.mjs';
import {CATALOG} from '../public/catalog.mjs';

// Synthetic players only. 10:00 EDT on a Thursday; local midnight is 04:00Z.
const DAY = 86400000, TZ = 'America/New_York';
const NOW = Date.parse('2026-10-01T14:00:00Z'), MIDNIGHT = Date.parse('2026-10-01T04:00:00Z');
const at = (daysAgo, minutes = 0) => MIDNIGHT - daysAgo * DAY - 2 * 3600000 + minutes * 60000;
let serial = 0;
// n answers for a skill on the given days: `ind` independent, `help` correct with help, the rest missed.
function answers(skill, keys, {n, ind, help = 0, days = [1, 2, 3, 4, 5], player = 'a'}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = i < ind ? 'ind' : i < ind + help ? 'help' : 'miss';
    out.push({player, skill, keys, item: `${skill}:${serial++}`, ok: kind !== 'miss', help: kind === 'help', at: at(days[i % days.length], i)});
  }
  return out;
}
const visits = (game, days, sub = null) => days.map(d => ({player: 'a', game, sub, at: at(d)}));

test('Evidence: each game gives first-try answers with help kept apart; voice, settings and menus are not evidence', () => {
  const lq = skillEvidence('letter-quest', {type: 'maze_action', input: {kind: 'answer'}, result: {ok: true, helped: true, question: {id: 'm1', type: 'blend'}}});
  assert.deepEqual(lq, [{skill: 'reading', keys: ['maze-garden', 'lq:maze'], item: 'lq:m1', ok: true, help: true,task:'blend',readTask:false,choices:0,ms:null}]);
  assert.equal(skillEvidence('letter-quest', {type: 'attempt', challenge: {id: 'c', type: 'sequence'}, input: {helped: false}, result: {ok: false}})[0].skill, 'sounds');
  assert.equal(skillEvidence('letter-quest', {type: 'attempt', challenge: {id: 'c', type: 'trace'}, input: {}, result: {ok: true}})[0].skill, 'motor');
  assert.equal(skillEvidence('letter-quest', {type: 'reading_action', input: {kind: 'answer'}, result: {kind: 'writing'}})[0].ok, null);
  const shot = skillEvidence('letter-quest', {type: 'soccer_action', input: {kind: 'answer'}, result: {kind: 'save', shot: {correct: false, helped: false, question: {id: 's', type: 'word'}}}})[0];
  assert.equal(shot.skill, 'reading'); assert.equal(shot.ok, false);
  assert.equal(skillEvidence('letter-quest', {type: 'rescue_action', input: {kind: 'forward', mission: 7}, after: {helped: true}, result: {kind: 'complete'}})[0].help, true);
  assert.equal(skillEvidence('letter-quest', {type: 'profile_action', action: 'settings'}), null);
  // Word Arcade: the slalom's letter track is letter sounds; a help row marks the item.
  assert.equal(skillEvidence('word-arcade', {type: 'action', input: {kind: 'answer', questionId: '3:0'}, after: {game: 'slalom', run: 3, q: {id:'3:0',type: 'first-letter'}}, result: {ok: true}})[0].skill, 'sounds');
  assert.equal(skillEvidence('word-arcade', {type: 'action', input: {kind: 'answer', questionId: '3:0'}, after: {game: 'slalom', run: 3, q: {id:'3:0',type: 'read-word'}}, result: {ok: true}})[0].keys[0], 'letter-slalom');
  assert.equal(skillEvidence('word-arcade', {type: 'action', input: {kind: 'help', questionId: '4:1'}, before:{q:{id:'4:1',game:'builder'}},after: {game: 'builder', run: 4}})[0].hint, true);
  assert.equal(skillEvidence('word-arcade', {type: 'client', event: {kind: 'voice'}}), null);
  // Number Park: equal-sharing cookies past one-for-you and times tables are multiplication/division.
  const np = (kind, question, result, extra = {}) => skillEvidence('number-park', {type: 'action', input: {kind}, after: {question, result, ...extra}});
  assert.equal(np('cookie-answer', {id: 'q1', kind: 'cookies', mode: 'bags', level: 4}, {ok: true, helped: false})[0].skill, 'muldiv');
  assert.equal(np('answer', {id: 'q2', kind: 'cookies', level: 1}, {ok: true, helped: false})[0].skill, 'number');
  assert.equal(np('answer', {id: 'q3', kind: 'factor'}, {ok: false, helped: false})[0].skill, 'muldiv');
  assert.deepEqual(np('answer', {id: 'q4', kind: 'pattern'}, {ok: true, helped: true})[0].keys, ['number-park', 'np:pattern']);
  assert.equal(np('cookie-check', {id: 'q5', kind: 'cookies', mode: 'share', level: 2}, null, {cookieMessage: 'Not equal yet.'})[0].ok, false);
  assert.equal(np('cookie-check', {id: 'q5', kind: 'cookies'}, null), null);
  assert.equal(np('voice', {}, null), null);
  assert.equal(skillEvidence('number-park', {type: 'action', input: {kind: 'trace'}})[0].skill, 'motor');
  // Maze Garden completion: independent = no hints; Three in a Row: a finished game, not losing = success.
  assert.equal(skillEvidence('maze-garden', {event: 'moves', completed: {id: 'z', independent: false}})[0].help, true);
  assert.equal(skillEvidence('maze-garden', {event: 'hint'}), null);
  assert.equal(skillEvidence('three-in-a-row', {type: 'action', game: {id: 'g1', mode: 'play', phase: 'done', winner: 'O', youMark: 'X', helped: false}})[0].ok, false);
  assert.equal(skillEvidence('three-in-a-row', {type: 'action', game: {id: 'g1', mode: 'play', phase: 'you'}}), null);
  // Chess: a puzzle position per day; a hint row marks it.
  const move = skillEvidence('hub', {type: 'chess', action: 'move', lesson: 'l', position: 'p', result: {correct: true}}, at(1))[0];
  const hint = skillEvidence('hub', {type: 'chess', action: 'hint', lesson: 'l', position: 'p', result: {}}, at(1))[0];
  assert.equal(move.item, hint.item); assert.equal(hint.hint, true);
  assert.equal(skillEvidence('hub', {type: 'client', kind: 'chess_voice_play'}), null);
  assert.equal(skillEvidence('hub', {type: 'dribble-live', input: {type: 'live-reading-answer'}, result: {kind: 'reading-done', id: 'r1', tier: 0, errors: 1, helped: false}}, at(1))[0].ok, false);
  assert.equal(skillEvidence('nope', {}), null); assert.equal(skillEvidence('number-park', null), null);
});

test('block-building checks reach number evidence; a corrected retry never erases the first miss', () => {
  const question = {id: 'blocks-1', kind: 'place', placeMode: 'build', target: [3, 2, 4]};
  const extract = (after, minute) => skillEvidence('number-park', {
    type: 'action', input: {kind: 'place-check'}, before: {}, after: {question, ...after},
  }).map(e => ({...e, player: 'a', at: at(1, minute)}));
  const independent = extract({result: {ok: true, helped: false}}, 0);
  assert.deepEqual(independent[0].tags, ['place:tens']);
  assert.equal(independent[0].skill, 'number'); assert.equal(independent[0].help, false);
  const missed = extract({placeChecks: 1, placeMessage: 'Check the tens.'}, 0);
  const corrected = extract({result: {ok: true, helped: true}}, 1);
  const {firsts} = firstAnswers([...missed, ...corrected], 'a', MIDNIGHT);
  assert.equal(firsts.length, 1); assert.equal(firsts[0].ok, false);
  assert.equal(skillEvidence('number-park', {type: 'action', input: {kind: 'place-check'}, after: {question}}), null);
});

test('First answers only: retries after a miss never count, and a hint before the first answer marks it helped', () => {
  const rows = [
    {player: 'a', skill: 'reading', item: 'x', ok: false, help: false, at: at(1, 0)},
    {player: 'a', skill: 'reading', item: 'x', ok: true, help: false, at: at(1, 1)},
    {player: 'a', skill: 'chess', item: 'p', hint: true, at: at(1, 2)},
    {player: 'a', skill: 'chess', item: 'p', ok: true, help: false, at: at(1, 3)},
    {player: 'a', skill: 'chess', item: 'q', ok: true, help: false, at: at(1, 4)},
    {player: 'a', skill: 'chess', item: 'q', hint: true, at: at(1, 5)},
    {player: 'a', skill: 'motor', ok: null, at: at(1, 6)},
    {player: 'b', skill: 'reading', item: 'y', ok: true, help: false, at: at(1, 7)},
    {player: 'a', skill: 'reading', item: 'z', ok: true, help: false, at: MIDNIGHT + 60000}, // after midnight: tomorrow
  ];
  const {firsts, practice} = firstAnswers(rows, 'a', MIDNIGHT);
  assert.deepEqual(firsts.map(f => [f.item ?? f.skill, f.ok, f.help]), [['reading', false, false], ['chess', true, true], ['chess', true, false]]);
  assert.equal(practice.motor.length, 1); assert.equal(practice.reading.length, 2);
});

test('Skill model: independence, help, misses, trend, practice days and the edge/stretch/too-easy/too-hard bands', () => {
  const evidence = [
    ...answers('reading', ['word-arcade'], {n: 20, ind: 13, help: 4}),                       // 65%: edge
    ...answers('sounds', ['hunt'], {n: 20, ind: 8, help: 9}),                                 // 40%, mostly help: stretch
    ...answers('number', ['number-park'], {n: 20, ind: 20}),                                  // 100%: too easy
    ...answers('muldiv', ['number-park'], {n: 10, ind: 1, help: 2}),                          // 10%, mostly misses: too hard
    ...answers('chess', ['chess'], {n: 10, ind: 9, days: [20, 21]}),                          // old: falls back to older items
    ...answers('planning', ['maze-garden'], {n: 6, ind: 1, days: [10, 11]}),
    ...answers('planning', ['maze-garden'], {n: 6, ind: 5, days: [1, 2]}),
  ];
  const {skills} = skillModel({evidence, player: 'a', cutoff: MIDNIGHT, profile: {age: 8}});
  assert.equal(skills.reading.status, 'edge'); assert.equal(skills.reading.ind, 0.65); assert.equal(skills.reading.assisted, 0.2); assert.equal(skills.reading.miss, 0.15);
  assert.equal(skills.sounds.status, 'stretch');
  assert.equal(skills.number.status, 'too-easy'); assert.equal(skills.number.need, 0);
  assert.equal(skills.muldiv.status, 'too-hard'); assert.equal(skills.muldiv.need, 0);
  assert.equal(skills.chess.window, 'older'); assert.equal(skills.chess.daysSince, 21);
  assert.equal(skills.reading.days14, 5); assert.equal(skills.reading.days7, 5); assert.equal(skills.reading.daysSince, 2);
  assert.equal(skills.planning.trend, 0.67);
  assert.equal(skills.motor.status, 'unknown'); assert.equal(skills.motor.daysSince, null);
});

test('Profile: private priorities are validated; age decides which skills matter now; outside reports add weight', () => {
  assert.deepEqual(normalizeProfile(null), {age: null, context: {}, focus: {}});
  assert.deepEqual(normalizeProfile({age: 'x', context: {reading: 9, bogus: 1, sounds: 'a'}, reports: 'no'}), {age: null, context: {reading: 2}, focus: {}});
  assert.deepEqual(normalizeProfile({age: 6, focus: {motor: 0.5}, reports: [{focus: {motor: 1, chess: -3}}, null]}).focus, {motor: 1, chess: 0});
  assert.equal(ageWeight('muldiv', 5), 0); assert.equal(ageWeight('muldiv', 9), 1); assert.equal(ageWeight('sounds', 8), 0.5);
  assert.equal(ageWeight('reading', null), 0.6); assert.equal(ageWeight('nope', 8), 0);
  const evidence = answers('motor', ['drawing-studio'], {n: 10, ind: 6});
  const plain = skillModel({evidence, player: 'a', cutoff: MIDNIGHT, profile: {age: 6}}).skills.motor.need;
  const reported = skillModel({evidence, player: 'a', cutoff: MIDNIGHT, profile: {age: 6, reports: [{source: 'synthetic OT report', focus: {motor: 1}}]}}).skills.motor.need;
  assert.ok(reported > plain * 1.9, `${reported} vs ${plain}`);
  for (const [card, spec] of Object.entries(CARD_FIT)) { assert.ok(CATALOG.some(c => c.id === card) || SHORTCUTS.some(s => s.id === card), card); for (const s of Object.keys(spec.skills)) assert.ok(SKILLS[s], s); }
  assert.equal(primarySkill('snack-friend'), 'muldiv'); assert.equal(primarySkill('nope'), null);
});

test('Card fit: what the card practises, for his age, where he succeeds; never a card he finds too easy or too hard', () => {
  const firsts = (key, n, ind) => answers('reading', [key], {n, ind}).map(e => ({...e, help: false}));
  const fit = (card, skill, list, age = 8) => cardFit(card, skill, {age, firsts: list, cutoff: MIDNIGHT});
  assert.equal(fit('cookie-share', 'number', [], 8).fit, 0);            // a younger child's sharing card
  assert.equal(fit('snack-friend', 'muldiv', [], 5).fit, 0);          // division is not for a five-year-old
  assert.equal(fit('chess', 'reading', []).fit, 0);
  assert.equal(fit('word-arcade', 'reading', firsts('word-arcade', 10, 10)).note, 'too easy here');
  assert.equal(fit('word-arcade', 'reading', firsts('word-arcade', 10, 1)).fit, 0);
  assert.equal(fit('word-arcade', 'reading', firsts('word-arcade', 10, 7)).fit, 1);
  assert.equal(fit('word-arcade', 'reading', []).fit, 0.85);
  // A shortcut card reads its own activity's evidence.
  assert.equal(fit('letter-labyrinth', 'reading', firsts('lq:maze', 10, 10)).note, 'too easy here');
});

// A synthetic eight-year-old profile: reading is a stretch and a stated priority, chess is played most,
// times tables at the edge, letter sounds secure.
function eightYearOld() {
  const evidence = [
    ...answers('reading', ['word-arcade'], {n: 40, ind: 17, help: 13}),
    ...answers('reading', ['maze-garden', 'lq:maze'], {n: 20, ind: 12, help: 5}),
    ...answers('chess', ['chess'], {n: 40, ind: 26, help: 6}),
    ...answers('muldiv', ['number-park', 'np:cookies'], {n: 12, ind: 8, help: 2, days: [1, 6]}),
    ...answers('sounds', ['letter-slalom'], {n: 12, ind: 11}),
  ];
  const events = [...visits('chess', [0.5, 1, 2, 3]), ...visits('maze-garden', [1, 2, 3]), ...visits('three-in-a-row', [2, 4])];
  return {events, evidence, profile: {age: 8, context: {reading: 1, sounds: 0.5}}, shortcuts: ['snack-friend', 'maze-maker', 'letter-labyrinth']};
}
const home = (opts, extra = {}) => smartHome({player: 'a', now: NOW, timeZone: TZ, ...opts, ...extra});

test('Nudge: the growth area he can succeed at, not more of his favourite; logged with the evidence numbers', () => {
  const kid = eightYearOld(), h = home(kid);
  assert.equal(SKILLS[h.analytics.pick.skill].label, SKILLS.reading.label);
  assert.ok(['word-arcade', 'letter-labyrinth', 'letter-quest'].includes(h.nudge), h.nudge);
  assert.notEqual(h.nudge, 'chess');
  assert.equal(h.order[TEMPLATE.indexOf('N')], h.nudge);
  assert.match(h.why[h.nudge], /^nudge \(analytics\): decoding and reading words \[stretch\] \d+% independent first try, \d+% with help, \d+% missed \(n=\d+, 14d\)/);
  assert.match(h.why[h.nudge], /child-context priority 1; card: .*score [\d.]+ = need [\d.]+ x fit [\d.]+ x fresh 1/);
  assert.equal(h.skills.reading.status, 'stretch'); assert.equal(h.skills.chess.status, 'edge');
  assert.ok(h.analytics.candidates.length > 1 && h.analytics.candidates.every(c => !h.frequent.slice(0, 3).includes(c.card)));
  // Deterministic per child per day, whatever the row order or the time of day.
  assert.deepEqual(home({...kid, evidence: [...kid.evidence].reverse()}), h);
  assert.deepEqual(home(kid, {now: NOW + 9 * 3600000}).order, h.order);
});

test('Nudge: an age-inappropriate card, a skill he finds too easy, one that keeps failing, or his top cards are never nudged', () => {
  const kid = eightYearOld();
  const all = [];
  for (let d = 0; d < 7; d++) all.push(home(kid, {now: NOW + d * DAY}));
  for (const h of all) {
    assert.ok(!['cookie-share', 'take-away', 'pattern-parade', 'trace-numbers'].includes(h.nudge));
    assert.ok(!h.frequent.slice(0, 3).includes(h.nudge));
    assert.ok(h.nudge !== 'letter-slalom' || h.analytics.pick.skill !== 'sounds');
  }
  // A five-year-old with the same history: no division card, no reading card when reading keeps failing.
  const young = {...kid, profile: {age: 5}, evidence: [...answers('reading', ['word-arcade'], {n: 12, ind: 1, help: 1}), ...answers('number', ['number-park'], {n: 10, ind: 6, days: [9, 10]})], shortcuts: ['cookie-share', 'snack-friend']};
  const y = home(young);
  assert.equal(y.skills.reading.status, 'too-hard'); assert.equal(y.skills.muldiv.need, 0);
  assert.notEqual(y.nudge, 'snack-friend'); assert.notEqual(y.analytics.pick.skill, 'reading');
  assert.equal(y.analytics.pick.skill, 'number');
});

test('Nudge: an outside report (skills focus) changes the pick; empty or missing is neutral', () => {
  const kid = {...eightYearOld(), profile: {age: 7}};
  const base = home(kid);
  assert.deepEqual(home({...kid, profile: {...kid.profile, focus: {}, reports: []}}), base);
  assert.notEqual(base.analytics.pick.skill, 'motor');
  const report = home({...kid, profile: {...kid.profile, reports: [{source: 'synthetic OT report', focus: {motor: 2}}]}});
  assert.equal(report.analytics.pick.skill, 'motor');
  assert.match(report.why[report.nudge], /outside-report focus 2/);
});

test('Freshness: not the card nudged yesterday (from the hub log, or recomputed), and a rotation across the week', () => {
  const kid = eightYearOld(), today = home(kid);
  const tomorrow = home({...kid, shown: [{player: 'a', day: today.day, nudge: today.nudge, at: NOW}]}, {now: NOW + DAY});
  assert.notEqual(tomorrow.nudge, today.nudge); assert.equal(tomorrow.analytics.previous[0], today.nudge);
  // The other child's log rows are not his.
  assert.notEqual(today.nudge, 'hunt');
  assert.notEqual(home({...kid, shown: [{player: 'b', day: today.day, nudge: 'hunt'}]}, {now: NOW + DAY}).analytics.previous[0], 'hunt');
  // Without a log row the previous days are recomputed, so the same day always gives the same answer.
  assert.deepEqual(home(kid, {now: NOW + DAY}).nudge, home(kid, {now: NOW + DAY + 3600000}).nudge);
  const shown = [], picks = [];
  for (let d = 0; d < 7; d++) { const h = home({...kid, shown}, {now: NOW + d * DAY}); shown.push({player: 'a', day: h.day, nudge: h.nudge, at: NOW + d * DAY}); picks.push(h.nudge); }
  for (let d = 1; d < 7; d++) assert.notEqual(picks[d], picks[d - 1], picks.join());
  assert.ok(new Set(picks).size >= 3, picks.join());
});

test('Slots: favourites stay on top; the nudge is never above the third card, even with little play', () => {
  const kid = eightYearOld();
  for (const events of [[], visits('chess', [1]), kid.events]) {
    const h = home({...kid, events});
    assert.ok(h.nudge, 'evidence gives a nudge');
    assert.equal(h.order.indexOf(h.nudge), TEMPLATE.indexOf('N'));
    assert.equal(new Set(h.order).size, h.order.length);
  }
  const withFavourites = home({...kid, events: visits('chess', [1, 2])});
  assert.equal(withFavourites.order[0], 'chess');
  // Reviewed favourites fill the first row when there is no frequent play to show.
  const quiet = home({...kid, events: []});
  assert.ok(kid.shortcuts.includes(quiet.order[0]) || quiet.forgotten.includes(quiet.order[0]) || CATALOG.some(c => c.id === quiet.order[0]));
});

test('Override: a grown-ups list still forces the nudge; no evidence and no profile means no nudge', () => {
  const kid = eightYearOld();
  const forced = home({...kid, nudges: ['hunt']});
  assert.equal(forced.nudge, 'hunt'); assert.match(forced.why.hunt, /override/); assert.equal(forced.analytics, undefined);
  const none = home({events: [], evidence: [], profile: null});
  assert.equal(none.nudge, null); assert.deepEqual(none.order, CATALOG.map(c => c.id));
  assert.equal(home({events: [], evidence: [], profile: {age: 6}}).nudge !== null, true);
});

test('Log service: skill evidence and the hub\'s home-list rows are read with the play history; reset progress excluded', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-evidence-'));
  const row = (minutes, extra) => JSON.stringify({player: 'beginner', at: new Date(NOW - minutes * 60000).toISOString(), ...extra}) + '\n';
  const answer = (id, ok) => ({type: 'maze_action', input: {kind: 'answer'}, result: {ok, helped: false, question: {id, type: 'gap'}}});
  const hubDir = await mkdtemp(join(tmpdir(), 'skill-evidence-hub-'));
  await writeFile(join(dir, '2026-10-01-000.jsonl'), row(300, answer('old', true)) + row(200, {type: 'profile_reset_completed'}) + row(100, answer('q1', false)) + row(90, answer('q1', true)) + '{"partial":');
  await writeFile(join(hubDir, '2026-10-01.jsonl'), row(80, {type: 'menu_home', day: '2026-09-30', nudge: 'hunt'}) + row(70, {type: 'menu_home', day: 'bad', nudge: 7}) + row(60, {type: 'chess', action: 'move', lesson: 'l', position: 'p', result: {correct: true}}));
  const service = menuOrderService({sources: {'letter-quest': dir, hub: hubDir}, players: ['beginner'], clock: () => NOW});
  await service.ranking('beginner');
  assert.deepEqual(service.evidence().filter(e => e.source === 'letter-quest').map(e => [e.item, e.ok]), [['lq:q1', false], ['lq:q1', true]]);
  assert.deepEqual(service.shown().map(x => [x.player, x.day, x.nudge]), [['beginner', '2026-09-30', 'hunt'], ['beginner', 'bad', null]]);
  assert.equal(service.evidence().filter(e => e.source === 'hub' && e.skill === 'chess').length, 1);
});

test('Worker: each child\'s private skills profile is read from the skills directory on every scan; missing = neutral', async () => {
  const {Worker} = await import('node:worker_threads');
  const {mkdir} = await import('node:fs/promises');
  const logs = await mkdtemp(join(tmpdir(), 'skill-worker-logs-')), skillsDir = await mkdtemp(join(tmpdir(), 'skill-worker-profiles-'));
  const stamp = minutes => new Date(Date.now() - 86400000 - minutes * 60000).toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let rows = '';
  for (let i = 0; i < 12; i++) rows += JSON.stringify({player: 'beginner', at: stamp(i), type: 'maze_action', input: {kind: 'answer'}, result: {ok: i % 3 > 0, helped: false, question: {id: 'w' + i, type: 'gap'}}}) + '\n';
  await writeFile(join(logs, yesterday + '-000.jsonl'), rows);
  await mkdir(join(logs, 'hub'), {recursive: true});
  await writeFile(join(skillsDir, 'beginner.json'), JSON.stringify({age: 7, context: {reading: 1}, reports: [{source: 'synthetic', focus: {motor: 0.5}}]}));
  const run = () => new Promise((resolve, reject) => {
    const w = new Worker(new URL('../menu-worker.mjs', import.meta.url), {workerData: {sources: {'letter-quest': logs, hub: join(logs, 'hub')}, players: ['beginner', 'explorer'], home: {}, timeZone: 'UTC', skillsDir}});
    w.once('message', m => { w.terminate(); resolve(m); }); w.once('error', reject); w.postMessage('scan');
  });
  const {rankings} = await run();
  assert.match(rankings.beginner.home.why[rankings.beginner.home.nudge], /child-context priority 1/);
  assert.equal(rankings.beginner.home.skills.reading.n, 12);
  assert.equal(rankings.explorer.home.nudge, null); // no profile, no evidence
});
