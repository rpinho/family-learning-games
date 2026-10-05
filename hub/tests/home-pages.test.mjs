import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {homePages, firstPage, parentOf, familyOf, activeNewGames} from '../public/home-pages.mjs';
import {smartHomeGames, SHORTCUTS} from '../public/home-shortcuts.mjs';
import {CATALOG, destination} from '../public/catalog.mjs';
import {createMenuCache} from '../public/menu-cache.mjs';
const ids = list => list.map(c => c.id);
// Synthetic shortcut picks per player shape (the household file is private).
const youngPicks = ['cookie-share', 'pattern-parade', 'trace-numbers', 'take-away', 'maze-maker'];
const olderPicks = ['snack-friend', 'maze-maker', 'maze-trace', 'letter-labyrinth'];
const youngList = ['maze-garden', 'letter-slalom', 'number-park', 'maze-maker', 'pattern-parade', 'word-arcade', 'cookie-share', 'sling', 'drawing-studio', 'target-trail', 'chess', 'dribble-duel', 'letter-quest', 'three-in-a-row', 'take-away', 'trace-numbers', 'hunt'];
const olderList = ['maze-garden', 'maze-maker', 'letter-quest', 'maze-trace', 'dribble-duel', 'letter-slalom', 'target-trail', 'number-park', 'letter-labyrinth', 'snack-friend', 'chess', 'word-arcade', 'three-in-a-row', 'sling', 'drawing-studio', 'hunt'];

test('One ordered list over two roughly equal pages: My Book + the first half, then the rest in the same order', () => {
  const young = smartHomeGames(CATALOG, youngPicks, youngList);
  assert.equal(young.length + 1, 18);
  const a = homePages(young, {lead: 1, nudge: 'number-park'});
  assert.equal(a.first.length + 1, 9); assert.equal(a.second.length, 9);
  const older = smartHomeGames(CATALOG, olderPicks, olderList);
  const b = homePages(older, {lead: 1, nudge: 'letter-quest'});
  assert.equal(b.first.length + 1, 9); assert.equal(b.second.length, 8);
  for (const [cards, p] of [[young, a], [older, b]]) {
    const all = [...ids(p.first), ...ids(p.second)];
    assert.deepEqual([...all].sort(), ids(cards).sort(), 'every card exactly once across the two pages');
    assert.equal(new Set(all).size, all.length);
    // Page 2 continues the list's own order.
    assert.deepEqual(ids(p.second), ids(cards).filter(id => ids(p.second).includes(id)));
  }
  // Admin has no My Book: an even split of the games.
  const admin = homePages(CATALOG, {lead: 0});
  assert.equal(admin.first.length, 6); assert.equal(admin.second.length, 6);
  assert.deepEqual(homePages([], {lead: 1}), {first: [], second: []});
});

test('Each family has one card on page 1; its most-played card wins, siblings stay reachable', () => {
  const cards = smartHomeGames(CATALOG, olderPicks, olderList);
  const p = homePages(cards, {lead: 1, familyOrder: ['maze-trace', 'snack-friend', 'letter-slalom', 'sling']});
  assert.ok(ids(p.first).includes('maze-trace'));
  assert.ok(ids(p.second).includes('maze-maker'));
  assert.ok(ids(p.second).includes('letter-labyrinth'));
  assert.ok(ids(p.second).includes('maze-garden'));
  assert.equal(new Set(p.first.map(c => familyOf(c.id))).size, p.first.length);
  assert.equal(p.first.length, 8);
  assert.equal(parentOf('drawing-studio'), 'number-park');
  assert.equal(parentOf('letter-slalom'), 'word-arcade');
  assert.equal(parentOf('sling'), 'target-trail');
});

