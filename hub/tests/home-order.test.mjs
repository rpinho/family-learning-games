import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {smartHome, homeCards, localDay, TEMPLATE} from '../home-order.mjs';
import {subActivityFor, activityFor} from '../menu-order.mjs';
import {smartHomeGames, homeGames, SHORTCUTS} from '../public/home-shortcuts.mjs';
import {cachedMenuOrderService} from '../menu-cache.mjs';
import {createMenuCache} from '../public/menu-cache.mjs';
import {CATALOG} from '../public/catalog.mjs';

const DAY = 86400000, TZ = 'America/New_York';
// 10:00 EDT on Oct 1; local midnight is 04:00Z.
const NOW = Date.parse('2026-10-01T14:00:00Z'), MIDNIGHT = Date.parse('2026-10-01T04:00:00Z');
const IDS = CATALOG.map(g => g.id);
const at = (daysAgo, minutes = 0) => MIDNIGHT - daysAgo * DAY - 60 * 60000 + minutes * 60000;
const visit = (game, daysAgo, extra = {}) => ({player: 'a', game, sub: null, at: at(daysAgo), ...extra});
const sub = (game, activity, daysAgo) => ({player: 'a', game, sub: activity, at: at(daysAgo)});
const home = (events, opts = {}) => smartHome({events, player: 'a', now: NOW, timeZone: TZ, ...opts});

test('Local day: key and midnight follow the household time zone', () => {
  const d = localDay(NOW, TZ);
  assert.equal(d.key, '2026-10-01'); assert.equal(d.start, MIDNIGHT);
  assert.equal(localDay(Date.parse('2026-10-01T03:30:00Z'), TZ).key, '2026-09-30');
  assert.equal(localDay(NOW, 'Not/AZone').key, '2026-10-01');
});