test('The nudge keeps the third game slot, including when its family favourite ranks ahead of it', () => {
  const cards = smartHomeGames(CATALOG, olderPicks, olderList);
  for (const nudge of ['letter-labyrinth', 'maze-garden', 'chess', 'hunt', 'number-park']) {
    const p = homePages(cards, {lead: 1, nudge, familyOrder: ['maze-maker', 'snack-friend']});
    assert.equal(p.first[2].id, nudge);
    const ordinary=p.first.filter(c=>c.id!==nudge);assert.equal(new Set(ordinary.map(c=>familyOf(c.id))).size,ordinary.length);assert.ok(ids(p.first).includes('maze-maker'));
  }
  const list = ['chess', 'word-arcade', 'number-park', 'hunt'].map(id => CATALOG.find(g => g.id === id));
  assert.deepEqual(ids(firstPage(list, {count: 4, nudge: 'chess'})), ['word-arcade', 'number-park', 'chess', 'hunt']);
  assert.deepEqual(ids(firstPage(list, {count: 4, nudge: 'hunt'})), ['chess', 'word-arcade', 'hunt', 'number-park']);
  assert.deepEqual(firstPage(list, {count: 0, nudge: 'chess'}), []);
});

const discovery = {'balance-scale': '2026-10-03'};
test('New games get seven calendar days on page 1, then compete normally; future/invalid dates do not boost', () => {
  const cards = smartHomeGames(CATALOG, [...olderPicks, 'balance-scale'], olderList);
  for (let d = 3; d <= 9; d++) {
    const day = '2026-10-' + String(d).padStart(2, '0');
    const p = homePages(cards, {lead: 1, newGames: discovery, day, nudge: 'letter-quest'});
    assert.equal(p.first[4].id, 'balance-scale', day);
    assert.equal(p.first[2].id, 'letter-quest');
    assert.ok(!ids(p.first).includes('number-park'));
    assert.ok(!ids(p.first).includes('snack-friend'));
    assert.equal(p.first.length + 1, 9);
    assert.equal(p.second.length, 9);
  }
  for (const day of ['2026-10-02', '2026-10-10', '2026-10-11']) {
    const p = homePages(cards, {lead: 1, newGames: discovery, day});
    assert.ok(ids(p.second).includes('balance-scale'), day);
  }
  assert.deepEqual(activeNewGames({'chess': '2026-02-30', 'hunt': 'oops'}, '2026-03-01'), []);
  assert.deepEqual(activeNewGames(discovery, 'bad'), []);
  assert.deepEqual(activeNewGames(null, '2026-10-03'), []);
  const p = homePages(cards, {lead: 1, newGames: discovery, day:'2026-10-03', nudge:'letter-quest', columns:3});
  assert.equal(p.first[2].id, 'letter-quest');
  assert.equal(p.first[3].id, 'balance-scale', 'row two, next to the nudge on a tablet');
});

test('A new game already early in the list cannot shift the nudge out of its slot', () => {
  const cards = smartHomeGames(CATALOG, ['balance-scale'], ['balance-scale', 'chess', 'hunt']);
  const p = homePages(cards, {lead:1, newGames:discovery, day:'2026-10-03', nudge:'hunt'});
  assert.equal(p.first[2].id, 'hunt');
  assert.equal(p.first[4].id, 'balance-scale');
});

// Recorded card order only, replayed as an anonymous preset: no household history or names.
const recordedOrder = ['maze-garden','maze-trace','letter-labyrinth','maze-maker','dribble-duel','number-park','drawing-studio','snack-friend','letter-slalom','sling','letter-quest','chess','word-arcade','three-in-a-row','target-trail','hunt'];
test('Recorded crowded order: favourite maze plus the nudge, Balance scale, Letter Quest and chess on page 1', () => {
  const cards = smartHomeGames(CATALOG, [...olderPicks, 'balance-scale'], recordedOrder);
  const p = homePages(cards, {lead:1, nudge:'letter-labyrinth', familyOrder:['maze-trace','maze-maker','chess','number-park','maze-garden','letter-labyrinth','letter-slalom','snack-friend','drawing-studio','letter-quest','word-arcade','sling','dribble-duel','three-in-a-row','target-trail','balance-scale','hunt'],newGames:discovery, day:'2026-10-03'});
  assert.equal(p.first.filter(c => familyOf(c.id) === 'maze-garden').length, 2);
  assert.deepEqual(ids(p.first), ['maze-trace','dribble-duel','letter-labyrinth','letter-slalom','balance-scale','sling','letter-quest','chess']);
  assert.equal(p.first.length + 1, 9);
  assert.equal(new Set([...ids(p.first), ...ids(p.second)]).size, cards.length);
});