test('Frequent now: distinct recent visits lead, recent beats old, every card kept once', () => {
  const events = [visit('chess', 1), visit('chess', 2), visit('chess', 3), visit('word-arcade', 0.1), visit('maze-garden', 12), visit('maze-garden', 12.5), visit('maze-garden', 13)];
  // 300 moves in one sitting are one visit.
  for (let i = 0; i < 300; i++) events.push({player: 'a', game: 'sling', at: at(1, i / 100)});
  const h = home(events);
  assert.equal(h.order[0], 'chess');
  assert.deepEqual(new Set(h.order), new Set(IDS)); assert.equal(h.order.length, IDS.length);
  // Decay: three old maze visits score below one visit yesterday.
  assert.ok(h.order.indexOf('word-arcade') < h.order.indexOf('maze-garden'));
  assert.ok(h.order.indexOf('sling') < h.order.indexOf('maze-garden'));
  assert.match(h.why.chess, /frequent now #1/);
  // The other player's play is ignored.
  assert.equal(home(events.map(e => ({...e, player: 'b'}))).frequent.length, 0);
});

test('Play after local midnight waits for tomorrow: the order is fixed all day', () => {
  const base = [visit('chess', 1), visit('word-arcade', 2)];
  const morning = home(base, {now: MIDNIGHT + 60000});
  const later = [...base, ...Array.from({length: 6}, (_, i) => ({player: 'a', game: 'three-in-a-row', at: MIDNIGHT + (i + 1) * 3600000}))];
  assert.deepEqual(home(later, {now: NOW + 8 * 3600000}).order, morning.order);
  assert.equal(home(later, {now: NOW + DAY}).order[0], 'three-in-a-row');
});

test('Deterministic per child per day; different children and days can differ', () => {
  const events = [visit('chess', 1), visit('number-park', 2)];
  for (const id of ['target-trail', 'sling', 'letter-quest', 'three-in-a-row', 'dribble-duel']) for (let d = 9; d < 14; d++) events.push(visit(id, d));
  const opts = {shortcuts: ['pattern-parade', 'take-away'], nudges: ['hunt', 'drawing-studio']};
  assert.deepEqual(home(events, opts), home([...events].reverse(), opts));
  assert.deepEqual(home(events, opts).order, home(events, {...opts, now: NOW + 3 * 3600000}).order);
  const days = new Set(Array.from({length: 7}, (_, d) => home(events, {...opts, now: NOW + d * DAY}).forgotten.join()));
  assert.ok(days.size > 2, 'forgotten favourites rotate across the week');
  const other = smartHome({events: events.map(e => ({...e, player: 'b'})), player: 'b', now: NOW, timeZone: TZ, ...opts});
  assert.deepEqual(new Set(other.order), new Set(home(events, opts).order));
});

test('Forgotten favourites: used a lot before, quiet now; rotation reaches every candidate, two a day, high on the page', () => {
  const events = [visit('chess', 0.2), visit('chess', 1), visit('word-arcade', 0.5), visit('maze-garden', 1.5), visit('number-park', 2)];
  const past = ['target-trail', 'sling', 'letter-quest', 'three-in-a-row'];
  for (const id of past) for (let d = 9; d < 13; d++) events.push(visit(id, d));
  // Played a lot before, but also this week: not forgotten.
  for (let d = 9; d < 13; d++) events.push(visit('dribble-duel', d));
  events.push(visit('dribble-duel', 1), visit('dribble-duel', 2));
  const seen = new Set();
  for (let d = 0; d < 6; d++) {
    const h = home(events, {now: NOW + d * DAY, nudges: ['hunt']});
    assert.equal(h.forgotten.length, 2);
    // Without a nudge the slot closes up, but the picks stay among the first cards.
    for (const id of home(events, {now: NOW + d * DAY}).forgotten) assert.ok(home(events, {now: NOW + d * DAY}).order.indexOf(id) < TEMPLATE.length);
    for (const id of h.forgotten) { assert.ok(past.includes(id), id); seen.add(id); assert.match(h.why[id], /forgotten favourite/); }
    // R slots are 5th and 7th when there is enough frequent play and a nudge.
    assert.equal(h.order[TEMPLATE.indexOf('R')], h.forgotten[0]);
    assert.equal(h.order[TEMPLATE.lastIndexOf('R')], h.forgotten[1]);
    const next = home(events, {now: NOW + (d + 1) * DAY, nudges: ['hunt']});
    assert.notDeepEqual(next.forgotten, h.forgotten, 'not the same pair two days running in a stable pool');
  }
  assert.deepEqual([...seen].sort(), [...past].sort());
});

test('Reviewed shortcuts are cards and feed the favourites pool; their own play counts for them', () => {
  const shortcuts = ['cookie-share', 'pattern-parade', 'take-away', 'unknown-card', 'pattern-parade'];
  assert.deepEqual(homeCards(shortcuts), [...IDS, 'cookie-share', 'pattern-parade', 'take-away']);
  const events = [visit('chess', 0.5), sub('number-park', 'np:cookies', 0.2), sub('number-park', 'np:cookies', 1), sub(null, 'np:cookies', 2)];
  const h = home(events, {shortcuts});
  assert.equal(h.order.length, IDS.length + 3); assert.equal(new Set(h.order).size, h.order.length);
  assert.equal(h.order[0], 'cookie-share');
  for (const id of h.forgotten) assert.ok(['pattern-parade', 'take-away'].includes(id) || IDS.includes(id));
  assert.ok(h.forgotten.some(id => ['pattern-parade', 'take-away'].includes(id)));
  // With no frequency for them, quiet shortcuts still rank above never-played catalog cards.
  const rest = h.order.slice(TEMPLATE.length);
  for (const id of ['pattern-parade', 'take-away'].filter(id => !h.forgotten.includes(id))) assert.ok(rest.indexOf(id) < rest.indexOf('hunt'));
});

test('Nudge: one slot (third), rotating daily through the grown-ups list, skipping cards already near the top', () => {
  const events = [visit('chess', 0.2), visit('chess', 1), visit('word-arcade', 0.5), visit('maze-garden', 1.5)];
  const h = home(events, {nudges: ['hunt']});
  assert.equal(h.order[TEMPLATE.indexOf('N')], 'hunt'); assert.match(h.why.hunt, /nudge/);
  assert.equal(home(events, {nudges: ['chess']}).nudge, null);
  assert.equal(home(events, {nudges: ['chess', 'hunt']}).nudge, 'hunt');
  assert.equal(home(events, {nudges: ['not-a-card']}).nudge, null);
  const picks = new Set(Array.from({length: 6}, (_, d) => home(events, {nudges: ['hunt', 'sling', 'letter-quest'], now: NOW + d * DAY}).nudge));
  assert.deepEqual([...picks].sort(), ['hunt', 'letter-quest', 'sling']);
  // A nudge is never also a forgotten pick or duplicated.
  for (let d = 0; d < 5; d++) { const x = home(events, {nudges: ['take-away'], shortcuts: ['take-away', 'pattern-parade'], now: NOW + d * DAY}); assert.ok(!x.forgotten.includes(x.nudge)); assert.equal(new Set(x.order).size, x.order.length); }
});

test('Never empty: no history, malformed rows and odd settings still give every card', () => {
  const none = home([]);
  assert.deepEqual(none.order, IDS); assert.equal(none.nudge, null);
  const odd = home([null, {player: 'a', game: 'chess', at: NaN}, {player: 'a', game: 'nope', at: at(1)}, {player: 'a', at: at(1)}], {shortcuts: 'cookie-share', nudges: {x: 1}});
  assert.deepEqual(new Set(odd.order), new Set(IDS));
  const withShortcuts = home([], {shortcuts: ['maze-maker'], nudges: ['maze-maker']});
  // A forced nudge with no play at all still waits for the third card (the first row stays the usual favourites).
  assert.equal(withShortcuts.order[TEMPLATE.indexOf('N')], 'maze-maker'); assert.equal(withShortcuts.order.length, IDS.length + 1);
});

test('Finer activities: shortcut play and opens are credited to the shortcut card, not hints or settings', () => {
  assert.equal(subActivityFor('hub', {type: 'client', kind: 'open_game', detail: 'cookie-share'}), 'np:cookies');
  assert.equal(subActivityFor('hub', {type: 'client', kind: 'open_game', detail: 'maze-garden/maker'}), 'maze:maker');
  assert.equal(subActivityFor('hub', {type: 'client', kind: 'open_game', detail: 'chess'}), null);
  assert.equal(subActivityFor('number-park', {type: 'action', input: {kind: 'cookie-place'}}), 'np:cookies');
  assert.equal(subActivityFor('number-park', {type: 'action', input: {kind: 'answer'}, before: {game: 'pattern'}}), 'np:pattern');
  assert.equal(subActivityFor('number-park', {type: 'action', input: {kind: 'start', game: 'subtract'}}), 'np:subtract');
  assert.equal(subActivityFor('number-park', {type: 'action', input: {kind: 'next'}, before: {game: 'pattern'}}), null);
  assert.equal(subActivityFor('number-park', {type: 'action', input: {kind: 'hint'}, before: {game: 'cookies'}}), null);
  assert.equal(subActivityFor('maze-garden', {event: 'maker-build'}), 'maze:maker');
  assert.equal(subActivityFor('maze-garden', {event: 'hint'}), null);
  assert.equal(subActivityFor('letter-quest', {type: 'maze_action', input: {kind: 'forward'}}), 'lq:maze');
  // Cookie and maze-maker play now also count for their families.
  assert.equal(activityFor('number-park', {type: 'action', input: {kind: 'cookie-check'}}), 'number-park');
  assert.equal(activityFor('maze-garden', {event: 'maker-moves'}), 'maze-garden');
  for (const s of SHORTCUTS) assert.match(s.activity, /^[a-z]+:[a-z]+(?:-[a-z]+)*$/);
});

test('Page: the smart list orders the cards; unknown ids dropped, missing cards kept, no list = shortcuts first as before', () => {
  const picks = ['cookie-share', 'pattern-parade'];
  assert.deepEqual(smartHomeGames(CATALOG, picks, null), homeGames(CATALOG, picks));
  assert.deepEqual(smartHomeGames(CATALOG, picks, ['bogus']), homeGames(CATALOG, picks));
  const shown = smartHomeGames(CATALOG, picks, ['chess', 'pattern-parade', 'bogus', 'chess', 'snack-friend']);
  assert.deepEqual(shown.slice(0, 2).map(c => c.id), ['chess', 'pattern-parade']);
  assert.equal(shown.length, CATALOG.length + 2); assert.equal(new Set(shown.map(c => c.id)).size, shown.length);
  assert.ok(!shown.some(c => c.id === 'snack-friend'), 'another player\'s shortcut is not added');
});

class FakeWorker extends EventEmitter {postMessage() {this.jobs = (this.jobs || 0) + 1;} terminate() {this.stopped = true;} unref() {}}
test('Server snapshot: a failed or malformed home keeps the last good list; each new list is logged once', () => {
  const workers = [], logged = [], errors = [];let now = 0;
  const service = cachedMenuOrderService({sources: {}, players: ['a'], clock: () => now, onHome: (p, h) => logged.push([p, h.day]), onError: e => errors.push(e), makeWorker: () => {const w = new FakeWorker(); workers.push(w); return w;}});
  try {
    assert.equal(service.ranking('a').home, undefined);
    const good = {day: '2026-10-01', order: ['chess', 'hunt'], why: {chess: 'x'}};
    workers[0].emit('message', {rankings: {a: {order: IDS, home: good}}});
    assert.deepEqual(service.ranking('a').home.order, ['chess', 'hunt']);
    now += 60001; service.ranking('a');
    workers[0].emit('message', {rankings: {a: {order: IDS, home: good}}});
    assert.equal(logged.length, 1);
    for (const bad of [{day: 'x', order: ['a', 'a']}, {day: 'x', order: []}, {day: 'x', order: ['<b>']}, null]) {
      now += 60001; service.ranking('a');
      workers[0].emit('message', {rankings: {a: {order: IDS, home: bad, homeError: bad ? undefined : 'scan broke'}}});
      assert.deepEqual(service.ranking('a').home.order, ['chess', 'hunt']);
    }
    assert.equal(errors.filter(e => e === 'home: scan broke').length, 1);
    assert.equal('homeError' in service.ranking('a'), false);
  } finally {service.close();}
});

test('Device cache: the home list paints from storage at once; late results only affect the next visit', async () => {
  const disk = new Map([['family-games-home-order:a', JSON.stringify(['chess', 'hunt'])]]);let release;
  const c = createMenuCache({storage: {getItem: k => disk.get(k), setItem: (k, v) => disk.set(k, v)}, request: () => new Promise(r => release = r)});
  assert.deepEqual(c.home('a'), ['chess', 'hunt']); assert.equal(c.home('b'), null);
  const work = c.refresh('a'); await Promise.resolve();
  assert.deepEqual(c.home('a'), ['chess', 'hunt']);
  release({order: IDS, ready: true, home: ['sling', 'cookie-share']}); await work;
  assert.deepEqual(c.home('a'), ['sling', 'cookie-share']); assert.equal(disk.get('family-games-home-order:a'), JSON.stringify(['sling', 'cookie-share']));
  // A restarting server, a malformed list or a failed request keeps what the device had.
  for (const result of [{order: IDS, ready: false, home: ['hunt']}, {order: IDS, home: ['x', 'x']}, {order: IDS, home: 'chess'}]) {
    const d = createMenuCache({storage: {getItem: () => JSON.stringify(['chess'])}, request: async () => result});
    await d.refresh('a'); assert.deepEqual(d.home('a'), ['chess']);
  }
  const broken = createMenuCache({storage: {getItem() {throw Error('off');}, setItem() {throw Error('full');}}, request: async () => {throw Error('offline');}});
  await broken.refresh('a'); assert.equal(broken.home('a'), null);
});


test('New-game smart order boost is data-driven, explained, and expires after seven household days', () => {
  const options = {shortcuts:['balance-scale'], newGames:{'balance-scale':'2026-10-01'}, nudges:['hunt']};
  for (const days of [0, 6]) {
    const h = home([], {...options, now:NOW + days * DAY});
    assert.equal(h.order[4], 'balance-scale');
    assert.equal(h.order[2], 'hunt');
    assert.match(h.why['balance-scale'], /new game/);
    assert.deepEqual(h.newGames, ['balance-scale']);
  }
  for (const days of [-1, 7]) {
    const h = home([], {...options, now:NOW + days * DAY});
    assert.deepEqual(h.newGames, []);
    assert.doesNotMatch(h.why['balance-scale'], /new game/);
  }
  const played = home([sub('number-park','np:balance',0.2)], options);
  assert.equal(played.order[4], 'balance-scale', 'playing does not cancel discovery');
  assert.equal(played.order[2], 'hunt');
});

test('Family preference uses visit count then the most recent play; Balance scale history is credited', () => {
  const h = home([sub('maze-garden','maze:maker',2),sub('maze-garden','maze:trace',1)], {shortcuts:['maze-maker','maze-trace']});
  assert.ok(h.familyOrder.indexOf('maze-trace') < h.familyOrder.indexOf('maze-maker'));
  assert.equal(subActivityFor('hub', {type:'client',kind:'open_game',detail:'balance-scale'}), 'np:balance');
  assert.equal(subActivityFor('number-park', {type:'action',input:{kind:'start',game:'balance'}}), 'np:balance');
  assert.equal(subActivityFor('number-park', {type:'action',input:{kind:'answer'},before:{game:'balance'}}), 'np:balance');
  assert.equal(subActivityFor('number-park', {type:'action',input:{kind:'hint'},before:{game:'balance'}}), null);
});

test('Family preferences are cached with the home list for the next visit', async () => {
  const disk = new Map(), storage = {getItem:k=>disk.get(k),setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
  const c = createMenuCache({storage,request:async()=>({order:IDS,home:['maze-garden','maze-maker'],familyOrder:['maze-maker','maze-garden']})});
  assert.equal(c.familyOrder('a'), null);
  await c.refresh('a');
  assert.deepEqual(c.familyOrder('a'), ['maze-maker','maze-garden']);
  assert.deepEqual(createMenuCache({storage}).familyOrder('a'), ['maze-maker','maze-garden']);
});


test('The daily nudge chooses another family while a discovery reserves its family', () => {
  const options = {shortcuts:['snack-friend','balance-scale'],newGames:{'balance-scale':'2026-10-01'},nudges:['snack-friend','hunt']};
  assert.equal(home([],options).nudge, 'hunt');
  assert.equal(home([],{...options,nudges:['snack-friend']}).nudge, null);
});

test('family favourites compare direct visits, so a family aggregate cannot beat its most-played activity',()=>{
 const events=[sub('maze-garden','maze:trace',1),sub('maze-garden','maze:trace',2),sub('maze-garden','maze:trace',3),sub('maze-garden','maze:maker',4),visit('maze-garden',5)];
 const h=home(events,{shortcuts:['maze-trace','maze-maker','letter-labyrinth']});assert.ok(h.familyOrder.indexOf('maze-trace')<h.familyOrder.indexOf('maze-garden'));assert.ok(h.familyOrder.indexOf('maze-trace')<h.familyOrder.indexOf('maze-maker'));
});