test('Without a smart list yet (new device) both pages still paint at once from the default order', () => {
  const p = homePages(smartHomeGames(CATALOG, youngPicks, null), {lead: 1, nudge: null});
  assert.equal(p.first.length + p.second.length, CATALOG.length + youngPicks.length);
  assert.ok(p.first.length >= 1);
});

test('Every game and every shortcut stays reachable from the two pages', () => {
  const p = homePages(smartHomeGames(CATALOG, olderPicks, olderList), {lead: 1});
  const shown = [...ids(p.first), ...ids(p.second)];
  for (const g of CATALOG) { assert.ok(shown.includes(g.id), g.id); assert.notEqual(destination('#' + g.id).type, 'home'); }
  for (const s of SHORTCUTS) { assert.ok(CATALOG.some(g => g.id === parentOf(s.id))); assert.notEqual(destination(s.href || '#' + s.id).type, 'home'); }
  assert.equal(destination('#more').type, 'home');
});

test('Plain page buttons, no categories, no swiping; a new visit opens on page 1', async () => {
  const src = await readFile(new URL('../public/hub.mjs', import.meta.url), 'utf8');
  assert.match(src, /homePages\(/);
  assert.match(src, /href="#more">More games →/);
  assert.match(src, /← Back/);
  assert.doesNotMatch(src, /group-title|allGamesGroups|shelfPage|swipe|touchmove/);
  assert.match(src, /location\.hash === "#more"\) history\.replaceState/);
});

test('The day\'s nudge is cached with its list and dropped when the list does not contain it', async () => {
  const disk = new Map();
  const storage = {getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, v), removeItem: k => disk.delete(k)};
  const c = createMenuCache({storage, request: async () => ({order: ids(CATALOG), home: ['chess', 'number-park'], nudge: 'number-park'})});
  assert.equal(c.nudge('a'), null);
  await c.refresh('a');
  assert.equal(c.nudge('a'), 'number-park');
  assert.equal(createMenuCache({storage}).nudge('a'), 'number-park', 'read back from the device on the next visit');
  const d = createMenuCache({storage, request: async () => ({order: ids(CATALOG), home: ['chess'], nudge: 'number-park'})});
  await d.refresh('a');
  assert.equal(d.nudge('a'), null);
  assert.equal(createMenuCache({storage}).nudge('a'), null);
});

import {swipeDirection, firstPage as firstPage2} from '../public/home-pages.mjs';
test('a quick horizontal swipe turns the page; taps and scrolls do not', () => {
  assert.equal(swipeDirection(-120, 10, 200), 'next');
  assert.equal(swipeDirection(120, -8, 200), 'prev');
  assert.equal(swipeDirection(-30, 2, 100), null);
  assert.equal(swipeDirection(-90, 120, 200), null);
  assert.equal(swipeDirection(-200, 0, 1500), null);
});
test('the day nudge never takes his favourite out of its family on page one', () => {
  const cards = ['maze-trace','maze-maker','letter-labyrinth','dribble-duel','chess','letter-quest'].map(id => ({id}));
  const p = firstPage2(cards, {count: 5, nudge: 'letter-labyrinth', familyOrder: ['maze-trace','maze-maker','dribble-duel','chess']});
  const ids = p.map(c => c.id);
  assert.ok(ids.includes('letter-labyrinth') && ids.includes('maze-trace'), ids.join());
  assert.ok(!ids.includes('maze-maker'), 'still one favourite per family');
});
